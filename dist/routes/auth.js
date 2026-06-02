"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../auth");
const router = express_1.default.Router();
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }
    try {
        const existing = await db_1.default.get('SELECT id FROM users WHERE username = ?', [username]);
        if (existing) {
            return res.status(400).json({ error: '用户名已存在' });
        }
        const passwordHash = await (0, auth_1.hashPassword)(password);
        await db_1.default.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash]);
        res.json({ message: '注册成功，请登录' });
    }
    catch (error) {
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
        const user = await db_1.default.get('SELECT id, username, password_hash FROM users WHERE username = ?', [username]);
        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        const valid = await (0, auth_1.comparePassword)(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        const token = (0, auth_1.generateToken)(user.id, user.username);
        res.json({ token, userId: user.id, username: user.username });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: '登录失败' });
    }
});
exports.default = router;
