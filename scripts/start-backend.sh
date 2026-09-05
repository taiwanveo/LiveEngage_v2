#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

LOGS_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOGS_DIR"

UVICORN_LOG="$LOGS_DIR/uvicorn.log"
TUNNEL_LOG="$LOGS_DIR/cloudflared.log"

echo "=================================================="
echo "  🚀 LiveEngage 本地後台服務啟動程序"
echo "=================================================="

# 1. 檢查並啟動 FastAPI (Uvicorn)
if pgrep -f "uvicorn app.main:app" > /dev/null; then
    echo "🟢 [1/2] FastAPI 後端已在執行中 (port 8000)"
else
    echo "🔄 [1/2] 正在啟動 FastAPI 後端..."
    cd "$PROJECT_ROOT/backend"
    nohup setsid .venv/bin/uvicorn app.main:app --port 8000 --host 0.0.0.0 --reload > "$UVICORN_LOG" 2>&1 &
    cd "$PROJECT_ROOT"
    
    # 等待 FastAPI 啟動
    for i in {1..10}; do
        if curl -s http://localhost:8000/health > /dev/null 2>&1 || curl -s http://localhost:8000/ready > /dev/null 2>&1; then
            echo "✅ FastAPI 後端已成功啟動！(http://localhost:8000)"
            break
        fi
        sleep 1
    done
fi

# 2. 檢查並啟動 Cloudflare Tunnel
CLOUDFLARED_BIN="$(which cloudflared 2>/dev/null || echo "$HOME/.local/bin/cloudflared")"

if [ ! -x "$CLOUDFLARED_BIN" ]; then
    echo "❌ 找不到 cloudflared 執行檔，請確認已安裝於 PATH 或 ~/.local/bin/cloudflared"
    exit 1
fi

TUNNEL_URL=""
if pgrep -f "cloudflared tunnel --url http://localhost:8000" > /dev/null; then
    echo "🟢 [2/2] Cloudflare Tunnel 已在執行中"
    if [ -f "$TUNNEL_LOG" ]; then
        TUNNEL_URL="$(grep -oP 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$TUNNEL_LOG" | tail -n 1 || true)"
    fi
else
    echo "🔄 [2/2] 正在建立 Cloudflare 穿透通道 (trycloudflare.com)..."
    rm -f "$TUNNEL_LOG"
    nohup setsid "$CLOUDFLARED_BIN" tunnel --url http://localhost:8000 > "$TUNNEL_LOG" 2>&1 &
fi

# 若尚未取得 Tunnel URL，等待抓取
if [ -z "$TUNNEL_URL" ]; then
    echo "⏳ 等待 Cloudflare Tunnel 連線..."
    for i in {1..15}; do
        if [ -f "$TUNNEL_LOG" ]; then
            TUNNEL_URL="$(grep -oP 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$TUNNEL_LOG" | tail -n 1 || true)"
            if [ -n "$TUNNEL_URL" ]; then
                break
            fi
        fi
        sleep 1
    done
fi

# 仍為空時的 fallback
if [ -z "$TUNNEL_URL" ] && [ -f "$PROJECT_ROOT/frontend/packages/realtime/src/apiBase.ts" ]; then
    TUNNEL_URL="$(grep -oP 'DEFAULT_PRODUCTION_API_BASE\s*=\s*"\K[^"]+' "$PROJECT_ROOT/frontend/packages/realtime/src/apiBase.ts" || true)"
fi

echo ""
echo "=================================================="
if [ -n "$TUNNEL_URL" ]; then
    echo "🎉 後台服務啟動完成！"
    echo "=================================================="
    echo "📡 本地後端 API : http://localhost:8000"
    echo "🌐 雲端穿透網址 : $TUNNEL_URL"
    echo ""
    echo "💻 前台連結（已自動帶入 API 網址，點擊直接連線）："
    echo "  🔹 主持人端   : https://liveengage-host.pages.dev/?api=$TUNNEL_URL"
    echo "  🔹 投影大螢幕 : https://liveengage-screen.pages.dev/?api=$TUNNEL_URL"
    echo "  🔹 參與者端   : https://liveengage-join.pages.dev/?api=$TUNNEL_URL"
    echo "  🔹 管理員端   : https://liveengage-admin.pages.dev/?api=$TUNNEL_URL"
    echo ""
    echo "💡 提示：在瀏覽器打開上方連結一次後，系統會自動將該 API 網址儲存於瀏覽器。"
else
    echo "⚠️ 未能即時解析出 Tunnel 網址，請檢視 log："
    echo "   tail -n 20 $TUNNEL_LOG"
fi
echo "=================================================="
