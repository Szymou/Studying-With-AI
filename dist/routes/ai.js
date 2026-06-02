"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../auth");
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const router = express_1.default.Router();
router.use(auth_1.authMiddleware);
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_BASE_URL = process.env.AI_API_BASE_URL || 'https://api.openai.com/v1';
const AI_MODEL = process.env.AI_MODEL || 'gpt-3.5-turbo';
const callAi = async (messages) => {
    if (!AI_API_KEY)
        throw new Error('AI_API_KEY 未配置');
    try {
        const response = await axios_1.default.post(AI_BASE_URL + '/chat/completions', { model: AI_MODEL, messages, temperature: 0.7, stream: false }, { headers: { 'Authorization': 'Bearer ' + AI_API_KEY, 'Content-Type': 'application/json' }, timeout: 60000 });
        return response.data.choices[0].message.content;
    }
    catch (error) {
        throw new Error('AI服务调用失败：' + (error.response?.data?.error?.message || error.message));
    }
};
// ============ AI 流式问答（SSE）- 供前端直接调用 ============
router.post('/ask', async (req, res) => {
    const { question, userAnswer } = req.body;
    if (!question)
        return res.status(400).json({ error: '问题不能为空' });
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (!AI_API_KEY) {
        res.write('data: ' + JSON.stringify({ error: 'AI服务未配置' }) + '\n\n');
        res.write('data: [DONE]\n\n');
        return res.end();
    }
    const systemPrompt = '你是一个Java技术面试辅导专家，精通Java八股文。请用中文回答，**必须包含代码示例**。回答格式：先给出简洁解释，然后提供具体代码用例说明。';
    const userPrompt = userAnswer
        ? '问题：' + question + '\n用户的回答：' + userAnswer + '\n请评价是否正确，并给出标准答案（含代码示例）。'
        : '问题：' + question + '\n请给出详细准确的答案，包含具体代码示例说明原理。';
    try {
        let buffer = '';
        const response = await axios_1.default.post(AI_BASE_URL + '/chat/completions', { model: AI_MODEL, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.7, stream: true }, { headers: { 'Authorization': 'Bearer ' + AI_API_KEY, 'Content-Type': 'application/json' }, responseType: 'stream', timeout: 15000 });
        let fullContent = '';
        let hasData = false;
        response.data.on('data', (chunk) => {
            hasData = true;
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data: '))
                    continue;
                const dataStr = trimmed.slice(6).trim();
                if (dataStr === '[DONE]') {
                    return;
                }
                try {
                    const parsed = JSON.parse(dataStr);
                    const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || parsed.content || '';
                    if (content) {
                        fullContent += content;
                        res.write('data: ' + JSON.stringify({ content }) + '\n\n');
                    }
                }
                catch (e) { }
            }
        });
        response.data.on('end', () => {
            if (!fullContent) {
                // 流式失败 → 非流式重试
                axios_1.default.post(AI_BASE_URL + '/chat/completions', { model: AI_MODEL, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.7, stream: false }, { headers: { 'Authorization': 'Bearer ' + AI_API_KEY, 'Content-Type': 'application/json' }, timeout: 15000 }).then(async (fbRes) => {
                    const text = fbRes.data.choices?.[0]?.message?.content || fbRes.data.choices?.[0]?.text || fbRes.data.content || '';
                    if (text) {
                        res.write('data: ' + JSON.stringify({ content: text }) + '\n\n');
                    }
                    else {
                        await sendLocalAnswer(question, userAnswer, res);
                    }
                    res.write('data: [DONE]\n\n');
                    res.end();
                }).catch(async () => {
                    await sendLocalAnswer(question, userAnswer, res);
                    res.write('data: [DONE]\n\n');
                    res.end();
                });
            }
            else {
                res.write('data: [DONE]\n\n');
                res.end();
            }
        });
        response.data.on('error', async () => {
            await sendLocalAnswer(question, userAnswer, res);
            res.write('data: [DONE]\n\n');
            res.end();
        });
    }
    catch (error) {
        await sendLocalAnswer(question, userAnswer, res);
        res.write('data: [DONE]\n\n');
        res.end();
    }
});
// 内置知识库兜底
async function sendLocalAnswer(question, userAnswer, res) {
    try {
        const dbModule = await Promise.resolve().then(() => __importStar(require('../db')));
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
    }
    catch (e) {
        res.write('data: ' + JSON.stringify({ content: '⚠️ AI服务暂时不可用，请稍后再试。' }) + '\n\n');
    }
}
// ============ AI聊天咨询（支持持续对话） ============
router.post('/chat/new', async (req, res) => {
    try {
        const result = await db_1.default.run('INSERT INTO ai_conversations (user_id, title, messages) VALUES (?, ?, ?)', [req.user.userId, req.body.title || '新对话', '[]']);
        res.json({ id: result.lastID, title: req.body.title || '新对话', messages: [] });
    }
    catch (error) {
        res.status(500).json({ error: '创建对话失败' });
    }
});
router.get('/chat/list', async (req, res) => {
    try {
        const convos = await db_1.default.all('SELECT id, title, created_at, updated_at FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50', [req.user.userId]);
        res.json(convos);
    }
    catch (error) {
        res.status(500).json({ error: '获取对话列表失败' });
    }
});
router.get('/chat/:id', async (req, res) => {
    try {
        const convo = await db_1.default.get('SELECT id, title, messages FROM ai_conversations WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
        if (!convo)
            return res.status(404).json({ error: '对话不存在' });
        res.json({ id: convo.id, title: convo.title, messages: JSON.parse(convo.messages || '[]') });
    }
    catch (error) {
        res.status(500).json({ error: '获取对话失败' });
    }
});
router.post('/chat/:id/message', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message)
            return res.status(400).json({ error: '消息不能为空' });
        const convo = await db_1.default.get('SELECT id, messages FROM ai_conversations WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
        if (!convo)
            return res.status(404).json({ error: '对话不存在' });
        const messages = JSON.parse(convo.messages || '[]');
        messages.push({ role: 'user', content: message });
        const reply = await callAi([{ role: 'system', content: '你是一个Java技术面试辅导专家。' }, ...messages]);
        messages.push({ role: 'assistant', content: reply });
        const firstUserMsg = messages.find((m) => m.role === 'user');
        const title = convo.title || (firstUserMsg ? firstUserMsg.content.substring(0, 30) : 'Java咨询');
        await db_1.default.run('UPDATE ai_conversations SET messages = ?, title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(messages), title, req.params.id]);
        res.json({ reply, messages });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'AI咨询失败' });
    }
});
router.delete('/chat/:id', async (req, res) => {
    try {
        await db_1.default.run('DELETE FROM ai_conversations WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
        res.json({ message: '对话已删除' });
    }
    catch (error) {
        res.status(500).json({ error: '删除失败' });
    }
});
// ============ AI生成题目 ============
router.post('/generate', async (req, res) => {
    try {
        const { topic, count = 5, saveToCustom = true } = req.body;
        if (!topic)
            return res.status(400).json({ error: '请指定主题' });
        const finalCount = Math.min(Math.max(count, 1), 20);
        const prompt = '你是一个Java面试题专家。请生成 ' + finalCount + ' 道关于 "' + topic + '" 的Java面试题。\n\n以JSON数组格式返回：\n[{"question":"问题","answer":"答案"}]\n';
        const reply = await callAi([{ role: 'system', content: '你是一个专业的Java面试题库生成器。请严格按照要求格式返回JSON。' }, { role: 'user', content: prompt }]);
        let generatedQuestions;
        try {
            let cleaned = reply.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
            generatedQuestions = JSON.parse(cleaned);
            if (!Array.isArray(generatedQuestions))
                throw new Error('not array');
        }
        catch (e) {
            return res.json({ parsed: false, raw: reply, message: 'AI返回格式异常' });
        }
        let savedCount = 0;
        if (saveToCustom) {
            for (const q of generatedQuestions) {
                if (!q.question || !q.answer)
                    continue;
                await db_1.default.run('INSERT INTO custom_questions (user_id, category, subcategory, question, answer, tags) VALUES (?, ?, ?, ?, ?, ?)', [req.user.userId, topic, 'AI生成', q.question, q.answer, 'ai-generated']);
                savedCount++;
            }
        }
        res.json({ parsed: true, count: generatedQuestions.length, saved: savedCount, questions: generatedQuestions });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'AI生成失败' });
    }
});
// ============ AI配置状态 ============
router.get('/config', async (req, res) => {
    res.json({
        configured: !!AI_API_KEY,
        base_url: AI_BASE_URL,
        model: AI_MODEL,
        tip: AI_API_KEY ? 'AI服务已配置' : '请在.env中设置AI_API_KEY'
    });
});
exports.default = router;
