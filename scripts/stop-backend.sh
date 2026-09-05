#!/usr/bin/env bash

echo "🛑 正在停止 LiveEngage 本地後端服務..."

pkill -f "uvicorn app.main:app" 2>/dev/null && echo "✅ FastAPI 後端已停止" || echo "ℹ️ FastAPI 未在執行"
pkill -f "cloudflared tunnel --url http://localhost:8000" 2>/dev/null && echo "✅ Cloudflare Tunnel 已停止" || echo "ℹ️ Cloudflare Tunnel 未在執行"

echo "服務已全部停止。"
