#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import axios from 'axios';
import path from 'path';
import fs from 'fs';

const program = new Command();
const CONFIG_PATH = path.join(process.env.HOME || '~', '.java-eight-config.json');

let token: string | null = null;
let serverUrl = 'http://localhost:7777';

const loadConfig = () => {
  try {
    const configPath = CONFIG_PATH.replace(/^~/, process.env.HOME || '~');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      token = config.token;
      serverUrl = config.serverUrl || serverUrl;
    }
  } catch (error) {}
};

const saveConfig = (newToken: string) => {
  token = newToken;
  const configPath = CONFIG_PATH.replace(/^~/, process.env.HOME || '~');
  fs.writeFileSync(configPath, JSON.stringify({ token, serverUrl }, null, 2));
};

const api = () => {
  if (!token) {
    console.error('请先登录: npm run cli -- login');
    process.exit(1);
  }
  return axios.create({
    baseURL: serverUrl,
    headers: { Authorization: 'Bearer ' + token }
  });
};

program
  .name('java-eight')
  .description('Java八股文学习系统CLI')
  .version('1.0.0');

// ============ 认证 ============
program
  .command('login')
  .description('用户登录')
  .action(async () => {
    const { username, password } = await inquirer.prompt([
      { type: 'input', name: 'username', message: '用户名:' },
      { type: 'password', name: 'password', message: '密码:' }
    ]);
    try {
      const res = await axios.post(serverUrl + '/api/auth/login', { username, password });
      saveConfig(res.data.token);
      console.log('登录成功！欢迎 ' + res.data.username);
    } catch (error: any) {
      console.error('登录失败:', error.response?.data?.error || error.message);
    }
  });

program
  .command('register')
  .description('用户注册')
  .action(async () => {
    const { username, password } = await inquirer.prompt([
      { type: 'input', name: 'username', message: '用户名:' },
      { type: 'password', name: 'password', message: '密码:' }
    ]);
    try {
      await axios.post(serverUrl + '/api/auth/register', { username, password });
      console.log('注册成功！请登录');
    } catch (error: any) {
      console.error('注册失败:', error.response?.data?.error || error.message);
    }
  });

// ============ 练习 ============
program
  .command('practice')
  .description('随机练习题目')
  .option('-c, --count <number>', '题目数量', '5')
  .action(async (options) => {
    const count = parseInt(options.count);
    try {
      const res = await api().get('/api/questions/random/' + count);
      const questions = res.data;
      for (const q of questions) {
        console.log('\n[' + q.category + '] ' + q.question);
        const { answer } = await inquirer.prompt([
          { type: 'input', name: 'answer', message: '你的答案:' }
        ]);
        const result = await api().post('/api/questions/' + q.id + '/answer', { userAnswer: answer });
        if (result.data.isCorrect) {
          console.log('✓ 正确！');
        } else {
          console.log('✗ 错误。正确答案: ' + result.data.correctAnswer);
        }
      }
      const stats = await api().get('/api/questions/progress/stats');
      console.log('\n学习进度: 已练习' + stats.data.total_attempted + '题，正确率' + stats.data.accuracy + '%');
    } catch (error: any) {
      console.error('练习失败:', error.response?.data?.error || error.message);
    }
  });

// ============ 考试 ============
program
  .command('exam')
  .description('模拟考试')
  .option('-c, --count <number>', '题目数量', '10')
  .action(async (options) => {
    try {
      const startRes = await api().post('/api/exam/start', { questionCount: parseInt(options.count) });
      const questions = startRes.data.questions;
      console.log('\n开始考试 (' + questions.length + '题)');
      const answers: string[] = [];
      for (let i = 0; i < questions.length; i++) {
        console.log('\n' + (i + 1) + '. ' + questions[i].question);
        const { answer } = await inquirer.prompt([
          { type: 'input', name: 'answer', message: '答案:' }
        ]);
        answers.push(answer);
      }
      const submitRes = await api().post('/api/exam/submit', { answers });
      console.log('\n考试成绩: ' + submitRes.data.score + '分 (满分100)');
      console.log('正确: ' + submitRes.data.details.filter((d: any) => d.isCorrect).length + '/' + submitRes.data.total);
    } catch (error: any) {
      console.error('考试失败:', error.response?.data?.error || error.message);
    }
  });

// ============ 统计 ============
program
  .command('stats')
  .description('查看学习统计')
  .action(async () => {
    try {
      const stats = await api().get('/api/questions/progress/stats');
      const history = await api().get('/api/exam/history');
      console.log('\n学习统计:');
      console.log('  已练习题目: ' + stats.data.total_attempted);
      console.log('  正确数量: ' + stats.data.correct_count);
      console.log('  正确率: ' + stats.data.accuracy + '%');
      console.log('\n最近考试:');
      for (const record of history.data.slice(0, 5)) {
        console.log('  ' + new Date(record.started_at).toLocaleDateString() + ': ' + record.score + '分');
      }
    } catch (error: any) {
      console.error('获取统计失败:', error.response?.data?.error || error.message);
    }
  });

