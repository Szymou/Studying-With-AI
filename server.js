const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();

// CORS 中间件 - 允许跨域访问
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 解析 JSON 请求体（必须在所有需要 body 的路由之前）
app.use(express.json());

// AI 配置（从环境变量读取）
const AI_CONFIG = {
  url: process.env.AI_API_BASE_URL ? (process.env.AI_API_BASE_URL + '/chat/completions') : 'http://127.0.0.1:22217/v1/chat/completions',
  model: process.env.AI_MODEL || 'deepseek-default',
  apiKey: process.env.AI_API_KEY || ''
};

// 关键词提取和匹配辅助函数
function extractKeywords(text) {
  // 移除标点符号，按空格分词，过滤掉停用词（常见虚词）
  const stopWords = new Set(['的', '了', '是', '在', '和', '与', '或', '一个', '这个', '那个', '什么', '如何', '为什么', '可以', '会', '能', '有', '被', '把', '给', '让', '从', '到', '对', '对于', '关于', '通过', '使用', '进行', '实现', '提供', '支持', '包括', '基于', '采用', '分为', '例如', '比如']);
  const words = text.toLowerCase().replace(/[，,。？?！!；;：:、]/g, ' ').split(/\s+/);
  return words.filter(w => w.length > 1 && !stopWords.has(w));
}

function keywordMatch(userAnswer, correctAnswer) {
  const userWords = extractKeywords(userAnswer);
  const correctWords = extractKeywords(correctAnswer);
  if (correctWords.length === 0) return false;
  const matchCount = correctWords.filter(cw => userWords.includes(cw)).length;
  const ratio = matchCount / correctWords.length;
  // 如果包含超过70%的核心关键词，认为正确
  return ratio >= 0.7;
}

// AI 咨询接口 - 支持流式输出
app.post('/api/ai/ask', async (req, res) => {
  const { question, userAnswer, stream = false } = req.body;
  if (!question) {
    return res.status(400).json({ error: '问题不能为空' });
  }
  try {
    let prompt = `你是知识渊博的导师，请针对以下问题给出详细、准确的参考答案。要求：
1. 先给出核心答案（一句话概括）
2. 然后展开详细解释，包含具体的例子或实际应用场景（如适用）
3. 如果涉及概念对比，请给出对比说明
4. 整体答案要清晰、有层次，便于理解\n\n问题：${question}`;
    if (userAnswer) {
      prompt += `\n\n用户当前回答：${userAnswer}\n请指出用户回答的不足之处并提供改进建议，同时按上述要求给出完整参考答案。`;
    } else {
      prompt += `\n\n请按上述要求给出标准答案（包含具体用例）。`;
    }

    if (stream) {
      // 流式响应
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const response = await axios.post(AI_CONFIG.url, {
        model: AI_CONFIG.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7,
        stream: true
      }, {
        headers: {
          'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000,
        responseType: 'stream'
      });

      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              res.write('event: done\ndata: [DONE]\n\n');
              res.end();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });

      response.data.on('end', () => {
        res.write('event: done\ndata: [DONE]\n\n');
        res.end();
      });

      response.data.on('error', (err) => {
        console.error('流式响应错误:', err);
        res.write(`data: ${JSON.stringify({ error: '流式传输中断' })}\n\n`);
        res.end();
      });
    } else {
      // 非流式响应（兼容旧逻辑）
      const response = await axios.post(AI_CONFIG.url, {
        model: AI_CONFIG.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      const aiAnswer = response.data.choices[0]?.message?.content;
      if (!aiAnswer) throw new Error('AI返回内容为空');
      res.json({ answer: aiAnswer });
    }
  } catch (error) {
    console.error('AI调用失败:', error.message);
    let errorMsg = 'AI服务暂时不可用';
    if (error.response) {
      console.error('AI响应错误:', JSON.stringify(error.response.data, null, 2));
      errorMsg = `AI服务错误: ${error.response.status}`;
    } else if (error.request) {
      errorMsg = '无法连接到AI服务，请确认服务地址和端口';
    } else {
      errorMsg = `AI请求失败: ${error.message}`;
    }
    if (stream) {
      res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: errorMsg });
    }
  }
});

// 原有的其它代码保持不变，但需要修改提交答案的接口
const PORT = process.env.PORT || 7777;
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_me';

app.use(express.json());

const dbPath = path.join(__dirname, 'data', 'questions.db');
const db = new sqlite3.Database(dbPath);

const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { if (err) reject(err); else resolve(this); });
});
const get = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
});
const all = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
});

const initTables = async () => {
    await run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await run(`CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        subcategory TEXT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        difficulty TEXT,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await run(`CREATE TABLE IF NOT EXISTS user_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL,
        is_correct BOOLEAN NOT NULL,
        answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(question_id) REFERENCES questions(id)
    )`);
    await run(`CREATE TABLE IF NOT EXISTS exam_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        questions TEXT NOT NULL,
        answers TEXT NOT NULL,
        score INTEGER NOT NULL,
        started_at DATETIME NOT NULL,
        completed_at DATETIME NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    const count = await get('SELECT COUNT(*) as cnt FROM questions');
    if (!count.cnt) {
        console.log('Seeding questions...');
        const seed = require('./seed-questions.js');
        // seed-questions.js already executed standalone, but if not, run it here.
    }
};

// Auth
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
    try {
        const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
        if (existing) return res.status(400).json({ error: '用户名已存在' });
        const hash = await bcrypt.hash(password, 10);
        await run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash]);
        res.json({ message: '注册成功' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
    try {
        const user = await get('SELECT id, username, password_hash FROM users WHERE username = ?', [username]);
        if (!user) return res.status(401).json({ error: '用户名或密码错误' });
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: '用户名或密码错误' });
        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, userId: user.id, username: user.username });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const authMiddleware = (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: '未授权' });
    const token = auth.substring(7);
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) { res.status(401).json({ error: 'token无效' }); }
};

