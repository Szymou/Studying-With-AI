﻿import express from 'express';
import db from '../db';
import { authMiddleware } from '../auth';
import axios from 'axios';
import dotenv from 'dotenv';
import { isDuplicateQuestion } from '../utils/similarity';
import { DEFAULT_AI_PROMPTS } from '../config';
import fs from 'fs';
import path from 'path';

dotenv.config();

const router = express.Router();
router.use(authMiddleware);

const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_BASE_URL = process.env.AI_API_BASE_URL || 'https://api.openai.com/v1';
const AI_MODEL = process.env.AI_MODEL || 'gpt-3.5-turbo';

const callAi = async (messages: any[]) => {
  if (!AI_API_KEY) throw new Error('AI_API_KEY 未配置');
  try {
    const response = await axios.post(
      AI_BASE_URL + '/chat/completions',
      { model: AI_MODEL, messages, temperature: 0.7, stream: false },
      { headers: { 'Authorization': 'Bearer ' + AI_API_KEY, 'Content-Type': 'application/json' }, timeout: 60000 }
    );
    return response.data.choices[0].message.content;
  } catch (error: any) {
    throw new Error('AI服务调用失败：' + (error.response?.data?.error?.message || error.message));
  }
};

// 从数据库读取 AI 提示词
const getPrompt = async (key: string, domainName = ''): Promise<string> => {
  try {
    const row = await db.get('SELECT value FROM ai_prompts WHERE key = ?', [key]);
    if (row && row.value) {
      return row.value.replace('{domain}', domainName);
    }
  } catch (e) {}
  // 降级默认值
  const fallback = DEFAULT_AI_PROMPTS.find(p => p.key === key);
  return (fallback ? fallback.value : '').replace('{domain}', domainName);
};

