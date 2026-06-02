#!/bin/bash
# 一键启动脚本 - 适用于明天直接运行

cd /home/szymou/workspace/java-eight-part-system

echo "📚 准备题库..."
node seed-questions.js

echo "🚀 启动服务..."
npm run start
