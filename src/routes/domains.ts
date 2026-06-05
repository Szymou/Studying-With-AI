﻿import express from 'express';
import db from '../db';
import { authMiddleware } from '../auth';

const router = express.Router();

router.use(authMiddleware);

// 获取当前用户的所有领域
router.get('/', async (req, res) => {
  try {
    const domains = await db.all(
      'SELECT code, name, icon, description, sort_order, is_active FROM tech_domains WHERE user_id = ? ORDER BY sort_order',
      [req.user.userId]
    );
    res.json(domains);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取领域列表失败' });
  }
});

// 重新排序领域
router.put('/reorder', async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'order 必须是数组' });
    }
    for (let i = 0; i < order.length; i++) {
      await db.run('UPDATE tech_domains SET sort_order = ? WHERE code = ? AND user_id = ?', [i, order[i], req.user.userId]);
    }
    const domains = await db.all(
      'SELECT code, name, icon, description, sort_order, is_active FROM tech_domains WHERE user_id = ? ORDER BY sort_order',
      [req.user.userId]
    );
    res.json(domains);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '排序更新失败' });
  }
});

// 删除领域（仅删除当前用户的领域记录，不影响共享题目和其他用户）
router.delete('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const domain = await db.get('SELECT code, name, user_id FROM tech_domains WHERE code = ? AND user_id = ?', [code, req.user.userId]);
    if (!domain) {
      return res.status(404).json({ error: '领域不存在或不属于当前用户' });
    }
    // 删除该用户在该领域的进度和收藏
    await db.run('DELETE FROM user_progress WHERE tech_domain = ? AND user_id = ?', [code, req.user.userId]);
    await db.run('DELETE FROM favorites WHERE tech_domain = ? AND user_id = ?', [code, req.user.userId]);
    // 删除领域本身（共享题目保留，不影响其他用户）
    await db.run('DELETE FROM tech_domains WHERE code = ? AND user_id = ?', [code, req.user.userId]);
    res.json({ success: true, message: '领域已删除', code });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '删除领域失败' });
  }
});

export default router;