// ============ 搜索 ============
program
  .command('search')
  .description('搜索题目')
  .option('-c, --category <category>', '分类')
  .option('-k, --keyword <keyword>', '关键词')
  .action(async (options) => {
    try {
      const params: any = {};
      if (options.category) params.category = options.category;
      const res = await api().get('/api/questions', { params });
      let questions = res.data;
      if (options.keyword) {
        questions = questions.filter((q: any) =>
          q.question.toLowerCase().includes(options.keyword.toLowerCase())
        );
      }
      if (questions.length === 0) {
        console.log('未找到题目');
        return;
      }
      for (const q of questions.slice(0, 20)) {
        console.log('\n[' + q.category + '] ' + q.question);
        const { showAnswer } = await inquirer.prompt([
          { type: 'confirm', name: 'showAnswer', message: '显示答案？' }
        ]);
        if (showAnswer) {
          const detail = await api().get('/api/questions/' + q.id);
          console.log('答案: ' + detail.data.answer);
        }
      }
    } catch (error: any) {
      console.error('搜索失败:', error.response?.data?.error || error.message);
    }
  });

// ============ 收藏 ============
program
  .command('favorite')
  .description('管理收藏')
  .action(async () => {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '收藏操作:',
        choices: ['查看收藏列表', '收藏题目', '取消收藏']
      }
    ]);

    if (action === '查看收藏列表') {
      try {
        const res = await api().get('/api/favorites');
        const favs = res.data;
        if (favs.length === 0) {
          console.log('暂无收藏题目');
          return;
        }
        console.log('\n我的收藏（' + favs.length + '题）:');
        for (const f of favs) {
          console.log('  [' + f.category + '] ' + f.question);
        }
      } catch (error: any) {
        console.error('获取收藏失败:', error.response?.data?.error || error.message);
      }
    } else if (action === '收藏题目') {
      const { id, sourceType } = await inquirer.prompt([
        { type: 'input', name: 'id', message: '题目ID:' },
        {
          type: 'list',
          name: 'sourceType',
          message: '题目来源:',
          choices: ['system（系统题库）', 'custom（自定义题库）']
        }
      ]);
      try {
        const src = sourceType.startsWith('system') ? 'system' : 'custom';
        await api().post('/api/favorites/' + id, { sourceType: src });
        console.log('收藏成功！');
      } catch (error: any) {
        console.error('收藏失败:', error.response?.data?.error || error.message);
      }
    } else {
      const { id } = await inquirer.prompt([
        { type: 'input', name: 'id', message: '要取消收藏的题目ID:' }
      ]);
      try {
        await api().delete('/api/favorites/' + id);
        console.log('取消收藏成功！');
      } catch (error: any) {
        console.error('取消收藏失败:', error.response?.data?.error || error.message);
      }
    }
  });

// ============ 自定义题目 ============
program
  .command('custom')
  .description('管理自定义题目')
  .action(async () => {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '自定义题目操作:',
        choices: ['查看列表', '创建题目', '更新题目', '删除题目', '批量导入']
      }
    ]);

    if (action === '查看列表') {
      try {
        const res = await api().get('/api/custom-questions');
        const questions = res.data;
        if (questions.length === 0) {
          console.log('暂无自定义题目');
          return;
        }
        console.log('\n自定义题目（' + questions.length + '题）:');
        for (const q of questions) {
          console.log('  [' + q.id + '] [' + q.category + '] ' + q.question);
        }
      } catch (error: any) {
        console.error('获取失败:', error.response?.data?.error || error.message);
      }
    } else if (action === '创建题目') {
      const { question, answer, category, subcategory, tags } = await inquirer.prompt([
        { type: 'input', name: 'question', message: '题目:' },
        { type: 'input', name: 'answer', message: '答案:' },
        { type: 'input', name: 'category', message: '分类（默认 自定义）:' },
        { type: 'input', name: 'subcategory', message: '子分类:' },
        { type: 'input', name: 'tags', message: '标签（逗号分隔）:' }
      ]);
      try {
        await api().post('/api/custom-questions', {
          question, answer,
          category: category || undefined,
          subcategory: subcategory || undefined,
          tags: tags || undefined
        });
        console.log('创建成功！');
      } catch (error: any) {
        console.error('创建失败:', error.response?.data?.error || error.message);
      }
    } else if (action === '更新题目') {
      const { id, question, answer, category } = await inquirer.prompt([
        { type: 'input', name: 'id', message: '题目ID:' },
        { type: 'input', name: 'question', message: '新题目（留空不修改）:' },
        { type: 'input', name: 'answer', message: '新答案（留空不修改）:' },
        { type: 'input', name: 'category', message: '新分类（留空不修改）:' }
      ]);
      try {
        const body: any = {};
        if (question) body.question = question;
        if (answer) body.answer = answer;
        if (category) body.category = category;
        await api().put('/api/custom-questions/' + id, body);
        console.log('更新成功！');
      } catch (error: any) {
        console.error('更新失败:', error.response?.data?.error || error.message);
      }
    } else if (action === '删除题目') {
      const { id } = await inquirer.prompt([
        { type: 'input', name: 'id', message: '要删除的题目ID:' }
      ]);
      try {
        await api().delete('/api/custom-questions/' + id);
        console.log('删除成功！');
      } catch (error: any) {
        console.error('删除失败:', error.response?.data?.error || error.message);
      }
    } else if (action === '批量导入') {
      const { raw } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'raw',
          message: '以JSON数组格式输入题目，每项包含question和answer:'
        }
      ]);
      try {
        const questions = JSON.parse(raw);
        const res = await api().post('/api/custom-questions/batch', { questions });
        console.log('成功导入' + res.data.inserted + '/' + res.data.total + '题');
      } catch (error: any) {
        console.error('批量导入失败:', error.response?.data?.error || error.message);
      }
    }
  });