// ============ AI 流式问答（SSE）- 供前端直接调用 ============
router.post('/ask', authMiddleware, async (req, res) => {
    const { question, userAnswer, questionId } = req.body;
    if (!question) return res.status(400).json({ error: '问题不能为空' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    if (!AI_API_KEY) {
        res.write('data: ' + JSON.stringify({ error: 'AI服务未配置' }) + '\n\n');
        res.write('data: [DONE]\n\n');
        return res.end();
    }

    const systemPrompt = await getPrompt('ai_assistant');
    const userPrompt = userAnswer
        ? '问题：' + question + '\n用户的回答：' + userAnswer + '\n请评价是否正确，并给出标准答案（含代码示例）。'
        : '问题：' + question + '\n。';

    try {
        let buffer = '';
        const response = await axios.post(
            AI_BASE_URL + '/chat/completions',
            { model: AI_MODEL, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.7, stream: true },
            { headers: { 'Authorization': 'Bearer ' + AI_API_KEY, 'Content-Type': 'application/json' }, responseType: 'stream', timeout: 15000 }
        );

        let fullContent = '';
        let hasData = false;
        let lastSaveTime = Date.now();
        let connectionClosed = false;

        // 定期保存进度的函数
        const saveProgress = async (content: string) => {
            if (questionId && content.length > 0) {
                try {
                    await db.run('DELETE FROM ai_answer_cache WHERE user_id = ? AND question_id = ?', [req.user.userId, questionId]);
                    await db.run('INSERT INTO ai_answer_cache (user_id, question_id, answer) VALUES (?, ?, ?)', [req.user.userId, questionId, content]);
                } catch (e) {
                    console.error('Save progress error:', e);
                }
            }
        };

        // 监听连接关闭事件
        req.on('close', () => {
            console.log('Client disconnected, but will continue saving AI output');
            connectionClosed = true;
        });

        response.data.on('data', (chunk: Buffer) => {
            hasData = true;
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data: ')) continue;
                const dataStr = trimmed.slice(6).trim();
                if (dataStr === '[DONE]') { continue; } // 继续处理直到end
                try {
                    const parsed = JSON.parse(dataStr);
                    const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || parsed.content || '';
                    if (content) {
                        fullContent += content;
                        
                        // 如果连接还没关闭，就向客户端发送
                        if (!connectionClosed) {
                            try {
                                res.write('data: ' + JSON.stringify({ content }) + '\n\n');
                            } catch (e) {
                                console.log('Error writing to closed connection');
                            }
                        }
                        
                        // 每500ms保存进度，不管连接是否关闭
                        if (Date.now() - lastSaveTime > 500) {
                            lastSaveTime = Date.now();
                            saveProgress(fullContent);
                        }
                    }
                } catch(e) {}
            }
        });

        response.data.on('end', async () => {
            // 不管连接是否关闭，都要保存最终答案，并加上完成标记！
            if (fullContent) {
                // 在答案末尾加完成标记
                const finalAnswer = fullContent + '\n[AI_COMPLETED]';
                if (questionId) {
                    try {
                        await db.run('DELETE FROM ai_answer_cache WHERE user_id = ? AND question_id = ?', [req.user.userId, questionId]);
                        await db.run('INSERT INTO ai_answer_cache (user_id, question_id, answer) VALUES (?, ?, ?)', [req.user.userId, questionId, finalAnswer]);
                    } catch(e) { console.error('Final save error:', e); }
                }
            } else {
                // 流式失败 → 非流式重试
                try {
                    const fbRes = await axios.post(
                        AI_BASE_URL + '/chat/completions',
                        { model: AI_MODEL, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.7, stream: false },
                        { headers: { 'Authorization': 'Bearer ' + AI_API_KEY, 'Content-Type': 'application/json' }, timeout: 15000 }
                    );
                    const text = fbRes.data.choices?.[0]?.message?.content || fbRes.data.choices?.[0]?.text || fbRes.data.content || '';
                    if (text) {
                        fullContent = text;
                        const finalAnswer = text + '\n[AI_COMPLETED]';
                        if (!connectionClosed) {
                            try {
                                res.write('data: ' + JSON.stringify({ content: text }) + '\n\n');
                            } catch(e) {}
                        }
                        if (questionId) {
                            await db.run('DELETE FROM ai_answer_cache WHERE user_id = ? AND question_id = ?', [req.user.userId, questionId]);
                            await db.run('INSERT INTO ai_answer_cache (user_id, question_id, answer) VALUES (?, ?, ?)', [req.user.userId, questionId, finalAnswer]);
                        }
                    } else {
                        if (!connectionClosed) {
                            await sendLocalAnswer(question, userAnswer, res);
                        }
                    }
                } catch(e) {
                    if (!connectionClosed) {
                        await sendLocalAnswer(question, userAnswer, res);
                    }
                }
            }
            // 如果连接还没关闭，就发送结束信号并结束响应
            if (!connectionClosed) {
                try {
                    res.write('data: [DONE]\n\n');
                    res.end();
                } catch(e) {}
            }
        });

        response.data.on('error', async () => {
            // 发生错误时也保存已收到的内容
            if (fullContent.length > 0 && questionId) {
                try {
                    await db.run('DELETE FROM ai_answer_cache WHERE user_id = ? AND question_id = ?', [req.user.userId, questionId]);
                    await db.run('INSERT INTO ai_answer_cache (user_id, question_id, answer) VALUES (?, ?, ?)', [req.user.userId, questionId, fullContent]);
                } catch(e) { console.error('Error save:', e); }
            }
            if (!connectionClosed) {
                await sendLocalAnswer(question, userAnswer, res);
                res.write('data: [DONE]\n\n');
                res.end();
            }
        });
    } catch (error: any) {
        await sendLocalAnswer(question, userAnswer, res);
        res.write('data: [DONE]\n\n');
        res.end();
    }
});

// 内置知识库兜底
async function sendLocalAnswer(question: string, userAnswer: string | undefined, res: any) {
  try {
    const dbModule = await import('../db');
    // 在题库中搜索匹配
    const rows = await dbModule.all('SELECT answer, question FROM questions WHERE question LIKE ? LIMIT 1', ['%' + question.replace(/[?？]/g, '').substring(0, 20) + '%']);
    if (rows && rows.length > 0) {
      // 丰富标准答案，尽可能添加代码示例
      let answer = rows[0].answer;
      const qText = rows[0].question || '';
      // 对一些常见题型追加代码示例
      if ((qText.includes('区别') || qText.includes('对比') || qText.includes('原理')) && !answer.includes('```')) {
        answer += '\n\n**代码示例：**\n```java\n// 以 ' + qText.replace(/[?？]/g, '') + ' 为例\n// （请参考完整AI回答或标准教材）\n```';
      }
      const reply = userAnswer
        ? '**问题：**' + question + '\n\n用户的回答：' + userAnswer + '\n\n**标准答案：**\n' + answer
        : '**答案说明：**\n' + answer;
      res.write('data: ' + JSON.stringify({ content: reply }) + '\n\n');
      return;
    }
    // 没匹配到，返回友好提示
    res.write('data: ' + JSON.stringify({ content: '⚠️ AI服务暂时不可用，未能获取到AI回答。\\n\\n建议：\\n1. 使用「显示答案」按钮查看标准答案\\n2. 在题目搜索页面搜索相关知识点\\n3. 检查 .env 中的 AI_API_KEY、AI_API_BASE_URL、AI_MODEL 配置是否正确' }) + '\n\n');
  } catch (e) {
    res.write('data: ' + JSON.stringify({ content: '⚠️ AI服务暂时不可用，请稍后再试。' }) + '\n\n');
  }
}

// ============ AI聊天咨询（支持持续对话） ============
router.post('/chat/new', async (req, res) => {
  try {
    const result = await db.run(
      'INSERT INTO ai_conversations (user_id, title, messages) VALUES (?, ?, ?)',
      [req.user.userId, req.body.title || '新对话', '[]']
    );
    res.json({ id: result.lastID, title: req.body.title || '新对话', messages: [] });
  } catch (error) { res.status(500).json({ error: '创建对话失败' }); }
});

router.get('/chat/list', async (req, res) => {
  try {
    const convos = await db.all(
      'SELECT id, title, created_at, updated_at FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50',
      [req.user.userId]
    );
    res.json(convos);
  } catch (error) { res.status(500).json({ error: '获取对话列表失败' }); }
});

router.get('/chat/:id', async (req, res) => {
  try {
    const convo = await db.get('SELECT id, title, messages FROM ai_conversations WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
    if (!convo) return res.status(404).json({ error: '对话不存在' });
    res.json({ id: convo.id, title: convo.title, messages: JSON.parse(convo.messages || '[]') });
  } catch (error) { res.status(500).json({ error: '获取对话失败' }); }
});

router.post('/chat/:id/message', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: '消息不能为空' });

    const convo = await db.get('SELECT id, messages FROM ai_conversations WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
    if (!convo) return res.status(404).json({ error: '对话不存在' });

    const messages = JSON.parse(convo.messages || '[]');
    messages.push({ role: 'user', content: message });

    const reply = await callAi([{ role: 'system', content: '你是一个全栈程序员，用大白话讲技术。回答要通俗易懂，多举生活中的例子，像朋友聊天一样自然，别拽术语。' }, ...messages]);
    messages.push({ role: 'assistant', content: reply });

    const firstUserMsg = messages.find((m: any) => m.role === 'user');
    const title = convo.title || (firstUserMsg ? firstUserMsg.content.substring(0, 30) : '技术咨询');
    await db.run('UPDATE ai_conversations SET messages = ?, title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(messages), title, req.params.id]);

    res.json({ reply, messages });
  } catch (error: any) { res.status(500).json({ error: error.message || 'AI咨询失败' }); }
});

  // Streaming chat endpoint - SSE
  router.post('/chat/:id/message/stream', async (req: any, res: any) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: '消息不能为空' });

      const convo = await db.get('SELECT id, messages FROM ai_conversations WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
      if (!convo) return res.status(404).json({ error: '对话不存在' });

      const messages = JSON.parse(convo.messages || '[]');
      messages.push({ role: 'user', content: message });

      // ✅ 关键修改 1: 先立即保存用户消息到数据库！
      const firstUserMsg = messages.find((m: any) => m.role === 'user');
      const title = convo.title || (firstUserMsg ? firstUserMsg.content.substring(0, 30) : '技术咨询');
      await db.run('UPDATE ai_conversations SET messages = ?, title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(messages), title, req.params.id]);

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      if (!AI_API_KEY) {
        res.write('data: ' + JSON.stringify({ error: 'AI服务未配置' }) + '\n\n');
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      const fullMessages = [{ role: 'system', content: await getPrompt('ai_assistant') }, ...messages];

      let buffer = '';
      let fullReply = '';
      const response = await axios.post(
        AI_BASE_URL + '/chat/completions',
        { model: AI_MODEL, messages: fullMessages, temperature: 0.7, stream: true },
        { headers: { 'Authorization': 'Bearer ' + AI_API_KEY, 'Content-Type': 'application/json' }, responseType: 'stream', timeout: 30000 }
      );

      // ✅ 关键修改 2: 流式输出过程中，定期保存AI回答（每500ms或一定长度）
      let lastSaveTime = Date.now();
      const saveProgress = async () => {
        if (fullReply.length > 0) {
          const tempMessages = [...messages];
          tempMessages.push({ role: 'assistant', content: fullReply });
          await db.run('UPDATE ai_conversations SET messages = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(tempMessages), req.params.id]);
        }
      };

      response.data.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === '[DONE]') { return; }
          try {
            const parsed = JSON.parse(dataStr);
            const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || '';
            if (content) {
              fullReply += content;
              res.write('data: ' + JSON.stringify({ content }) + '\n\n');
              // 每500毫秒保存一次进度
              if (Date.now() - lastSaveTime > 500) {
                lastSaveTime = Date.now();
                saveProgress().catch(err => console.error('Save progress error:', err));
              }
            }
          } catch (e) {}
        }
      });

      response.data.on('end', async () => {
        if (fullReply) {
          messages.push({ role: 'assistant', content: fullReply });
          // 最终完整保存
          await db.run('UPDATE ai_conversations SET messages = ?, title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(messages), title, req.params.id]);
        }
        res.write('data: [DONE]\n\n');
        res.end();
      });

      response.data.on('error', async (err: any) => {
        console.error('Stream error:', err);
        // 发生错误时也保存已收到的部分
        if (fullReply.length > 0) {
          const tempMessages = [...messages];
          tempMessages.push({ role: 'assistant', content: fullReply + '\n\n⚠️ AI回答中断' });
          await db.run('UPDATE ai_conversations SET messages = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(tempMessages), req.params.id]);
        }
        res.write('data: ' + JSON.stringify({ error: '流式传输中断，已保存的回答部分可在对话历史中查看。' }) + '\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
      });
    } catch (error: any) {
      console.error('Chat stream error:', error);
      res.write('data: ' + JSON.stringify({ error: error.message || 'AI咨询失败' }) + '\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
    }
  });



router.delete('/chat/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM ai_conversations WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
    res.json({ message: '对话已删除' });
  } catch (error) { res.status(500).json({ error: '删除失败' }); }
});

