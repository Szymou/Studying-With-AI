"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_1 = __importDefault(require("./db"));
const auth_1 = __importDefault(require("./routes/auth"));
const questions_1 = __importDefault(require("./routes/questions"));
const favorites_1 = __importDefault(require("./routes/favorites"));
const custom_questions_1 = __importDefault(require("./routes/custom-questions"));
const ai_1 = __importDefault(require("./routes/ai"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 7777;
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api/auth', auth_1.default);
app.use('/api/questions', questions_1.default);
app.use('/api/favorites', favorites_1.default);
app.use('/api/custom-questions', custom_questions_1.default);
app.use('/api/ai', ai_1.default);
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
        const envPath = path_1.default.join(__dirname, '../.env');
        let envContent = fs_1.default.readFileSync(envPath, 'utf-8');
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
        fs_1.default.writeFileSync(envPath, envContent, 'utf-8');
        res.json({ message: '配置已更新，重启服务后生效', path: envPath });
    }
    catch (error) {
        res.status(500).json({ error: '配置更新失败: ' + error.message });
    }
});
app.listen(PORT, async () => {
    await db_1.default.initDb();
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
    console.log('  POST /api/ai/generate - AI生成题目');
});
