import express from 'express';
import db from '../db';
import { authMiddleware } from '../auth';

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { category, subcategory, difficulty, limit = 50, offset = 0 } = req.query;
    let sql = 'SELECT id, category, subcategory, question, difficulty, tags FROM questions WHERE 1=1';
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
    const questions = await db.all(`
      SELECT id, category, subcategory, question, difficulty, tags
      FROM questions ORDER BY RANDOM() LIMIT ?
    `, [count]);
    res.json(questions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取随机题目失败' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const question = await db.get(`
      SELECT id, category, subcategory, question, answer, difficulty, tags
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
    const { userAnswer } = req.body;
    const userId = req.user.userId;
    const questionId = parseInt(req.params.id);

    const question = await db.get('SELECT answer FROM questions WHERE id = ?', [questionId]);
    if (!question) {
      return res.status(404).json({ error: '题目不存在' });
    }

    const isCorrect = userAnswer && userAnswer.trim().toLowerCase() === question.answer.trim().toLowerCase();

    await db.run(
      'INSERT INTO user_progress (user_id, question_id, is_correct) VALUES (?, ?, ?)',
      [userId, questionId, isCorrect]
    );

    res.json({ isCorrect, correctAnswer: question.answer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '提交答案失败' });
  }
});

router.get('/progress/stats', async (req, res) => {
  try {
    const userId = req.user.userId;
    const stats = await db.get(`
      SELECT 
        COUNT(DISTINCT question_id) as total_attempted,
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
        ROUND(AVG(CASE WHEN is_correct = 1 THEN 100 ELSE 0 END), 2) as accuracy
      FROM user_progress WHERE user_id = ?
    `, [userId]);
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取统计失败' });
  }
});

export default router;
