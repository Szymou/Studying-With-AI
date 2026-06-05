import express from 'express';
import db from '../db';
import { authMiddleware } from '../auth';

const router = express.Router();

router.use(authMiddleware);

// 获取我的自定义题目列表
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { domain } = req.query;
    let sql = `
      SELECT id, category, subcategory, question, tags, tech_domain, created_at, updated_at
      FROM custom_questions WHERE user_id = ?
    `;
    const params: any[] = [userId];
    if (domain) {
      sql += ' AND tech_domain = ?';
      params.push(domain);
    }
    sql += ' ORDER BY updated_at DESC';

    const questions = await db.all(sql, params);
    res.json(questions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取自定义题目失败' });
  }
});

// 获取单题（含答案）
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const q = await db.get(
      'SELECT * FROM custom_questions WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    if (!q) return res.status(404).json({ error: '题目不存在' });
    res.json(q);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取题目失败' });
  }
});

// 新建自定义题目
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { question, answer, category, subcategory, tags, tech_domain } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ error: '题目和答案为必填项' });
    }

    const result = await db.run(`
      INSERT INTO custom_questions (user_id, category, subcategory, question, answer, tags, tech_domain)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [userId, category || '自定义', subcategory || null, question, answer, tags || null, tech_domain || '']);

    res.json({ id: result.lastID, message: '创建成功' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '创建题目失败' });
  }
});

// 批量导入自定义题目
router.post('/batch', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { questions } = req.body; // [{question, answer, category, subcategory, tags}]

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: '题目列表不能为空' });
    }

    let inserted = 0;
    for (const q of questions) {
      if (!q.question || !q.answer) continue;
      await db.run(`
        INSERT INTO custom_questions (user_id, category, subcategory, question, answer, tags, tech_domain)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [userId, q.category || '自定义', q.subcategory || null, q.question, q.answer, q.tags || null, q.tech_domain || '']);
      inserted++;
    }

    res.json({ inserted, total: questions.length, message: `成功导入${inserted}题` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '批量导入失败' });
  }
});

// 更新自定义题目
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { question, answer, category, subcategory, tags, tech_domain } = req.body;

    const existing = await db.get(
      'SELECT id FROM custom_questions WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    if (!existing) return res.status(404).json({ error: '题目不存在' });

    await db.run(`
      UPDATE custom_questions SET
        question = COALESCE(?, question),
        answer = COALESCE(?, answer),
        category = COALESCE(?, category),
        subcategory = COALESCE(?, subcategory),
        tags = COALESCE(?, tags),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, [question, answer, category, subcategory, tags, req.params.id, userId]);

    res.json({ message: '更新成功' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '更新失败' });
  }
});

// 删除自定义题目
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const existing = await db.get(
      'SELECT id FROM custom_questions WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    if (!existing) return res.status(404).json({ error: '题目不存在' });

    await db.run('DELETE FROM custom_questions WHERE id = ? AND user_id = ?',
      [req.params.id, userId]);

    res.json({ message: '删除成功' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '删除失败' });
  }
});

export default router;
