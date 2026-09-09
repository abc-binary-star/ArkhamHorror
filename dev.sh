#!/usr/bin/env bash
# 本地开发一键启动：后端（LaunchAgent）+ 前端 vite（daemon 化）+ 开浏览器。
#   ./dev.sh          启动并打开 http://127.0.0.1:8080
#   ./dev.sh status   只看端口状态
#   ./dev.sh stop     停掉本脚本拉起的 vite（不会碰别人的进程和后端）
set -uo pipefail
cd "$(dirname "$0")"
ROOT_DIR="$(pwd)"

API_PORT=3002
WEB_PORT=8080
URL="http://127.0.0.1:${WEB_PORT}"
RUN_DIR=/tmp/arkham-lcg-dev
PID_FILE="$RUN_DIR/vite.pid"
LOG_FILE="$RUN_DIR/vite.log"
LAUNCHD_LABEL="gui/$(id -u)/com.arkhamhorror.lcg"

port_up() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
port_pid() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1; }

cmd_status() {
  echo "后端 API   :$API_PORT  $(port_up $API_PORT && echo "✓ PID $(port_pid $API_PORT)" || echo "✗ 未运行")"
  echo "生产 nginx :3000  $(port_up 3000 && echo "✓（旧构建产物，不含新样式）" || echo "— 未运行")"
  echo "前端 dev   :$WEB_PORT  $(port_up $WEB_PORT && echo "✓ PID $(port_pid $WEB_PORT)" || echo "✗ 未运行")"
}

cmd_stop() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    kill "$(cat "$PID_FILE")" && echo "已停掉本脚本拉起的 vite（PID $(cat "$PID_FILE")）"
    rm -f "$PID_FILE"
  else
    rm -f "$PID_FILE"
    if port_up $WEB_PORT; then
      echo "8080 上的进程（PID $(port_pid $WEB_PORT)）不是本脚本拉起的，没动它。要停请自行 kill。"
    else
      echo "没有本脚本拉起的 vite 在跑。"
    fi
  fi
}

ensure_backend() {
  if port_up $API_PORT; then
    echo "✓ 后端已在 :${API_PORT} （PID $(port_pid $API_PORT)）"
    return
  fi
  echo "… :$API_PORT 没人监听，尝试 kickstart LaunchAgent $LAUNCHD_LABEL"
  launchctl kickstart -k "$LAUNCHD_LABEL" 2>/dev/null
  for _ in $(seq 1 30); do port_up $API_PORT && break; sleep 1; done
  if port_up $API_PORT; then
    echo "✓ 后端已拉起"
  else
    echo "✗ 后端起不来。手动起：cd backend && make api.watch"
  fi
}

ensure_web() {
  if [ ! -d frontend/node_modules ]; then
    echo "… 首次运行，安装前端依赖（约 1-2 分钟）"
    (cd frontend && npm install) || { echo "✗ npm install 失败"; exit 1; }
  fi

  if port_up $WEB_PORT; then
    if [ -f "$PID_FILE" ] && [ "$(cat "$PID_FILE")" = "$(port_pid $WEB_PORT)" ]; then
      echo "✓ 本脚本的 vite 已在 :$WEB_PORT"
    else
      echo "✓ :$WEB_PORT 已有 dev server（PID $(port_pid $WEB_PORT)），直接复用"
    fi
    return
  fi

  echo "… 启动 vite（日志：${LOG_FILE}）"
  mkdir -p "$RUN_DIR"
  # 顶层 & 后台化：`(cd … && npm run dev &)` 的子shell 写法在部分 bash 上
  # 会让 npm 变成前台子进程，脚本卡死在等它退出
  cd "$ROOT_DIR/frontend" || exit 1
  nohup npm run dev >"$LOG_FILE" 2>&1 </dev/null &
  cd "$ROOT_DIR" || exit 1
  for _ in $(seq 1 40); do port_up $WEB_PORT && break; sleep 1; done
  if port_up $WEB_PORT; then
    # 记真正的监听者：npm 包装进程被 kill 时不一定会带走 vite 子进程
    port_pid $WEB_PORT >"$PID_FILE"
    echo "✓ vite 已起（PID $(cat "$PID_FILE")）"
  else
    echo "✗ vite 起不来，看日志：tail -50 $LOG_FILE"
    exit 1
  fi
}

case "${1:-start}" in
  status) cmd_status; exit 0 ;;
  stop)   cmd_stop;   exit 0 ;;
  start)
    ensure_backend
    ensure_web
    cmd_status
    echo
    echo "→ 打开 $URL 验证（hash 路由：$URL/#/sign-in 、$URL/#/decks）"
    # 后台执行：个别环境下 open 会阻塞 LaunchServices 响应，拖住整个脚本
    (open "$URL" >/dev/null 2>&1 &)
    ;;
  *) echo "用法: ./dev.sh [start|status|stop]"; exit 2 ;;
esac
