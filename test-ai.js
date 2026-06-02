#!/usr/bin/env node
const axios = require('axios');

const API_KEY = 'sk-8e7cc64f009481008ae9a4dbf0641637e834c074edb32db0';
const BASE_URL = 'http://127.0.0.1:22217';
const MODEL = 'deepseek-default';

async function test() {
  // Test 1: non-streaming
  console.log('=== Test 1: Non-streaming ===');
  try {
    const res = await axios.post(BASE_URL + '/chat/completions', {
      model: MODEL,
      messages: [
        { role: 'system', content: '你是一个Java技术面试辅导专家。' },
        { role: 'user', content: 'Java是值传递还是引用传递？' }
      ],
      temperature: 0.7,
      stream: false
    }, {
      headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' },
      timeout: 15000
    });
    console.log('Response keys:', Object.keys(res.data));
    console.log('Choices:', JSON.stringify(res.data.choices ? res.data.choices[0] : 'no choices'));
    if (res.data.choices && res.data.choices[0]) {
      const msg = res.data.choices[0].message;
      console.log('Message content length:', msg ? msg.content.length : 0);
      console.log('Content preview:', msg ? msg.content.substring(0, 100) : 'NO MESSAGE');
    }
  } catch (e) {
    console.log('Error:', e.message);
    if (e.response) console.log('Response data:', JSON.stringify(e.response.data).substring(0, 500));
  }

  // Test 2: streaming
  console.log('\n=== Test 2: Streaming ===');
  try {
    const res = await axios.post(BASE_URL + '/chat/completions', {
      model: MODEL,
      messages: [
        { role: 'system', content: '你是一个Java技术面试辅导专家。' },
        { role: 'user', content: 'Java是值传递还是引用传递？请用一句话回答' }
      ],
      temperature: 0.7,
      stream: true
    }, {
      headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' },
      responseType: 'stream',
      timeout: 15000
    });

    let full = '';
    let count = 0;
    res.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(l => l.trim().startsWith('data: '));
      for (const line of lines) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') { console.log('Got [DONE]'); return; }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || '';
          if (content) { full += content; count++; }
        } catch(e) { console.log('Parse error on:', data.substring(0, 80)); }
      }
    });
    res.data.on('end', () => {
      console.log('Stream ended. Chunks:', count);
      console.log('Total content length:', full.length);
      console.log('Content:', full || '(empty)');
    });
    res.data.on('error', (e) => console.log('Stream error:', e.message));

    // Wait for stream to finish
    await new Promise(r => setTimeout(r, 5000));
    console.log('\nAfter wait - content:', full || 'STILL EMPTY');
    console.log('Content length:', full.length);

  } catch (e) {
    console.log('Error:', e.message);
  }
}

test();
