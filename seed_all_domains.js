const sqlite3 = require('sqlite3');
const path = require('path');
const axios = require('axios');

const dbPath = path.join(__dirname, 'data', 'questions.db');
const db = new sqlite3.Database(dbPath);

const API_KEY = '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';
const BASE_URL = 'https://integrate.api.nvidia.com/v1';
const MODEL = 'mistralai/mistral-small-4-119b-2603';

const DOMAINS = [
  { code: 'go', name: 'Go' },
  { code: 'python', name: 'Python' },
  { code: 'frontend', name: '前端' },
  { code: 'database', name: '数据库' },
  { code: 'devops', name: '运维DevOps' },
];

function run(sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function callAI(messages) {
  const response = await axios.post(
    BASE_URL + '/chat/completions',
    { model: MODEL, messages, temperature: 0.5, stream: false },
    { headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' }, timeout: 600000 }
  );
  if (!response.data?.choices?.[0]?.message?.content) throw new Error('Invalid API response');
  return response.data.choices[0].message.content;
}

async function generateBatch(domain, count, attempt = 1) {
  try {
    const prompt = 'Generate exactly ' + count + ' ' + domain.name + ' technical interview questions and answers. \n\n' +
      'OUTPUT FORMAT: Return ONLY a valid JSON array (no markdown, no code fences, no extra text):\n' +
      '[{"question":"Q text","answer":"A text"}]\n\n' +
      'Requirements:\n' +
      '- Cover various topics within ' + domain.name + '\n' +
      '- Questions should test practical knowledge\n' +
      '- Answers should be concise but accurate (2-5 sentences)\n' +
      '- Include code snippets where relevant\n' +
      '- Questions MUST be in Chinese, answers in Chinese\n' +
      '- Make each question unique and different from typical basic questions';

    const reply = await callAI([
      { role: 'system', content: 'You are a ' + domain.name + ' technical interview question generator. Output ONLY a valid JSON array. No other text.' },
      { role: 'user', content: prompt }
    ]);

    let cleaned = reply.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '')
      .replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start !== -1 && end > start) cleaned = cleaned.substring(start, end + 1);
    
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error('Not array');
    return parsed.filter(q => q.question && q.answer);
  } catch (e) {
    if (attempt < 3) {
      console.log('  ⚠️ Retry ' + attempt + ': ' + e.message.substring(0, 60));
      await new Promise(r => setTimeout(r, 10000 * attempt));
      return generateBatch(domain, count, attempt + 1);
    }
    console.log('  ❌ Failed: ' + e.message.substring(0, 80));
    return [];
  }
}

async function main() {
  console.log('🚀 Generating questions for all domains (batch size: 20)...\n');

  for (const domain of DOMAINS) {
    const existing = await get('SELECT COUNT(*) as cnt FROM questions WHERE tech_domain = ?', [domain.code]);
    let total = existing.cnt;
    console.log('\n📚 ' + domain.name + ' (' + domain.code + '): existing=' + total + ', target=200');

    while (total < 200) {
      const batch = Math.min(20, 200 - total);
      console.log('  Generating ' + batch + ' questions... (progress: ' + total + '/200)');
      
      const questions = await generateBatch(domain, batch);
      
      if (questions.length === 0) {
        console.log('  ⏭️ Got 0, skipping remaining for this domain');
        break;
      }
      
      let inserted = 0;
      for (const q of questions) {
        try {
          await run(
            'INSERT INTO questions (category, subcategory, question, answer, difficulty, tags, tech_domain) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [domain.name + '综合', '种子题', q.question, q.answer, 'medium', 'seed,' + domain.code, domain.code]
          );
          inserted++;
        } catch (err) {}
      }
      total += inserted;
      console.log('  ✅ +' + inserted + ' (total: ' + total + '/200)');
      
      if (inserted === 0) break; // Prevent infinite loop
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('\n\n📊 === Final ===');
  let sum = 0;
  for (const d of [...DOMAINS, { code: 'java', name: 'Java' }]) {
    const c = await get('SELECT COUNT(*) as cnt FROM questions WHERE tech_domain = ?', [d.code]);
    console.log('  ' + d.name + ': ' + c.cnt);
    sum += c.cnt;
  }
  console.log('  Total: ' + sum);
  db.close();
}

main().catch(e => { console.error('Fatal:', e); db.close(); });