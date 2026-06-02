"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = __importDefault(require("./db"));
const auth_1 = __importDefault(require("./routes/auth"));
const questions_1 = __importDefault(require("./routes/questions"));
const exam_1 = __importDefault(require("./routes/exam"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 7777;
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api/auth', auth_1.default);
app.use('/api/questions', questions_1.default);
app.use('/api/exam', exam_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.listen(PORT, async () => {
    await db_1.default.initDb();
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