// ============ AI生成题目（SSE流式） ============
router.post('/generate', async (req, res) => {
  try {
    const { topic, count = 5, saveToCustom = true, tech_domain } = req.body;
    if (!topic) return res.status(400).json({ error: '请指定主题' });

    const finalCount = Math.min(Math.max(count, 1), 20);
    // 从数据库中获取领域名称，避免硬编码
    const domainRow = tech_domain ? await db.get('SELECT name FROM tech_domains WHERE code = ?', [tech_domain]) : null;
    const domainName = domainRow ? domainRow.name : 'Java';
    const prompt = '你是一位' + domainName + '技术面试题专家。请生成' + finalCount + '道关于"' + topic + '"的' + domainName + '面试题。\n\n要求：\n1. 以严格JSON数组格式返回，不要包含任何其他文字说明\n2. 格式：[{"question":"问题","answer":"答案"}]\n3. 题目要有实际价值，贴近面试常见场景\n4. 答案简洁精炼，点到即止，不要长篇大论\n5. 用大白话回答，像在给同事讲解一样自然';

    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    if (!AI_API_KEY) {
      res.write('data: ' + JSON.stringify({ type: 'error', content: 'AI服务未配置' }) + '\n\n');
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    let fullContent = '';
    let buffer = '';
    let hasData = false;

    try {
      // 调用AI流式接口
      const response = await axios.post(
        AI_BASE_URL + '/chat/completions',
        {
          model: AI_MODEL,
          messages: [
            { role: 'system', content: (await getPrompt('ai_generate', domainName)) },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          stream: true
        },
        {
          headers: { 'Authorization': 'Bearer ' + AI_API_KEY, 'Content-Type': 'application/json' },
          responseType: 'stream',
          timeout: 60000
        }
      );

      response.data.on('data', (chunk: Buffer) => {
        hasData = true;
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === '[DONE]') { continue; }
          try {
            const parsed = JSON.parse(dataStr);
            const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || parsed.content || '';
            if (content) {
              fullContent += content;
              // 流式输出内容到前端
              res.write('data: ' + JSON.stringify({ type: 'content', content }) + '\n\n');
            }
          } catch (e) {}
        }
      });

      let _ended = false;
      response.data.on('end', async () => {
        // 防止多次触发
        if (_ended) return;
        _ended = true;

        // 解析并保存题目
        let generatedQuestions;
        try {
          let cleaned = fullContent.trim()
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .replace(/[\u201c\u201d]/g, '"')
            .replace(/[\u2018\u2019]/g, "'");
          const arrStart = cleaned.indexOf('[');
          const arrEnd = cleaned.lastIndexOf(']');
          if (arrStart !== -1 && arrEnd > arrStart) {
            cleaned = cleaned.substring(arrStart, arrEnd + 1);
          }
          generatedQuestions = JSON.parse(cleaned);
          if (!Array.isArray(generatedQuestions)) throw new Error('not array');

          // 对本次生成结果自身去重（AI 偶发性重复输出）
          const seen = new Set<string>();
          const uniqueQuestions = generatedQuestions.filter((q: any) => {
            if (!q.question) return false;
            const key = q.question.trim().toLowerCase().slice(0, 100);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          let savedCount = 0;
          let skippedCount = 0;
          let dupInResponse = generatedQuestions.length - uniqueQuestions.length;
          if (saveToCustom) {
            for (const q of uniqueQuestions) {
              if (!q.question || !q.answer) continue;
              const dup = await isDuplicateQuestion(q.question, tech_domain || 'java', db);
              if (dup.isDuplicate) {
                skippedCount++;
                continue;
              }
              await db.run('INSERT INTO custom_questions (user_id, category, subcategory, question, answer, tags, tech_domain) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [req.user.userId, topic, 'AI生成', q.question, q.answer, 'ai-generated', tech_domain || 'java']);
              savedCount++;
            }
          }

          res.write('data: ' + JSON.stringify({ type: 'done', parsed: true, count: uniqueQuestions.length, saved: savedCount, skipped: skippedCount + dupInResponse, questions: uniqueQuestions }) + '\n\n');
        } catch (e) {
          try { res.write('data: ' + JSON.stringify({ type: 'done', parsed: false, raw: fullContent, message: 'AI返回格式异常' }) + '\n\n'); } catch (w) {}
        }
        try { res.write('data: [DONE]\n\n'); res.end(); } catch (w) {}
      });

      response.data.on('error', (err: any) => {
        console.error('Stream error:', err);
        res.write('data: ' + JSON.stringify({ type: 'error', content: '流式传输中断' }) + '\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
      });
    } catch (error: any) {
      res.write('data: ' + JSON.stringify({ type: 'error', content: error.message || 'AI生成失败' }) + '\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error: any) {
    console.error('Generate error:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: error.message || 'AI生成失败' });
  }
});

// ============ AI生成新领域（SSE流式） ============
router.post('/generate-domain', async (req, res) => {
  try {
    const { description, language, code, icon, numQuestions = 5 } = req.body;
    if (!description) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ success: false, message: '请提供领域描述' });
    }

    if (!AI_API_KEY) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ success: false, message: 'AI服务未配置' });
    }

    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 1. 生成领域基本信息
    res.write('data: ' + JSON.stringify({ type: 'step', content: '🔍 AI正在分析领域信息...' }) + '\n\n');

    const domainPrompt = `你是一位技术教育专家。请根据以下描述生成一个技术领域：\n${description}\n\n要求返回JSON格式：\n{\n  "code": "小写英文字母，唯一标识（如java）",\n  "name": "显示名称（如Java）",\n  "icon": "适合的emoji图标（最好是技术相关）",\n  "description": "该领域的简短描述（50-100字）"\n}\n\n只返回JSON，不要包含任何其他说明。`;
    
    let domainInfo: any;
    try {
      const domainResponse = await callAi([{ role: 'user', content: domainPrompt }]);
      const jsonMatch = domainResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        domainInfo = JSON.parse(jsonMatch[0]);
      } else {
        domainInfo = JSON.parse(domainResponse);
      }
    } catch (e) {
      domainInfo = {
        code: code || 'custom',
        name: language || '自定义领域',
        icon: icon || '📚',
        description: description.substring(0, 100)
      };
    }

    if (language) domainInfo.name = language;
    if (code) domainInfo.code = code;
    if (icon) domainInfo.icon = icon;

    // 检查领域是否已存在
    const existingDomain = await db.get('SELECT * FROM tech_domains WHERE code = ?', [domainInfo.code]);
    if (existingDomain) {
      res.write('data: ' + JSON.stringify({ type: 'error', content: '该领域已存在: ' + domainInfo.name }) + '\n\n');
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // 2. 保存新领域
    res.write('data: ' + JSON.stringify({ type: 'step', content: '💾 正在保存领域信息...' }) + '\n\n');

    await db.run(
      'INSERT INTO tech_domains (code, name, icon, description) VALUES (?, ?, ?, ?)',
      [domainInfo.code, domainInfo.name, domainInfo.icon, domainInfo.description]
    );

    res.write('data: ' + JSON.stringify({ type: 'domain', domain: domainInfo }) + '\n\n');

    // 3. 流式生成题目
    res.write('data: ' + JSON.stringify({ type: 'step', content: '🤖 AI正在生成' + numQuestions + '道' + domainInfo.name + '面试题...' }) + '\n\n');

    let savedCount = 0;
    let fullContent = '';

    try {
      const questionsPrompt = `你是一位${domainInfo.name}技术面试题专家。请生成${numQuestions}道${domainInfo.name}面试题。\n\n要求：\n1. 覆盖基础、进阶、高级难度\n2. 包含不同分类（基础语法、并发、框架、性能优化等）\n3. 题目符合实际面试场景\n4. 答案简洁精炼，点到即止，不要代码示例\n5. 用大白话回答，别太正式，像在聊天一样\n\n返回JSON数组格式：\n[{"category":"分类名称","subcategory":"子分类（可选）","question":"问题","answer":"答案","difficulty":"easy|medium|hard","tags":"标签（多个用逗号分隔）"}]\n\n只返回JSON数组，不要包含任何其他说明。`;

      const response = await axios.post(
        AI_BASE_URL + '/chat/completions',
        {
          model: AI_MODEL,
          messages: [
            { role: 'system', content: (await getPrompt('ai_generate', domainInfo.name)) },
            { role: 'user', content: questionsPrompt }
          ],
          temperature: 0.7,
          stream: true
        },
        {
          headers: { 'Authorization': 'Bearer ' + AI_API_KEY, 'Content-Type': 'application/json' },
          responseType: 'stream',
          timeout: 120000
        }
      );

      response.data.on('data', (chunk: Buffer) => {
        try {
          const text = chunk.toString();
          const lines = text.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || '';
              if (content) {
                fullContent += content;
                res.write('data: ' + JSON.stringify({ type: 'stream', content }) + '\n\n');
              }
            } catch (e) {}
          }
        } catch (e) {}
      });

      let _domainEnded = false;
      response.data.on('end', async () => {
        // 防止多次触发
        if (_domainEnded) return;
        _domainEnded = true;

        // 解析并保存题目
        try {
          let cleaned = fullContent.trim()
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .replace(/[\u201c\u201d]/g, '"')
            .replace(/[\u2018\u2019]/g, "'");
          const arrStart = cleaned.indexOf('[');
          const arrEnd = cleaned.lastIndexOf(']');
          if (arrStart !== -1 && arrEnd > arrStart) {
            cleaned = cleaned.substring(arrStart, arrEnd + 1);
          }
          const questions = JSON.parse(cleaned);
          if (!Array.isArray(questions)) throw new Error('not array');

          // 对本次生成结果自身去重
          const seen = new Set<string>();
          const uniqueQuestions = questions.filter((q: any) => {
            if (!q.question) return false;
            const key = q.question.trim().toLowerCase().slice(0, 100);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          res.write('data: ' + JSON.stringify({ type: 'step', content: '💾 正在保存题目到数据库...' }) + '\n\n');

          for (const q of uniqueQuestions) {
            if (!q.question || !q.answer) continue;
            try {
              const diffMap: Record<string, string> = { 'easy': 'easy', 'medium': 'medium', 'hard': 'hard', 'beginner': 'easy', 'elementary': 'easy', 'intermediate': 'medium', 'advanced': 'hard', 'expert': 'hard' };
              const difficulty = diffMap[(q.difficulty || 'medium').toLowerCase().trim()] || 'medium';
              // 去重校验
              const dup = await isDuplicateQuestion(q.question, domainInfo.code, db);
              if (dup.isDuplicate) {
                console.log('⏭️ 跳过重复题目:', q.question.substring(0, 60));
                continue;
              }
              await db.run(
                'INSERT INTO questions (category, subcategory, question, answer, difficulty, tags, tech_domain) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [q.category || '基础', q.subcategory || '', q.question, q.answer, difficulty, q.tags || '', domainInfo.code]
              );
              savedCount++;
            } catch (e) {
              console.error('Insert question error:', e);
            }
          }

          res.write('data: ' + JSON.stringify({ type: 'done', domain: domainInfo, saved: savedCount }) + '\n\n');
        } catch (e) {
          try { res.write('data: ' + JSON.stringify({ type: 'done', domain: domainInfo, saved: 0, parseError: true, raw: fullContent }) + '\n\n'); } catch (w) {}
        }
        try { res.write('data: [DONE]\n\n'); res.end(); } catch (w) {}
      });

      response.data.on('error', (err: any) => {
        console.error('Stream error:', err);
        res.write('data: ' + JSON.stringify({ type: 'done', domain: domainInfo, saved: 0, error: '流式生成中断' }) + '\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
      });
    } catch (e) {
      console.error('Generate questions error:', e);
      res.write('data: ' + JSON.stringify({ type: 'done', domain: domainInfo, saved: 0, error: '生成题目失败' }) + '\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error: any) {
    console.error('Generate domain error:', error);
    try {
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ success: false, message: error.message || '生成领域失败' });
    } catch (e) {}
  }
});


// ============ AI错误分析 ============
router.post('/analyze-error', async (req, res) => {
  try {
    const { question, userAnswer, correctAnswer } = req.body;
    if (!question || !correctAnswer) {
      return res.status(400).json({ error: '缺少问题或标准答案' });
    }

    if (!AI_API_KEY) {
      return res.json({ type: 'unknown', suggestion: 'AI服务未配置，无法分析错误' });
    }

    const sysPrompt = await getPrompt('ai_error_analysis');
    const prompt = `${sysPrompt}

问题：${question}
用户回答：${userAnswer || '（用户没答）'}
标准答案：${correctAnswer}

从以下三类选一个分析：
- 概念不清：用户压根没理解这个知识点
- 记忆混淆：用户把几个相似的知识点搞混了
- 细节遗漏：用户大方向对了，但漏了关键细节

以JSON格式返回，不要包含其他内容：
{"type":"概念不清|记忆混淆|细节遗漏","suggestion":"一句大白话的改进建议"}`;

    const response = await callAi([{ role: 'user', content: prompt }]);

    try {
      const cleaned = response.trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '');
      const result = JSON.parse(cleaned);
      return res.json({ type: result.type || 'unknown', suggestion: result.suggestion || '' });
    } catch {
      return res.json({ type: 'unknown', suggestion: '无法分析错误类型' });
    }
  } catch (error: any) {
    console.error('Error analysis error:', error);
    res.status(500).json({ error: '分析失败' });
  }
});

// ============ AI提示词管理 ============
router.get('/prompts', async (req, res) => {
  try {
    const rows = await db.all('SELECT key, value, description FROM ai_prompts ORDER BY key');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取提示词失败' });
  }
});

router.post('/prompts', async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ error: '缺少 key 或 value' });
    await db.run('INSERT OR REPLACE INTO ai_prompts (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [key, value]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '保存提示词失败' });
  }
});


