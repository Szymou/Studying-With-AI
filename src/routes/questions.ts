import express from 'express';
import db from '../db';
import { authMiddleware } from '../auth';

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { category, subcategory, difficulty, domain, limit = 50, offset = 0 } = req.query;
    let sql = 'SELECT id, category, subcategory, question, difficulty, tags, tech_domain FROM questions WHERE 1=1';
    const params: any[] = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (subcategory) {
      sql += ' AND subcategory = ?';
      params.push(subcategory);
    }
    if (difficulty) {
      sql += ' AND difficulty = ?';
      params.push(difficulty);
    }
    if (domain) {
      sql += ' AND tech_domain = ?';
      params.push(domain);
    }

    sql += ' ORDER BY id LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const questions = await db.all(sql, params);
    res.json(questions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取题目失败' });
  }
});

router.get('/random/:count', async (req, res) => {
  try {
    const count = Math.min(parseInt(req.params.count) || 10, 50);
    const { domain } = req.query;
    let sql = 'SELECT id, category, subcategory, question, difficulty, tags, tech_domain FROM questions';
    const params: any[] = [];
    if (domain) {
      sql += ' WHERE tech_domain = ?';
      params.push(domain);
    }
    sql += ' ORDER BY RANDOM() LIMIT ?';
    params.push(count);
    const questions = await db.all(sql, params);
    res.json(questions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取随机题目失败' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const question = await db.get(`
      SELECT id, category, subcategory, question, answer, difficulty, tags, tech_domain
      FROM questions WHERE id = ?
    `, [req.params.id]);
    if (!question) {
      return res.status(404).json({ error: '题目不存在' });
    }
    res.json(question);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取题目失败' });
  }
});

router.post('/:id/answer', async (req, res) => {
  try {
    const { userAnswer, tech_domain } = req.body;
    const userId = req.user.userId;
    const questionId = parseInt(req.params.id);

    const question = await db.get('SELECT answer, tech_domain FROM questions WHERE id = ?', [questionId]);
    if (!question) {
      return res.status(404).json({ error: '题目不存在' });
    }

    const isCorrect = userAnswer && userAnswer.trim().toLowerCase() === question.answer.trim().toLowerCase();

    await db.run(
      'INSERT INTO user_progress (user_id, question_id, is_correct, interaction_type, tech_domain) VALUES (?, ?, ?, ?, ?)',
      [userId, questionId, isCorrect, 'answer', tech_domain || question.tech_domain || 'java']
    );

    res.json({ isCorrect, correctAnswer: question.answer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '提交答案失败' });
  }
});

router.post('/:id/ai', async (req, res) => {
  try {
    const { tech_domain } = req.body;
    const userId = req.user.userId;
    const questionId = parseInt(req.params.id);

    const question = await db.get('SELECT tech_domain FROM questions WHERE id = ?', [questionId]);
    if (!question) {
      return res.status(404).json({ error: '题目不存在' });
    }

    // is_correct 不能为 null！因为数据库是 NOT NULL 约束！
    await db.run(
      'INSERT INTO user_progress (user_id, question_id, is_correct, interaction_type, tech_domain) VALUES (?, ?, ?, ?, ?)',
      [userId, questionId, 0, 'ai', tech_domain || question.tech_domain || 'java']
    );

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '记录AI访问失败' });
  }
});

router.get('/progress/history', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { domain } = req.query;
    let sql = `
      SELECT
        up.id,
        up.question_id,
        up.is_correct,
        up.interaction_type,
        up.answered_at,
        up.tech_domain,
        q.question,
        q.category,
        q.subcategory
      FROM user_progress up
      LEFT JOIN questions q ON up.question_id = q.id
      WHERE up.user_id = ?
    `;
    const params: any[] = [userId];
    if (domain) {
      sql += ' AND up.tech_domain = ?';
      params.push(domain);
    }
    sql += ' ORDER BY up.answered_at DESC LIMIT 100';
    const history = await db.all(sql, params);
    res.json(history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取学习记录失败' });
  }
});

router.get('/progress/stats', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { domain } = req.query;
    let sql = `
      SELECT
        COUNT(DISTINCT question_id) as total_attempted,
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
        ROUND(AVG(CASE WHEN is_correct = 1 THEN 100 ELSE 0 END), 2) as accuracy
      FROM user_progress WHERE user_id = ?
    `;
    const params: any[] = [userId];
    if (domain) {
      sql += ' AND tech_domain = ? AND interaction_type = "answer"';
      params.push(domain);
    } else {
      sql += ' AND interaction_type = "answer"';
    }
    const stats = await db.get(sql, params);
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取统计失败' });
  }
});

export default router;
