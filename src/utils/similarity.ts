/**
 * 字符串相似度工具 — Dice 系数（字符 bigram）
 * 用于 AI 生成题目时的去重校验
 */

/**
 * 将字符串拆分为字符二元组 (bigram) 集合
 * 中英文混合场景下，字符级 bigram 比分词更鲁棒
 */
function toCharBigrams(s: string): Set<string> {
  const cleaned = s
    .replace(/[\s,，。！？、；：""''（）()【】《》\[\]{}#@!?.;:<>\/\\|`~…—\-=+*&^%$￥…·]+/g, '')
    .toLowerCase();
  const bigrams = new Set<string>();
  for (let i = 0; i < cleaned.length - 1; i++) {
    bigrams.add(cleaned.slice(i, i + 2));
  }
  return bigrams;
}

/**
 * Dice 系数：2 × |A ∩ B| / (|A| + |B|)
 * 范围 [0, 1]，值越大越相似
 */
export function diceSimilarity(a: string, b: string): number {
  const bigramsA = toCharBigrams(a);
  const bigramsB = toCharBigrams(b);

  if (bigramsA.size === 0 && bigramsB.size === 0) return 1;
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0;

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

/**
 * 检查新题目是否与已有题目重复
 * @param question      新题目标题
 * @param techDomain    技术领域代码
 * @param db            数据库实例
 * @param threshold     相似度阈值（默认 0.8 = 80%）
 * @returns             重复时返回 { isDuplicate: true, matched: "相似题目原文" }，否则 { isDuplicate: false }
 */
export async function isDuplicateQuestion(
  question: string,
  techDomain: string,
  db: any,
  threshold = 0.8
): Promise<{ isDuplicate: boolean; matched?: string }> {
  // 一次性加载当前领域的所有题目（questions + custom_questions）
  const [systemQuestions, customQuestions] = await Promise.all([
    db.all('SELECT question FROM questions WHERE tech_domain = ?', [techDomain]),
    db.all('SELECT question FROM custom_questions WHERE tech_domain = ?', [techDomain]),
  ]);

  const existingQuestions = [
    ...systemQuestions.map((r: any) => r.question),
    ...customQuestions.map((r: any) => r.question),
  ];

  for (const existing of existingQuestions) {
    if (!existing) continue;
    const sim = diceSimilarity(question, existing);
    if (sim >= threshold) {
      return { isDuplicate: true, matched: existing };
    }
  }

  return { isDuplicate: false };
}
