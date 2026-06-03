"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../auth");
const router = express_1.default.Router();
router.use(auth_1.authMiddleware);
// 收藏题目
router.post('/:questionId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const questionId = parseInt(req.params.questionId);
        const { sourceType, tech_domain } = req.body; // 'system' or 'custom'
        const existing = await db_1.default.get('SELECT id FROM favorites WHERE user_id = ? AND question_id = ? AND source_type = ?', [userId, questionId, sourceType || 'system']);
        if (existing) {
            return res.json({ message: '已收藏过此题' });
        }
        await db_1.default.run('INSERT INTO favorites (user_id, question_id, source_type, tech_domain) VALUES (?, ?, ?, ?)', [userId, questionId, sourceType || 'system', tech_domain || 'java']);
        res.json({ message: '收藏成功', questionId });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: '收藏失败' });
    }
});
// 取消收藏
router.delete('/:questionId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const questionId = parseInt(req.params.questionId);
        await db_1.default.run('DELETE FROM favorites WHERE user_id = ? AND question_id = ?', [userId, questionId]);
        res.json({ message: '取消收藏成功' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: '取消收藏失败' });
    }
});
// 获取我的收藏列表
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { domain } = req.query;
        let sql = `
      SELECT f.id as fav_id, f.question_id, f.source_type, f.created_at, f.tech_domain,
             COALESCE(q.question, cq.question) as question,
             COALESCE(q.category, cq.category) as category,
             COALESCE(q.subcategory, cq.subcategory) as subcategory,
             COALESCE(q.difficulty, 'custom') as difficulty
      FROM favorites f
      LEFT JOIN questions q ON f.question_id = q.id AND f.source_type = 'system'
      LEFT JOIN custom_questions cq ON f.question_id = cq.id AND f.source_type = 'custom'
      WHERE f.user_id = ?
    `;
        const params = [userId];
        if (domain) {
            sql += ' AND f.tech_domain = ?';
            params.push(domain);
        }
        sql += ' ORDER BY f.created_at DESC';
        const favorites = await db_1.default.all(sql, params);
        res.json(favorites.filter(f => f.question));
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: '获取收藏列表失败' });
    }
});
// 检查某题是否已收藏
router.get('/check/:questionId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const questionId = parseInt(req.params.questionId);
        const fav = await db_1.default.get('SELECT id FROM favorites WHERE user_id = ? AND question_id = ?', [userId, questionId]);
        res.json({ isFavorited: !!fav });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: '查询收藏状态失败' });
    }
});
exports.default = router;
