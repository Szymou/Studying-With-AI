import express from 'express';
import dotenv from 'dotenv';
import db from './db';
import authRoutes from './routes/auth';
import questionRoutes from './routes/questions';
import examRoutes from './routes/exam';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 7777;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exam', examRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, async () => {
  await db.initDb();
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  POST /api/auth/register - 注册`);
  console.log(`  POST /api/auth/login - 登录`);
  console.log(`  GET /api/questions - 获取题目列表`);
  console.log(`  GET /api/questions/random/:count - 随机题目`);
  console.log(`  POST /api/questions/:id/answer - 提交答案`);
  console.log(`  GET /api/questions/progress/stats - 学习统计`);
  console.log(`  POST /api/exam/start - 开始模拟考试`);
  console.log(`  POST /api/exam/submit - 提交考试`);
  console.log(`  GET /api/exam/history - 考试历史`);
});
