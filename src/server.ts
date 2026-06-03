import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import db from './db';
import authRoutes from './routes/auth';
import questionRoutes from './routes/questions';
import favoriteRoutes from './routes/favorites';
import customQuestionRoutes from './routes/custom-questions';
import domainRoutes from './routes/domains';
import aiRoutes from './routes/ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 7777;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/custom-questions', customQuestionRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/ai', aiRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 重启服务端点（仅开发/管理用）
app.post('/restart', (req, res) => {
  res.json({ message: '服务即将重启' });
  setTimeout(() => { process.exit(0); }, 500);
});

// 更新 .env 配置
app.post('/api/config/update', (req, res) => {
  try {
    const { ai_api_key, ai_api_base_url, ai_model, port } = req.body;
    const envPath = path.join(__dirname, '../.env');
    let envContent = fs.readFileSync(envPath, 'utf-8');

    if (ai_api_key) {
      envContent = envContent.replace(/^AI_API_KEY=.*/m, 'AI_API_KEY=' + ai_api_key);
    }
    if (ai_api_base_url) {
      envContent = envContent.replace(/^AI_API_BASE_URL=.*/m, 'AI_API_BASE_URL=' + ai_api_base_url);
    }
    if (ai_model) {
      envContent = envContent.replace(/^AI_MODEL=.*/m, 'AI_MODEL=' + ai_model);
    }
    if (port) {
      envContent = envContent.replace(/^PORT=.*/m, 'PORT=' + port);
    }

    fs.writeFileSync(envPath, envContent, 'utf-8');
    res.json({ message: '配置已更新，重启服务后生效', path: envPath });
  } catch (error: any) {
    res.status(500).json({ error: '配置更新失败: ' + error.message });
  }
});

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')));

// 所有未匹配的路由都返回 index.html，支持 SPA 路由（必须在最后）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(Number(PORT), '0.0.0.0', async () => {
  await db.initDb();
  console.log('Server running on http://localhost:' + PORT);
  console.log('API endpoints:');
  console.log('  POST /api/auth/register - 注册');
  console.log('  POST /api/auth/login - 登录');
  console.log('  GET /api/questions - 获取题目列表');
  console.log('  GET /api/questions/random/:count - 随机题目');
  console.log('  POST /api/questions/:id/answer - 提交答案');
  console.log('  GET /api/questions/progress/stats - 学习统计');
  console.log('  POST /api/favorites/:id - 收藏题目');
  console.log('  DELETE /api/favorites/:id - 取消收藏');
  console.log('  GET /api/favorites - 收藏列表');
  console.log('  GET /api/custom-questions - 自定义题目列表');
  console.log('  POST /api/custom-questions - 创建自定义题目');
  console.log('  POST /api/custom-questions/batch - 批量导入');
  console.log('  PUT /api/custom-questions/:id - 更新自定义题目');
  console.log('  DELETE /api/custom-questions/:id - 删除自定义题目');
  console.log('  POST /api/ai/chat/new - 新建AI对话');
  console.log('  POST /api/ai/chat/:id/message - AI咨询');
  console.log('  GET /api/ai/chat/list - 对话列表');
  console.log('  GET /api/domains - 获取技术领域列表');
  console.log('  POST /api/ai/generate - AI生成题目');
});
