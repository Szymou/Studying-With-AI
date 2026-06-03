import express from 'express';
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

export default router;
