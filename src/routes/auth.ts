import express from 'express';
import db from '../db';
import { hashPassword, comparePassword, generateToken } from '../auth';
import { PRESET_DOMAINS } from '../config';

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (username.length < 5) {
    return res.status(400).json({ error: '用户名至少 5 个字符' });
  }
  if (/[\u4e00-\u9fa5]/.test(username)) {
    return res.status(400).json({ error: '用户名不能包含中文' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: '密码至少 8 个字符' });
  }

  try {
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    const passwordHash = await hashPassword(password);
    const result = await db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash]);
    const userId = result.lastID;

    // 为新用户创建默认领域
    for (const d of PRESET_DOMAINS) {
      await db.run(
        'INSERT INTO tech_domains (code, name, icon, description, sort_order, user_id) VALUES (?, ?, ?, ?, ?, ?)',
        [d.code, d.name, d.icon, d.description, d.sortOrder, userId]
      );
    }
    console.log(`✅ 为用户 ${username}(id=${userId}) 初始化 ${PRESET_DOMAINS.length} 个默认领域`);

    res.json({ message: '注册成功，请登录' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '注册失败' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  try {
    const user = await db.get('SELECT id, username, password_hash FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = generateToken(user.id, user.username);
    res.json({ token, userId: user.id, username: user.username });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '登录失败' });
  }
});

export default router;
