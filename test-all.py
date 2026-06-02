#!/usr/bin/env python3
import requests, json

base = 'http://localhost:7777'

# Login
r = requests.post(f'{base}/api/auth/login', json={"username": "test", "password": "***"})
token = r.json()['token']
headers = {'Authorization': f'Bearer {token}'}

# Test endpoints
tests = [
    ('GET', '/api/ai/config'),
    ('GET', '/api/favorites'),
    ('GET', '/health'),
]

for method, path in tests:
    url = f'{base}{path}'
    r = requests.request(method, url, headers=headers, timeout=5)
    print(f'{method} {path}: {r.status_code}')
    if r.status_code == 200:
        data = r.json()
        if isinstance(data, dict):
            print(f'  {json.dumps(data, ensure_ascii=False)[:150]}')
        elif isinstance(data, list):
            print(f'  count={len(data)}')
    elif r.status_code == 401:
        print(f'  Auth error')

# Test AI ask
print('\n=== AI ask ===')
r2 = requests.post(f'{base}/api/ai/ask', headers=headers, json={"question": "Java是值传递还是引用传递？"}, stream=True, timeout=15)
print(f'POST /api/ai/ask: {r2.status_code}')
full = ''
for line in r2.iter_lines():
    if not line: continue
    line = line.decode()
    if not line.startswith('data: '): continue
    data = line[6:]
    if data == '[DONE]': continue
    try:
        p = json.loads(data)
        if p.get('content'):
            full += p['content']
    except: pass
if full:
    print(f'Content: {full[:200]}')
else:
    print(f'Empty response')
    # Read raw
    r3 = requests.post(f'{base}/api/ai/ask', headers=headers, json={"question": "test"}, stream=True, timeout=15)
    raw = ''
    for line in r3.iter_lines():
        if line: raw += line.decode() + '\n'
    print(f'Raw: {raw[:300]}')
