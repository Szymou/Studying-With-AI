"use strict";
/**
 * SM-2 间隔重复算法实现
 * 基于 SuperMemo SM-2 (Piotr Woźniak, 1987)
 *
 * 自评 → 质量分映射：
 *   forgot (🔴)     → 1  完全遗忘
 *   hazy   (🟡)     → 3  模糊记得
 *   remembered (🟢) → 5  清晰记得
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SELF_ASSESSMENTS = void 0;
exports.sm2 = sm2;
exports.SELF_ASSESSMENTS = ['forgot', 'hazy', 'remembered'];
const QUALITY_MAP = {
    forgot: 1,
    hazy: 3,
    remembered: 5,
};
/**
 * SM-2 单次复习计算
 * @param assessment  自评等级
 * @param prevInterval  上次间隔（小时），新题传 0
 * @param prevEase      上次 ease factor，新题传 2.5
 * @param prevRepetitions 上次连续答对次数，新题传 0
 */
function sm2(assessment, prevInterval = 0, prevEase = 2.5, prevRepetitions = 0) {
    const quality = QUALITY_MAP[assessment];
    let interval;
    let ease = prevEase;
    let repetitions = prevRepetitions;
    if (quality < 3) {
        // 答错 → 重置
        repetitions = 0;
        interval = 1; // 1 小时后重试
    }
    else {
        // 答对 → SM-2 标准间隔计算
        repetitions++;
        if (repetitions === 1) {
            interval = 1; // 1 小时
        }
        else if (repetitions === 2) {
            interval = 6; // 6 小时
        }
        else {
            interval = Math.round((prevInterval || 1) * ease);
        }
        // 更新 ease factor
        ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        if (ease < 1.3)
            ease = 1.3;
    }
    const nextReviewAt = new Date(Date.now() + interval * 3600000).toISOString();
    return {
        intervalHours: interval,
        easeFactor: Math.round(ease * 100) / 100,
        nextReviewAt,
        passed: quality >= 3,
    };
}
