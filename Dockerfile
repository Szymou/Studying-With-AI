FROM node:20-slim

# 安装 Python + edge-tts（用于 TTS 语音合成）
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --break-system-packages edge-tts \
    && ln -s /usr/bin/python3 /usr/bin/python

WORKDIR /app

# 复制依赖文件并安装
COPY package.json package-lock.json ./
RUN npm ci --only=production || npm install

# 复制源代码并编译
COPY . .
RUN npm run build || true

# 确保 dist 可执行
EXPOSE 7777

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD curl -f http://localhost:7777/health || exit 1

CMD ["node", "dist/server.js"]
