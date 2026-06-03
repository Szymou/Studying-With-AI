const axios = require('axios');

const API_KEY = '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';
const BASE_URL = 'https://integrate.api.nvidia.com/v1';
const MODEL = 'mistralai/mistral-small-4-119b-2603';

async function callAI(messages) {
  const response = await axios.post(
    BASE_URL + '/chat/completions',
    { model: MODEL, messages, temperature: 0.7, stream: false },
    { headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' }, timeout: 300000 }
  );
  return response.data.choices[0].message.content;
}

async function test() {
  console.time('generate');
  const prompt = `你是一位Go技术面试题专家。请生成3道关于"基础语法"的Go面试题。

要求：
1. 以严格JSON数组格式返回，不要包含任何其他文字说明
2. 格式：[{"question":"问题","answer":"答案"}]
3. 题目要有深度，包含实际开发中的常见问题
4. 答案要准确详细`;

  const reply = await callAI([
    { role: 'system', content: '你是一位专业的Go技术面试题库生成器。请严格按照要求只输出JSON数组，不要输出其他任何内容。' },
    { role: 'user', content: prompt }
  ]);
  console.timeEnd('generate');
  console.log('Reply length:', reply.length);
  console.log('Reply:', reply.substring(0, 300));
}

test().catch(e => console.error(e.message));