// ============ TTS 语音合成 ============
import { execSync, exec } from 'child_process';
import crypto from 'crypto';


// 内存缓存（最多 50 条）
const ttsCache = new Map<string, { audio: Buffer, time: number }>();

router.post('/tts', async (req, res) => {
  try {
    const { text, voice = 'zh-CN-XiaoxiaoNeural' } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: '缺少文本' });
    }

    // 清理文本
    const cleanText = text
      .replace(/<[^>]+>/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/[>\|]/g, '')
      .replace(/[-*_]{3,}/g, '')
      .replace(/\n{3,}/g, '\n')
      .trim();

    if (!cleanText) return res.status(400).json({ error: '清理后无文本' });
    // 缓存 key
    const cacheKey = voice + ':' + crypto.createHash('md5').update(cleanText).digest('hex');
    const cached = ttsCache.get(cacheKey);
    if (cached && Date.now() - cached.time < 3600000) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('X-Audio-Length', cached.audio.length);
      res.setHeader('X-TTS-Cache', 'hit');
      return res.send(cached.audio);
    }


    const tmpDir = path.join(__dirname, '../../data/tts_cache');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const timestamp = Date.now();
    const inputFile = path.join(tmpDir, `input_${timestamp}.txt`);
    const outputFile = path.join(tmpDir, `output_${timestamp}.mp3`);

    fs.writeFileSync(inputFile, cleanText, 'utf-8');

    try {
      execSync(`edge-tts --file "${inputFile}" --voice ${voice} --write-media "${outputFile}"`, {
        timeout: 30000,
        env: { ...process.env, PATH: process.env.PATH + ':/home/szymou/.local/bin' }
      });
    } catch (e: any) {
      // 清理后重试
      try { fs.unlinkSync(inputFile); } catch {}
      return res.status(500).json({ error: 'TTS 合成失败: ' + (e.message || '') });
    }

    // 读取音频并返回
    const audioBuf = fs.readFileSync(outputFile);
    // 写入缓存
    ttsCache.set(cacheKey, { audio: audioBuf, time: Date.now() });
    if (ttsCache.size > 50) {
      const oldest = [...ttsCache.entries()].sort((a, b) => a[1].time - b[1].time)[0];
      if (oldest) ttsCache.delete(oldest[0]);
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-Audio-Length', audioBuf.length);
    res.send(audioBuf);

    // 异步清理临时文件
    setTimeout(() => {
      try { fs.unlinkSync(inputFile); } catch {}
      try { fs.unlinkSync(outputFile); } catch {}
    }, 5000);
  } catch (error: any) {
    console.error('TTS error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'TTS 失败: ' + (error.message || '') });
  }
});