// ============ AI咨询 ============
program
  .command('ai-chat')
  .description('AI咨询 — 向AI提问Java技术问题')
  .action(async () => {
    try {
      // 检查AI配置
      const cfg = await api().get('/api/ai/config');
      if (!cfg.data.configured) {
        console.log('⚠ AI服务未配置。请在 .env 中设置:');
        console.log('  AI_API_KEY=your_api_key');
        console.log('  AI_API_BASE_URL=https://api.openai.com/v1');
        console.log('  AI_MODEL=gpt-3.5-turbo');
        return;
      }

      const { question } = await inquirer.prompt([
        { type: 'input', name: 'question', message: '输入你的Java问题（输入exit退出）:' }
      ]);
      if (question === 'exit') return;

      // 创建新对话并发送消息
      const newConvo = await api().post('/api/ai/chat/new', { title: question.substring(0, 30) });
      const convoId = newConvo.data.id;

      console.log('\n🤖 AI思考中...\n');
      const res = await api().post('/api/ai/chat/' + convoId + '/message', { message: question });
      console.log(res.data.reply + '\n');

      // 追问模式
      let continueChat = true;
      while (continueChat) {
        const { followUp } = await inquirer.prompt([
          { type: 'input', name: 'followUp', message: '继续追问（输入exit退出）:' }
        ]);
        if (followUp === 'exit') { continueChat = false; break; }

        console.log('\n🤖 AI思考中...\n');
        const followRes = await api().post('/api/ai/chat/' + convoId + '/message', { message: followUp });
        console.log(followRes.data.reply + '\n');
      }
    } catch (error: any) {
      console.error('AI咨询失败:', error.response?.data?.error || error.message);
    }
  });

// ============ AI生成题目 ============
program
  .command('ai-generate')
  .description('AI生成题目 — 指定主题自动生成八股文题目')
  .option('-t, --topic <topic>', '主题')
  .option('-c, --count <number>', '题目数量', '5')
  .action(async (options) => {
    try {
      const cfg = await api().get('/api/ai/config');
      if (!cfg.data.configured) {
        console.log('⚠ AI服务未配置。请在 .env 中设置 AI_API_KEY');
        return;
      }

      const topic = options.topic || (await inquirer.prompt([
        { type: 'input', name: 'topic', message: '输入主题（如：ConcurrentHashMap、Spring事务、JVM垃圾回收）:' }
      ])).topic;

      const count = options.count || (await inquirer.prompt([
        { type: 'number', name: 'count', message: '生成题目数量（1-20）:', default: 5 }
      ])).count;

      console.log('\n🤖 AI正在生成题目，请稍候...\n');
      const res = await api().post('/api/ai/generate', { topic, count: Number(count) });

      if (res.data.parsed) {
        console.log('✅ AI生成了 ' + res.data.count + ' 道题目');
        console.log('   自动保存到自定义题库: ' + res.data.saved + ' 题\n');
        for (let i = 0; i < res.data.questions.length; i++) {
          const q = res.data.questions[i];
          console.log((i + 1) + '. ' + q.question);
          const { show } = await inquirer.prompt([
            { type: 'confirm', name: 'show', message: '显示答案？' }
          ]);
          if (show) {
            console.log('   答案: ' + q.answer + '\n');
          }
        }
      } else {
        console.log('⚠ AI返回格式异常，原始内容:\n');
        console.log(res.data.raw);
      }
    } catch (error: any) {
      console.error('AI生成失败:', error.response?.data?.error || error.message);
    }
  });

loadConfig();
program.parse();
