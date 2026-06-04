/**
 * 应用配置默认值
 * 所有硬编码默认值集中管理
 */

// 预设领域
export const PRESET_DOMAINS = [
  { code: 'java', name: 'Java', icon: '☕', description: 'Java 企业级开发', sortOrder: 1 },
  { code: 'go', name: 'Go', icon: '🐹', description: 'Go 语言开发', sortOrder: 2 },
  { code: 'python', name: 'Python', icon: '🐍', description: 'Python 开发', sortOrder: 3 },
  { code: 'frontend', name: '前端', icon: '⚛️', description: '前端开发', sortOrder: 4 },
  { code: 'database', name: '数据库', icon: '🗄️', description: '数据库技术', sortOrder: 5 },
  { code: 'devops', name: '运维 & DevOps', icon: '🐳', description: '运维与 DevOps', sortOrder: 6 },
];

export const PRESET_DOMAIN_CODES = PRESET_DOMAINS.map(d => d.code);

// 默认 AI 提示词
export const DEFAULT_AI_PROMPTS = [
  {
    key: 'ai_assistant',
    value: '你是一个全栈程序员，用大白话讲技术。回答要通俗易懂，多举生活中的例子，像朋友聊天一样自然，别拽术语。',
    description: 'AI 助手/AI 咨询的系统提示词'
  },
  {
    key: 'ai_generate',
    value: '你是一位{domain}出题老师，用大白话写答案。严格按照要求只输出JSON数组，不要其他内容。',
    description: '生成题目/生成新领域的系统提示词'
  },
  {
    key: 'ai_error_analysis',
    value: '你是一个有耐心的技术导师。用大白话分析用户答错的原因。',
    description: '错误分析的系统提示词'
  },
];

// 默认 TTS 配置
export const DEFAULT_TTS = {
  engine: 'browser',
  rate: '1.0',
  edgeVoice: 'zh-CN-XiaoxiaoNeural',
};

// Edge TTS 可用音色
export const EDGE_TTS_VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', name: 'Xiaoxiao 女声（推荐）' },
  { id: 'zh-CN-YunxiNeural', name: 'Yunxi 男声' },
  { id: 'zh-CN-XiaoyiNeural', name: 'Xiaoyi 女声' },
  { id: 'zh-CN-YunjianNeural', name: 'Yunjian 男声' },
  { id: 'zh-CN-XiaohanNeural', name: 'Xiaohan 女声' },
  { id: 'zh-CN-YunyangNeural', name: 'Yunyang 男声' },
];