// ============ AI配置状态 ============
router.get('/config', async (req, res) => {
  // 从 .env 文件读取，而非 runtime process.env（反映磁盘真实值）
  let envConfig = { ai_api_key: '', ai_api_base_url: '', ai_model: '', port: '' };
  try {
    const envPath = path.join(__dirname, '../../.env');
    const content = fs.readFileSync(envPath, 'utf-8');
    const mKey = content.match(/^AI_API_KEY=(.*)/m);
    const mUrl = content.match(/^AI_API_BASE_URL=(.*)/m);
    const mModel = content.match(/^AI_MODEL=(.*)/m);
    const mPort = content.match(/^PORT=(.*)/m);
    if (mKey) envConfig.ai_api_key = mKey[1].trim();
    if (mUrl) envConfig.ai_api_base_url = mUrl[1].trim();
    if (mModel) envConfig.ai_model = mModel[1].trim();
    if (mPort) envConfig.port = mPort[1].trim();
  } catch (e) {}
  res.json({
    configured: !!AI_API_KEY,
    base_url: AI_BASE_URL,
    model: AI_MODEL,
    ...envConfig,
    tip: AI_API_KEY ? 'AI服务已配置' : '请在.env中设置AI_API_KEY'
  });
});

// AI answer cache
router.get('/cache/:qid', async (req: any, res: any) => {
  try {
    const row = await db.get('SELECT answer FROM ai_answer_cache WHERE user_id = ? AND question_id = ?', [req.user.userId, req.params.qid]);
    if (row) return res.json({ answer: row.answer });
    return res.json({ answer: null });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/cache', async (req: any, res: any) => {
  try {
    const { questionId, answer } = req.body;
    if (!questionId || !answer) return res.status(400).json({ error: 'Missing fields' });
    await db.run('DELETE FROM ai_answer_cache WHERE user_id = ? AND question_id = ?', [req.user.userId, questionId]);
    await db.run('INSERT INTO ai_answer_cache (user_id, question_id, answer) VALUES (?, ?, ?)', [req.user.userId, questionId, answer]);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

