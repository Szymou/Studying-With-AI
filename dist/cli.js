#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const inquirer_1 = __importDefault(require("inquirer"));
const axios_1 = __importDefault(require("axios"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const program = new commander_1.Command();
const CONFIG_PATH = path_1.default.join(process.env.HOME || '~', '.java-eight-config.json');
let token = null;
let serverUrl = 'http://localhost:7777';
const loadConfig = () => {
    try {
        if (fs_1.default.existsSync(CONFIG_PATH)) {
            const config = JSON.parse(fs_1.default.readFileSync(CONFIG_PATH, 'utf-8'));
            token = config.token;
            serverUrl = config.serverUrl || serverUrl;
        }
    }
    catch (error) { }
};
const saveConfig = (newToken) => {
    token = newToken;
    fs_1.default.writeFileSync(CONFIG_PATH, JSON.stringify({ token, serverUrl }, null, 2));
};
const api = () => {
    if (!token) {
        console.error('请先登录: npm run cli -- login');
        process.exit(1);
    }
    return axios_1.default.create({
        baseURL: serverUrl,
        headers: { Authorization: `Bearer ${token}` }
    });
};
program
    .name('java-eight')
    .description('Java八股文学习系统CLI')
    .version('1.0.0');
program
    .command('login')
    .description('用户登录')
    .action(async () => {
    const { username, password } = await inquirer_1.default.prompt([
        { type: 'input', name: 'username', message: '用户名:' },
        { type: 'password', name: 'password', message: '密码:' }
    ]);
    try {
        const res = await axios_1.default.post(`${serverUrl}/api/auth/login`, { username, password });
        saveConfig(res.data.token);
        console.log(`登录成功！欢迎 ${res.data.username}`);
    }
    catch (error) {
        console.error('登录失败:', error.response?.data?.error || error.message);
    }
});
program
    .command('register')
    .description('用户注册')
    .action(async () => {
    const { username, password } = await inquirer_1.default.prompt([
        { type: 'input', name: 'username', message: '用户名:' },
        { type: 'password', name: 'password', message: '密码:' }
    ]);
    try {
        await axios_1.default.post(`${serverUrl}/api/auth/register`, { username, password });
        console.log('注册成功！请登录');
    }
    catch (error) {
        console.error('注册失败:', error.response?.data?.error || error.message);
    }
});
program
    .command('practice')
    .description('随机练习题目')
    .option('-c, --count <number>', '题目数量', '5')
    .action(async (options) => {
    const count = parseInt(options.count);
    try {
        const res = await api().get(`/api/questions/random/${count}`);
        const questions = res.data;
        for (const q of questions) {
            console.log(`\n[${q.category}] ${q.question}`);
            const { answer } = await inquirer_1.default.prompt([
                { type: 'input', name: 'answer', message: '你的答案:' }
            ]);
            const result = await api().post(`/api/questions/${q.id}/answer`, { userAnswer: answer });
            if (result.data.isCorrect) {
                console.log('✓ 正确！');
            }
            else {
                console.log(`✗ 错误。正确答案: ${result.data.correctAnswer}`);
            }
        }
        const stats = await api().get('/api/questions/progress/stats');
        console.log(`\n学习进度: 已练习${stats.data.total_attempted}题，正确率${stats.data.accuracy}%`);
    }
    catch (error) {
        console.error('练习失败:', error.response?.data?.error || error.message);
    }
});
program
    .command('exam')
    .description('模拟考试')
    .option('-c, --count <number>', '题目数量', '10')
    .action(async (options) => {
    try {
        const startRes = await api().post('/api/exam/start', { questionCount: parseInt(options.count) });
        const questions = startRes.data.questions;
        console.log(`\n开始考试 (${questions.length}题)`);
        const answers = [];
        for (let i = 0; i < questions.length; i++) {
            console.log(`\n${i + 1}. ${questions[i].question}`);
            const { answer } = await inquirer_1.default.prompt([
                { type: 'input', name: 'answer', message: '答案:' }
            ]);
            answers.push(answer);
        }
        const submitRes = await api().post('/api/exam/submit', { answers });
        console.log(`\n考试成绩: ${submitRes.data.score}分 (满分100)`);
        console.log(`正确: ${submitRes.data.details.filter((d) => d.isCorrect).length}/${submitRes.data.total}`);
    }
    catch (error) {
        console.error('考试失败:', error.response?.data?.error || error.message);
    }
});
program
    .command('stats')
    .description('查看学习统计')
    .action(async () => {
    try {
        const stats = await api().get('/api/questions/progress/stats');
        const history = await api().get('/api/exam/history');
        console.log(`\n学习统计:`);
        console.log(`  已练习题目: ${stats.data.total_attempted}`);
        console.log(`  正确数量: ${stats.data.correct_count}`);
        console.log(`  正确率: ${stats.data.accuracy}%`);
        console.log(`\n最近考试:`);
        for (const record of history.data.slice(0, 5)) {
            console.log(`  ${new Date(record.started_at).toLocaleDateString()}: ${record.score}分`);
        }
    }
    catch (error) {
        console.error('获取统计失败:', error.response?.data?.error || error.message);
    }
});
program
    .command('search')
    .description('搜索题目')
    .option('-c, --category <category>', '分类')
    .option('-k, --keyword <keyword>', '关键词')
    .action(async (options) => {
    try {
        const params = {};
        if (options.category)
            params.category = options.category;
        const res = await api().get('/api/questions', { params });
        let questions = res.data;
        if (options.keyword) {
            questions = questions.filter((q) => q.question.toLowerCase().includes(options.keyword.toLowerCase()));
        }
        if (questions.length === 0) {
            console.log('未找到题目');
            return;
        }
        for (const q of questions.slice(0, 20)) {
            console.log(`\n[${q.category}] ${q.question}`);
            const { showAnswer } = await inquirer_1.default.prompt([
                { type: 'confirm', name: 'showAnswer', message: '显示答案？' }
            ]);
            if (showAnswer) {
                const detail = await api().get(`/api/questions/${q.id}`);
                console.log(`答案: ${detail.data.answer}`);
            }
        }
    }
    catch (error) {
        console.error('搜索失败:', error.response?.data?.error || error.message);
    }
});
loadConfig();
program.parse();
