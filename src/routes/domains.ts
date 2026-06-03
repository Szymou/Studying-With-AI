﻿import express from 'express';
import db from '../db';
import { authMiddleware } from '../auth';

const router = express.Router();

router.use(authMiddleware);

// 获取所有领域
router.get('/', async (req, res) => {
  try {
    const domains = await db.all(
      'SELECT code, name, icon, description, sort_order, is_active FROM tech_domains ORDER BY sort_order'
    );
    res.json(domains);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取领域列表失败' });
  }
});

// 删除领域
router.delete('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const domain = await db.get('SELECT code, name FROM tech_domains WHERE code = ?', [code]);
    if (!domain) {
      return res.status(404).json({ error: '领域不存在' });
    }
    // 不允许删除预设领域
    const presetDomains = ['java', 'go', 'python', 'frontend', 'database', 'devops'];
    if (presetDomains.includes(code.toLowerCase())) {
      return res.status(400).json({ error: '不允许删除预设领域' });
    }
    // 删除领域关联的题目
    await db.run('DELETE FROM questions WHERE tech_domain = ?', [code]);
    await db.run('DELETE FROM custom_questions WHERE tech_domain = ?', [code]);
    await db.run('DELETE FROM user_progress WHERE tech_domain = ?', [code]);
    await db.run('DELETE FROM favorites WHERE tech_domain = ?', [code]);
    // 删除领域本身
    await db.run('DELETE FROM tech_domains WHERE code = ?', [code]);
    res.json({ success: true, message: '领域已删除', code });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '删除领域失败' });
  }
});

export default router;

