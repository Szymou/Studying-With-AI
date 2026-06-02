# Test favorites and AI endpoints
TOKEN=$(curl -s -X POST http://localhost:7777/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

echo "Token: ${TOKEN:0:20}..."

echo "=== Favorites ==="
curl -s http://localhost:7777/api/favorites \
  -H "Authorization: Bearer $TOKEN"
echo ""

echo "=== AI Config ==="
curl -s http://localhost:7777/api/ai/config \
  -H "Authorization: Bearer $TOKEN"
echo ""
