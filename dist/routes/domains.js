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
// 获取所有领域
router.get('/', async (req, res) => {
    try {
        const domains = await db_1.default.all('SELECT code, name, icon, description, sort_order, is_active FROM tech_domains ORDER BY sort_order');
        res.json(domains);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: '获取领域列表失败' });
    }
});
exports.default = router;
