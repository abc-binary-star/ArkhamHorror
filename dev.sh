#!/usr/bin/env bash
# 本地开发一键启动：数据库（自建 PG16 :5433）+ 后端（本地构建产物）+ 前端 vite + 开浏览器。
#   ./dev.sh          启动并打开 http://127.0.0.1:8080
#   ./dev.sh status   只看端口状态
#   ./dev.sh stop     停掉本脚本拉起的后端和 vite
set -uo pipefail
cd "$(dirname "$0")"
ROOT_DIR="$(pwd)"

API_PORT=3002
WEB_PORT=8080
PG_PORT=5433
PG_DATA=/opt/homebrew/var/arkham-pg16
PG_BIN=/opt/homebrew/opt/postgresql@16/bin
PG_LOG=/tmp/arkham-pg16.log
API_DIR="$ROOT_DIR/backend/arkham-api"
URL="http://127.0.0.1:${WEB_PORT}"
RUN_DIR=/tmp/arkham-lcg-dev
PID_FILE="$RUN_DIR/vite.pid"
LOG_FILE="$RUN_DIR/vite.log"

port_up() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
port_pid() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | head -1; }

cmd_status() {
  echo "数据库     :$PG_PORT  $(port_up $PG_PORT && echo "✓ PID $(port_pid $PG_PORT)" || echo "✗ 未运行（./dev.sh start 会自动拉起）")"
  echo "后端 API   :$API_PORT  $(port_up $API_PORT && echo "✓ PID $(port_pid $API_PORT)" || echo "✗ 未运行")"
  echo "前端 dev   :$WEB_PORT  $(port_up $WEB_PORT && echo "✓ PID $(port_pid $WEB_PORT)" || echo "✗ 未运行")"
}

cmd_stop() {
  if [ -f "$RUN_DIR/api.pid" ]; then
    api_pid="$(cat "$RUN_DIR/api.pid" 2>/dev/null)"
    if [ -n "${api_pid}" ] && kill -0 "$api_pid" 2>/dev/null; then
      kill "$api_pid" && echo "已停掉本脚本拉起的后端（PID ${api_pid}）"
    fi
    rm -f "$RUN_DIR/api.pid"
  fi
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

ensure_pg() {
  if port_up $PG_PORT; then
    return 0
  fi
  echo "… postgres :$PG_PORT 未运行，尝试启动（${PG_DATA}）"
  LC_ALL=C "${PG_BIN}/pg_ctl" -D "$PG_DATA" -l "$PG_LOG" start >/dev/null 2>&1
  for _ in $(seq 1 10); do port_up $PG_PORT && break; sleep 1; done
  if port_up $PG_PORT; then
    echo "✓ postgres 已起"
  else
    echo "✗ postgres 起不来，看日志：tail -30 $PG_LOG"
    return 1
  fi
}

find_api_bin() {
  # 构建产物路径含工具链哈希（aarch64-osx/ghc-9.x.x），不能写死
  find "$API_DIR/.stack-work" -path "*build/arkham-api/arkham-api" -type f 2>/dev/null | head -1
}

ensure_backend() {
  if port_up $API_PORT; then
    echo "✓ 后端已在 :${API_PORT} （PID $(port_pid $API_PORT)）"
    return
  fi
  ensure_pg || return 1
  API_BIN="$(find_api_bin)"
  if [ -z "${API_BIN}" ]; then
    echo "✗ 未找到后端构建产物。先构建：cd backend && make api.watch"
    return 1
  fi
  echo "… 启动后端（日志：${RUN_DIR}/api.log）"
  mkdir -p "$RUN_DIR"
  # 必须 cd 进项目目录：二进制按相对路径读 config/settings.yml 和 data/
  (
    cd "$API_DIR" || exit 1
    nohup env DEVELOPMENT=true PORT="$API_PORT" \
      DATABASE_URL="postgres://arkham_user@127.0.0.1:${PG_PORT}/arkham-horror-backend" \
      PGHOST=127.0.0.1 PGPORT="$PG_PORT" PGSSLMODE=disable \
      "$API_BIN" >"$RUN_DIR/api.log" 2>&1 </dev/null &
    echo $! >"$RUN_DIR/api.pid"
  )
  for _ in $(seq 1 60); do port_up $API_PORT && break; sleep 1; done
  if port_up $API_PORT; then
    echo "✓ 后端已拉起"
  else
    echo "✗ 后端起不来，看日志：tail -50 $RUN_DIR/api.log"
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
