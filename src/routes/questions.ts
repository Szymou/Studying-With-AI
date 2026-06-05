﻿import express from 'express';
import db from '../db';
import { authMiddleware } from '../auth';
import { sm2, SELF_ASSESSMENTS } from '../utils/sm2';
import type { SelfAssessment } from '../utils/sm2';

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { category, subcategory, difficulty, domain, limit = 50, offset = 0 } = req.query;
    let sql = `SELECT id, category, subcategory, question, difficulty, tags, tech_domain, 'system' as source FROM questions WHERE 1=1`;
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

    // 不再 UNION ALL，前端分别查两遍再组合
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
    let sSql = `SELECT id, category, subcategory, question, difficulty, tags, tech_domain, 'system' as source FROM questions`;
    let cSql = `SELECT id, category, subcategory, question, NULL as difficulty, tags, tech_domain, 'custom' as source FROM custom_questions`;
    const params: any[] = [];
    if (domain) {
      sSql += ` WHERE tech_domain = ?`;
      cSql += ` WHERE tech_domain = ?`;
      params.push(domain, domain);
    }
    const fullSql = `SELECT * FROM (${sSql} UNION ALL ${cSql}) ORDER BY RANDOM() LIMIT ?`;
    params.push(count);
    const questions = await db.all(fullSql, params);
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
    const { userAnswer, tech_domain, self_assessment } = req.body;
    const userId = req.user.userId;
    const questionId = parseInt(req.params.id);

    const question = await db.get('SELECT answer, tech_domain FROM questions WHERE id = ?', [questionId]);
    if (!question) {
      return res.status(404).json({ error: '题目不存在' });
    }

    const isCorrect = userAnswer && userAnswer.trim().toLowerCase() === question.answer.trim().toLowerCase();

    // 查询上一次的 SM-2 参数
    const lastProgress = await db.get(
      'SELECT review_interval, ease_factor, self_assessment FROM user_progress WHERE user_id = ? AND question_id = ? AND interaction_type = ? ORDER BY answered_at DESC LIMIT 1',
      [userId, questionId, 'answer']
    );

    // 如果传了自评，执行 SM-2 计算
    let sm2Result = null;
    if (self_assessment && SELF_ASSESSMENTS.includes(self_assessment as SelfAssessment)) {
      sm2Result = sm2(
        self_assessment as SelfAssessment,
        lastProgress?.review_interval || 0,
        lastProgress?.ease_factor || 2.5,
        lastProgress?.self_assessment === 'remembered' ? 1 : 0,
      );
    }

    await db.run(
      'INSERT INTO user_progress (user_id, question_id, is_correct, interaction_type, tech_domain, self_assessment, review_interval, ease_factor, next_review_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, questionId, isCorrect, 'answer', tech_domain || question.tech_domain || '',
       self_assessment || null,
       sm2Result?.intervalHours || null,
       sm2Result?.easeFactor || null,
       sm2Result?.nextReviewAt || null]
    );

    res.json({ isCorrect, correctAnswer: question.answer, sm2: sm2Result });
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
      [userId, questionId, 0, 'ai', tech_domain || question.tech_domain || '']
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

    // 待复习数量
    let dueSql = `
      SELECT COUNT(*) as due_count FROM questions q
      INNER JOIN (
        SELECT question_id, MAX(answered_at) as max_at
        FROM user_progress WHERE user_id = ? AND interaction_type = 'answer'
        GROUP BY question_id
      ) latest ON q.id = latest.question_id
      LEFT JOIN user_progress up ON up.user_id = ? AND up.question_id = q.id AND up.answered_at = latest.max_at
      WHERE (up.next_review_at IS NULL OR up.next_review_at <= datetime('now'))
    `;
    const dueParams: any[] = [userId, userId];
    if (domain) {
      dueSql += ' AND q.tech_domain = ?';
      dueParams.push(domain);
    }
    const dueResult = await db.get(dueSql, dueParams);

    res.json({ ...stats, due_count: dueResult?.due_count || 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取统计失败' });
  }
});

// 到期复习题目
router.get('/due', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { domain, limit = 10 } = req.query;

    let sql = `
      SELECT q.id, q.category, q.subcategory, q.question, q.difficulty, q.tags, q.tech_domain,
             up.next_review_at, up.review_interval, up.ease_factor, up.self_assessment as last_assessment
      FROM questions q
      INNER JOIN (
        SELECT question_id, MAX(answered_at) as max_at
        FROM user_progress WHERE user_id = ? AND interaction_type = 'answer'
        GROUP BY question_id
      ) latest ON q.id = latest.question_id
      LEFT JOIN user_progress up ON up.user_id = ? AND up.question_id = q.id AND up.answered_at = latest.max_at
      WHERE (up.next_review_at IS NULL OR up.next_review_at <= datetime('now'))
    `;
    const params: any[] = [userId, userId];

    if (domain) {
      sql += ' AND q.tech_domain = ?';
      params.push(domain);
    }

    sql += ' ORDER BY RANDOM() LIMIT ?';
    params.push(Number(limit));

    const questions = await db.all(sql, params);
    res.json(questions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取到期题目失败' });
  }
});

// 到期复习题目
router.get('/due', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { domain, limit = 10 } = req.query;

    let sql = `
      SELECT q.id, q.category, q.subcategory, q.question, q.difficulty, q.tags, q.tech_domain,
             up.next_review_at, up.review_interval, up.ease_factor, up.self_assessment as last_assessment
      FROM questions q
      INNER JOIN (
        SELECT question_id, MAX(answered_at) as max_at
        FROM user_progress WHERE user_id = ? AND interaction_type = 'answer'
        GROUP BY question_id
      ) latest ON q.id = latest.question_id
      LEFT JOIN user_progress up ON up.user_id = ? AND up.question_id = q.id AND up.answered_at = latest.max_at
      WHERE (up.next_review_at IS NULL OR up.next_review_at <= datetime('now'))
    `;
    const params: any[] = [userId, userId];

    if (domain) {
      sql += ' AND q.tech_domain = ?';
      params.push(domain);
    }

    sql += ' ORDER BY RANDOM() LIMIT ?';
    params.push(Number(limit));

    const questions = await db.all(sql, params);
    res.json(questions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取到期题目失败' });
  }
});

// 删除题目// 删除题目
router.delete('/:id', async (req, res) => {
  try {
    const questionId = parseInt(req.params.id);
    const question = await db.get('SELECT id FROM questions WHERE id = ?', [questionId]);
    if (!question) {
      return res.status(404).json({ error: '题目不存在' });
    }
    await db.run('DELETE FROM questions WHERE id = ?', [questionId]);
    await db.run('DELETE FROM user_progress WHERE question_id = ?', [questionId]);
    await db.run('DELETE FROM favorites WHERE question_id = ? AND source_type = "system"', [questionId]);
    res.json({ success: true, message: '题目已删除' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '删除题目失败' });
  }
});

export default router;