// Questions
app.get('/api/questions', authMiddleware, async (req, res) => {
    try {
        const { category, subcategory, difficulty, limit = 50, offset = 0 } = req.query;
        let sql = 'SELECT id, category, subcategory, question, difficulty, tags FROM questions WHERE 1=1';
        const params = [];
        if (category) { sql += ' AND category = ?'; params.push(category); }
        if (subcategory) { sql += ' AND subcategory = ?'; params.push(subcategory); }
        if (difficulty) { sql += ' AND difficulty = ?'; params.push(difficulty); }
        sql += ' ORDER BY id LIMIT ? OFFSET ?';
        params.push(Number(limit), Number(offset));
        const rows = await all(sql, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/questions/random/:count', authMiddleware, async (req, res) => {
    try {
        const count = Math.min(parseInt(req.params.count) || 10, 50);
        const rows = await all(`SELECT id, category, subcategory, question, difficulty, tags FROM questions ORDER BY RANDOM() LIMIT ?`, [count]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/questions/:id', authMiddleware, async (req, res) => {
    try {
        const q = await get(`SELECT id, category, subcategory, question, answer, difficulty, tags FROM questions WHERE id = ?`, [req.params.id]);
        if (!q) return res.status(404).json({ error: '题目不存在' });
        res.json(q);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 题目提示接口 - 返回脱敏答案
app.get('/api/questions/:id/hint', authMiddleware, async (req, res) => {
    try {
        const q = await get('SELECT answer FROM questions WHERE id = ?', [req.params.id]);
        if (!q) return res.status(404).json({ error: '题目不存在' });
        const answer = q.answer;
        let hint = answer;
        if (answer.length <= 6) {
            // 短答案只显示第一个字和最后一个字
            hint = answer[0] + '***' + answer[answer.length - 1];
        } else {
            // 显示前3个字符和后3个字符，中间用***替代
            const prefix = answer.substring(0, 3);
            const suffix = answer.substring(answer.length - 3);
            hint = prefix + '***' + suffix;
        }
        res.json({ hint, fullLength: answer.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/questions/:id/answer', authMiddleware, async (req, res) => {
    try {
        const { userAnswer } = req.body;
        const userId = req.user.userId;
        const questionId = parseInt(req.params.id);
        const q = await get('SELECT answer FROM questions WHERE id = ?', [questionId]);
        if (!q) return res.status(404).json({ error: '题目不存在' });
        // 使用关键词匹配判断答案正确性
        const isCorrect = keywordMatch(userAnswer || '', q.answer);
        await run('INSERT INTO user_progress (user_id, question_id, is_correct) VALUES (?, ?, ?)', [userId, questionId, isCorrect]);
        res.json({ isCorrect, correctAnswer: q.answer });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/questions/progress/stats', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const stats = await get(`SELECT COUNT(DISTINCT question_id) as total_attempted, SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_count, ROUND(AVG(CASE WHEN is_correct = 1 THEN 100 ELSE 0 END), 2) as accuracy FROM user_progress WHERE user_id = ?`, [userId]);
        res.json(stats);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Exam
app.post('/api/exam/start', authMiddleware, async (req, res) => {
    try {
        const { questionCount = 10 } = req.body;
        const count = Math.min(questionCount, 50);
        const questions = await all(`SELECT id, question FROM questions ORDER BY RANDOM() LIMIT ?`, [count]);
        const questionsJson = JSON.stringify(questions.map(q => ({ id: q.id, text: q.question })));
        const started_at = new Date().toISOString();
        const result = await run(`INSERT INTO exam_records (user_id, questions, answers, score, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)`, [req.user.userId, questionsJson, '[]', 0, started_at, '']);
        const examId = result.lastID;
        res.json({ examId, questions });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/exam/submit', authMiddleware, async (req, res) => {
    try {
        const { answers } = req.body;
        const userId = req.user.userId;
        const record = await get(`SELECT id, questions FROM exam_records WHERE user_id = ? AND completed_at = '' ORDER BY started_at DESC LIMIT 1`, [userId]);
        if (!record) return res.status(404).json({ error: '未找到进行中的考试' });
        const questions = JSON.parse(record.questions);
        let score = 0;
        const answerDetails = [];
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const userAnswer = answers[i] || '';
            const correctAnswer = await get('SELECT answer FROM questions WHERE id = ?', [q.id]);
            const isCorrect = userAnswer.trim().toLowerCase() === correctAnswer.answer.trim().toLowerCase();
            if (isCorrect) score++;
            answerDetails.push({
                questionId: q.id,
                question: q.text,
                userAnswer,
                correctAnswer: correctAnswer.answer,
                isCorrect
            });
        }
        const finalScore = Math.round((score / questions.length) * 100);
        await run(`UPDATE exam_records SET answers = ?, score = ?, completed_at = ? WHERE id = ?`, [JSON.stringify(answerDetails), finalScore, new Date().toISOString(), record.id]);
        res.json({ score: finalScore, total: questions.length, details: answerDetails });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/exam/history', authMiddleware, async (req, res) => {
    try {
        const records = await all(`SELECT id, score, started_at, completed_at FROM exam_records WHERE user_id = ? AND completed_at != '' ORDER BY started_at DESC LIMIT 20`, [req.user.userId]);
        res.json(records);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

initTables().then(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}).catch(err => console.error('Init error:', err));
