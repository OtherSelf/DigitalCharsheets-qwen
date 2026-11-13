#!/usr/bin/env bash
# ============================================================================
#  dcs-dev.sh — тестовый («дев») сервер Digital Character Sheets в screen
#
#  Что делает:
#    1. git clone / git fetch origin main + reset --hard origin/main
#    2. npm ci — только если изменились package.json / package-lock.json
#    3. поднимает `npm run dev` в detach-сессии screen с уникальным именем
#    4. проверяет, что сервер реально отвечает на выбранном порту
#    5. умеет останавливать/перезапускать и стирать созданные данные (data/)
#
#  По умолчанию: каталог /opt/dcs-dev, порт 3001, сессия screen dcs-dev-3001
#  Запускать можно из любого чекаута, в том числе из самого /opt/dcs-dev: тогда
#  скрипт перезапустится из временной копии, чтобы обновление не переписало файл.
#
#  Примеры:
#    sudo bash scripts/dcs-dev.sh deploy                       # обновить main и запустить
#    sudo bash scripts/dcs-dev.sh deploy --port 3002 -y         # другая копия на 3002
#    sudo bash scripts/dcs-dev.sh deploy --dir /opt/dcs-dev2 --port 3002 --session dcs2
#    bash scripts/dcs-dev.sh status                            # что запущено, какой коммит
#    bash scripts/dcs-dev.sh logs                              # хвост лога + tail -f
#    bash scripts/dcs-dev.sh attach                            # зайти в сессию (Ctrl-A D — выйти)
#    bash scripts/dcs-dev.sh stop                              # погасить сессию и освободить порт
#    bash scripts/dcs-dev.sh restart                           # без git/npm — просто перезапуск
#    sudo bash scripts/dcs-dev.sh reset-data                   # удалить все аккаунты и листы
#    sudo bash scripts/dcs-dev.sh deploy --reset-data -y       # обновить + стереть данные + запуск
#
#  Переменные окружения (вместо флагов):
#    DCS_APP_DIR, DCS_PORT, DCS_HOST, DCS_SCREEN, DCS_BRANCH, DCS_REPO_URL,
#    DCS_LOG_DIR, DCS_NPM_CACHE, DCS_SCREENDIR, DCS_READY_TIMEOUT
# ============================================================================

set -Eeuo pipefail

REPO_URL="${DCS_REPO_URL:-https://github.com/OtherSelf/DigitalCharsheets-qwen}"
BRANCH="${DCS_BRANCH:-main}"
APP_DIR="${DCS_APP_DIR:-/opt/dcs-dev}"
PORT="${DCS_PORT:-3001}"
HOST="${DCS_HOST:-0.0.0.0}"
SESSION="${DCS_SCREEN:-}"
LOG_DIR="${DCS_LOG_DIR:-}"
NPM_CACHE="${DCS_NPM_CACHE:-}"
READY_TIMEOUT="${DCS_READY_TIMEOUT:-120}"
SCREENDIR_OVERRIDE="${DCS_SCREENDIR:-}"

FORCE_INSTALL=0
RESET_DATA=0
ASSUME_YES=0
NO_UPDATE=0
COMMAND=""
ORIG_ARGS=("$@")

# ── вывод ───────────────────────────────────────────────────────────────────
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_RESET=$'\033[0m'; C_DIM=$'\033[2m'; C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_BLUE=$'\033[36m'; C_BOLD=$'\033[1m'
else
  C_RESET=""; C_DIM=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_BOLD=""
fi

step() { printf '%s▶%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
ok()   { printf '%s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()  { printf '%s✗%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }
dim()  { printf '%s%s%s\n' "$C_DIM" "$*" "$C_RESET"; }

usage() {
  cat <<EOF
${C_BOLD}dcs-dev.sh${C_RESET} — дев-сервер Digital Character Sheets в screen

${C_BOLD}Использование:${C_RESET}
  bash scripts/dcs-dev.sh deploy [флаги]     обновить main, поставить зависимости, (пере)запустить
  bash scripts/dcs-dev.sh start  [флаги]     запустить без обновления кода
  bash scripts/dcs-dev.sh restart [флаги]    stop + start (без git и npm)
  bash scripts/dcs-dev.sh stop               остановить сессию screen и освободить порт
  bash scripts/dcs-dev.sh status             состояние: screen, порт, коммит, данные
  bash scripts/dcs-dev.sh logs [N]           показать последние N строк (200) и следить за логом
  bash scripts/dcs-dev.sh attach             подключиться к сессии screen (Ctrl-A D — отцепиться)
  bash scripts/dcs-dev.sh reset-data         удалить ВСЕ аккаунты и листы (каталог data/)
  bash scripts/dcs-dev.sh test               юнит-тесты + smoke по запущенному стенду

${C_BOLD}Флаги:${C_RESET}
  -p, --port PORT       порт дев-сервера                  (по умолчанию 3001)
  -d, --dir PATH        каталог проекта                   (по умолчанию /opt/dcs-dev)
  -s, --session NAME    имя сессии screen                 (по умолчанию dcs-dev-PORT)
  -b, --branch NAME     ветка репозитория                 (по умолчанию main)
      --no-update       не делать git fetch/reset (для deploy)
  -f, --force-install   всегда выполнять npm ci
  -r, --reset-data      удалить data/ перед запуском
  -y, --yes             не спрашивать подтверждение на удаление данных
  -h, --help            эта справка

${C_BOLD}Окружение:${C_RESET} DCS_APP_DIR, DCS_PORT, DCS_HOST (адрес биндинга, 0.0.0.0), DCS_SCREEN, DCS_BRANCH,
           DCS_REPO_URL, DCS_SCREENDIR (каталог сокетов screen), DCS_LOG_DIR, DCS_NPM_CACHE,
           DCS_READY_TIMEOUT (DCS_DATA_DIR стенд не использует: данные всегда в <каталог проекта>/data)

${C_BOLD}Примеры:${C_RESET}
  sudo bash scripts/dcs-dev.sh deploy
  sudo bash scripts/dcs-dev.sh deploy --port 3002 --dir /opt/dcs-dev2 --session dcs2
  sudo bash scripts/dcs-dev.sh deploy --reset-data -y
  bash scripts/dcs-dev.sh status
  bash scripts/dcs-dev.sh test
  bash scripts/dcs-dev.sh logs 500

${C_BOLD}Данные${C_RESET} (аккаунты и листы персонажей) лежат в <каталог проекта>/data.
Дев-сервер слушает 0.0.0.0:PORT — для доступа извне нужен открытый порт в фаерволе
или nginx-proxy. Первая загрузка страницы после старта компилируется ~10-20 с.
EOF
}

# ── утилиты ─────────────────────────────────────────────────────────────────
need() {
  command -v "$1" >/dev/null 2>&1 || die "Не найдено: $1. Установите: $2"
}

have() { command -v "$1" >/dev/null 2>&1; }

port_busy() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1
}

http_ok() {
  local port="$1" url="http://127.0.0.1:$1/login" code=""
  if have curl; then
    code=$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$url" || true)
    case "$code" in
      2??|3??) return 0 ;;
      *) return 1 ;;
    esac
  fi
  # без curl — достаточно, что порт принимает соединения
  port_busy "$port"
}

session_running() {
  screen -ls 2>/dev/null | grep -Eq "[0-9]+\.${SESSION}[[:space:]]"
}

# Убить процессы next из каталога приложения (надёжнее, чем поиск по порту:
# не зависит от netns/ss/lsof, не задевает чужие приложения — сверяем cwd).
kill_next_in_dir() {
  local p cwd pids=""
  for p in $(pgrep -f "next" 2>/dev/null || true); do
    [ "$p" = "$$" ] && continue
    cwd=$(readlink "/proc/$p/cwd" 2>/dev/null || true)
    case "$cwd" in
      "$APP_DIR"|"$APP_DIR"/*) pids="$pids $p" ;;
    esac
  done
  [ -n "$pids" ] || return 1
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true
  sleep 0.5
  # shellcheck disable=SC2086
  kill -9 $pids 2>/dev/null || true
  return 0
}

kill_by_port() {
  local port="$1"
  if have ss; then
    local pid
    pid=$(ss -ltnpH "sport = :$port" 2>/dev/null | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | head -n1)
    [ -n "$pid" ] && kill "$pid" 2>/dev/null && return 0
  fi
  if have lsof; then
    local pid
    pid=$(lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null | head -n1)
    [ -n "$pid" ] && kill "$pid" 2>/dev/null && return 0
  fi
  if have fuser; then
    fuser -k "$port/tcp" 2>/dev/null && return 0
  fi
  # Последний шанс №1: процессы next именно из нашего каталога (путь в cmdline).
  # Никаких «широких» pkill-паттернов вроде "next dev -p $port": такой шаблон
  # может совпасть с чужим shell/скриптом и убить не то.
  pkill -f "$APP_DIR/node_modules/next/dist/bin/next dev" 2>/dev/null && return 0
  pkill -f "$APP_DIR/node_modules/.bin/next dev" 2>/dev/null && return 0

  # Последний шанс №2: процессы next, у которых cwd внутри каталога приложения
  # (работает и в контейнерах без ss/lsof/fuser и с отдельным netns).
  kill_next_in_dir && return 0
  return 1
}

wait_port_free() {
  local i
  for i in $(seq 1 20); do
    port_busy "$PORT" || return 0
    sleep 0.5
  done
  return 1
}

rotate_log() {
  if [ -f "$LOG_FILE" ]; then
    local size
    size=$(wc -c <"$LOG_FILE" | tr -d ' ')
    if [ "${size:-0}" -gt 10485760 ]; then
      mv -f "$LOG_FILE" "$LOG_FILE.1"
      dim "лог был больше 10 МБ, старый сохранён как $LOG_FILE.1"
    fi
  fi
}

confirm() {
  [ "$ASSUME_YES" -eq 1 ] && return 0
  if [ ! -t 0 ]; then
    die "Нужно подтверждение, но терминала нет. Добавьте -y/--yes."
  fi
  printf '%sПродолжить? [y/N] %s' "$C_YELLOW" "$C_RESET"
  local answer=""
  read -r answer || true
  case "$answer" in
    y|Y|yes|YES) return 0 ;;
    *) die "Отменено." ;;
  esac
}

# ── git / npm ───────────────────────────────────────────────────────────────
ensure_repo() {
  if [ -d "$APP_DIR/.git" ]; then
    local remote
    remote=$(git -C "$APP_DIR" remote get-url origin 2>/dev/null || echo "")
    if [ "$remote" != "$REPO_URL" ]; then
      warn "в $APP_DIR другой origin: ${remote:-нет}"
      warn "переключаю origin на $REPO_URL"
      if [ -n "$remote" ]; then
        git -C "$APP_DIR" remote set-url origin "$REPO_URL"
      else
        git -C "$APP_DIR" remote add origin "$REPO_URL"
      fi
    fi
    return 0
  fi
  if [ -e "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR" 2>/dev/null || true)" ]; then
    die "$APP_DIR существует, но это не git-репозиторий. Уберите каталог или укажите другой --dir."
  fi
  step "Клонирую $REPO_URL (ветка $BRANCH) в $APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")" "$APP_DIR"
  # --no-single-branch: shallow-клон иначе тянет только одну ветку, и потом
  # нельзя переключиться на другую (origin/<branch> не существует).
  if ! git clone --branch "$BRANCH" --depth 1 --no-single-branch "$REPO_URL" "$APP_DIR" >/dev/null 2>&1; then
    local available
    available=$(git ls-remote --heads "$REPO_URL" 2>/dev/null | sed 's#.*refs/heads/#  #' | sort | head -20)
    die "не удалось склонировать ветку '$BRANCH' из $REPO_URL${available:+.

Доступные ветки:
$available}"
  fi
  ok "клонировано (ветка $BRANCH)"
}

update_code() {
  [ "$NO_UPDATE" -eq 1 ] && { dim "--no-update: код не обновляю"; return 0; }

  local old new
  old=$(git -C "$APP_DIR" rev-parse HEAD)

  step "Обновляю ветку $BRANCH из $REPO_URL"
  # Явный refspec: работает и для single-branch/shallow-клонов, где
  # remote.origin.fetch настроен только на исходную ветку.
  if ! git -C "$APP_DIR" fetch --prune --depth 1 origin \
      "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" >/dev/null 2>&1; then
    if [ -z "$(git -C "$APP_DIR" ls-remote --heads origin "$BRANCH" 2>/dev/null)" ]; then
      local available
      available=$(git -C "$APP_DIR" ls-remote --heads origin 2>/dev/null | sed 's#.*refs/heads/#  #' | sort | head -20)
      die "ветки '$BRANCH' нет в $REPO_URL${available:+.

Доступные ветки:
$available}"
    fi
    die "git fetch не удался (нет сети/доступа к репозиторию?). Можно запустить с --no-update, чтобы просто перезапустить текущую версию."
  fi

  # Переключение на нужную ветку, если кто-то наковырял локально
  if [ "$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)" != "$BRANCH" ]; then
    warn "был checkout не на $BRANCH — переключаю на $BRANCH"
    # сбрасываем локальные правки, иначе checkout -B упадёт на грязном дереве
    git -C "$APP_DIR" reset --hard -q HEAD || true
    git -C "$APP_DIR" checkout -q -B "$BRANCH" "origin/$BRANCH" \
      || die "не удалось переключиться на ветку $BRANCH (origin/$BRANCH)"
  fi

  git -C "$APP_DIR" reset --hard -q "origin/$BRANCH"
  # удаляем только незакоммиченные НЕигнорируемые файлы; data/ и node_modules не трогаем
  git -C "$APP_DIR" clean -fdq

  new=$(git -C "$APP_DIR" rev-parse HEAD)
  if [ "$old" = "$new" ]; then
    ok "код уже актуален: $(git -C "$APP_DIR" log -1 --format='%h %s')"
  else
    ok "обновлено $(git -C "$APP_DIR" log -1 --format='%h %s' "$old") → $(git -C "$APP_DIR" log -1 --format='%h %s')"
  fi
}

deps_hash() {
  { cat "$APP_DIR/package.json" 2>/dev/null; cat "$APP_DIR/package-lock.json" 2>/dev/null; } | sha256sum | cut -d' ' -f1
}

install_deps() {
  local want current=""
  want=$(deps_hash)
  [ -f "$STAMP_FILE" ] && current=$(cat "$STAMP_FILE" 2>/dev/null || echo "")

  if [ "$FORCE_INSTALL" -eq 0 ] && [ -d "$APP_DIR/node_modules" ] && [ "$want" = "$current" ]; then
    ok "зависимости уже актуальны, npm ci пропускаю (форсировать: -f)"
    return 0
  fi

  step "Ставлю зависимости (npm ci) — это может занять несколько минут"
  local npm_args=(ci --no-audit --no-fund) install_log
  [ -n "$NPM_CACHE" ] && npm_args+=(--cache "$NPM_CACHE")
  install_log="$LOG_DIR/$SESSION.npm-install.log"
  if ! (cd "$APP_DIR" && npm "${npm_args[@]}" 2>&1 | tee "$install_log"); then
    if grep -qE "can only install packages when your package.json and package-lock.json|Missing: .* from lock file" "$install_log" 2>/dev/null; then
      warn "package.json и package-lock.json рассинхронизированы (npm $(npm -v 2>/dev/null), node $(node -v 2>/dev/null))"
      warn "Обычно это значит, что lock собран другим мажором npm, чем на стенде."
      die "исправление в репозитории:
  npm install --package-lock-only --no-audit --no-fund   # и закоммитить package-lock.json
Затем: git pull && bash scripts/dcs-dev.sh deploy -f
Временный обход на стенде (lock в каталоге стенда будет перезаписан):
  cd $APP_DIR && npm install --no-audit --no-fund
Лог: $install_log"
    fi
    if grep -q "EACCES" "$install_log" 2>/dev/null; then
      die "npm ci упал на правах кэша. Запустите: DCS_NPM_CACHE=/opt/dcs-npm-cache bash scripts/dcs-dev.sh deploy
Лог: $install_log"
    fi
    die "npm ci упал (см. вывод выше). Лог: $install_log"
  fi
  echo "$want" >"$STAMP_FILE"
  ok "зависимости установлены"
}

# ── данные ──────────────────────────────────────────────────────────────────
ensure_log_dir() {
  mkdir -p "$LOG_DIR" 2>/dev/null || die "не могу создать $LOG_DIR (запустите через sudo?)"
}

take_lock() {
  have flock || return 0
  exec 9>"$LOCK_FILE" || die "не могу открыть $LOCK_FILE"
  if ! flock -n 9; then
    local holder=""
    have fuser && holder=$(fuser "$LOCK_FILE" 2>/dev/null | tr -s ' ' | sed 's/^ //')
    die "уже выполняется другой запуск${holder:+ (pid $holder)}. Лог: $LOG_FILE. Если процесс завис — bash scripts/dcs-dev.sh stop, затем повторите."
  fi
}

wipe_data() {
  [ -n "$APP_DIR" ] && [ "$APP_DIR" != "/" ] || die "Небезопасный APP_DIR: '$APP_DIR'"
  [ "$DATA_DIR" = "$APP_DIR/data" ] || die "Небезопасный путь данных: '$DATA_DIR'"

  local users=0
  [ -d "$DATA_DIR" ] && users=$(find "$DATA_DIR/users" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')

  warn "Будут удалены ВСЕ данные приложения: $DATA_DIR (сейчас аккаунтов: ${users})"
  confirm

  step "Удаляю $DATA_DIR"
  rm -rf -- "$DATA_DIR"
  mkdir -p "$DATA_DIR"
  # Hello.txt отслеживается git'ом — вернём, чтобы дерево осталось чистым
  git -C "$APP_DIR" checkout -q -- data/Hello.txt 2>/dev/null || true
  ok "данные удалены, каталог $DATA_DIR пуст"
}

# ── запуск/остановка ────────────────────────────────────────────────────────
stop_server() {
  if session_running; then
    step "Останавливаю screen-сессию $SESSION"
    screen -S "$SESSION" -X quit >/dev/null 2>&1 || true
    local i
    for i in $(seq 1 20); do
      session_running || break
      sleep 0.5
    done
    session_running && {
      warn "сессия не закрылась, снимаю принудительно"
      screen -S "$SESSION" -X kill >/dev/null 2>&1 || true
      sleep 1
    }
    ok "сессия остановлена"
  else
    dim "сессия $SESSION не запущена"
  fi

  if port_busy "$PORT"; then
    warn "порт $PORT всё ещё занят — ищу процесс"
    kill_by_port "$PORT" || true
    if ! wait_port_free; then
      die "не удалось освободить порт $PORT. Проверьте вручную: ss -ltnp | grep :$PORT"
    fi
    ok "порт $PORT освобождён"
  fi
}

start_server() {
  need screen "apt-get install -y screen (Debian/Ubuntu) / yum install screen (RHEL)"
  [ -d "$APP_DIR/node_modules" ] || die "нет $APP_DIR/node_modules — сначала bash scripts/dcs-dev.sh deploy"

  if session_running; then
    warn "сессия $SESSION уже запущена — перезапускаю"
    stop_server
  fi
  if port_busy "$PORT"; then
    die "порт $PORT занят другим процессом. Что слушает: ss -ltnp | grep :$PORT"
  fi

  mkdir -p "$LOG_DIR"
  rotate_log
  {
    printf '\n===== %s | %s | port %s | %s =====\n' \
      "$(date -Is)" "$SESSION" "$PORT" "$(git -C "$APP_DIR" log -1 --format='%h %s' 2>/dev/null || echo 'no-git')"
  } >>"$LOG_FILE"

  step "Запускаю npm run dev на $HOST:$PORT в screen-сессии $SESSION"
  # 9>&- — не наследовать fd блокировки: иначе долгоживущая сессия будет
  # держать flock до самого выключения и следующий deploy не сможет стартовать.
  screen -dmS "$SESSION" bash -lc \
    "cd $(printf '%q' "$APP_DIR") && exec npm run dev -- -p $(printf '%q' "$PORT") -H $(printf '%q' "$HOST") >>$(printf '%q' "$LOG_FILE") 2>&1" 9>&-

  # Даём screen до 5 секунд на создание сессии (демон может стартовать не мгновенно)
  local waited=0
  while [ "$waited" -lt 10 ] && ! session_running; do
    sleep 0.5
    waited=$((waited + 1))
  done
  if ! session_running; then
    warn "screen не смог создать сессию '$SESSION'"
    warn "частые причины: (1) недоступен каталог сокетов (/run/screen) — задайте"
    warn "  DCS_SCREENDIR=/tmp/screen-dcs; (2) в контейнере запрещены pty (/dev/ptmx) —"
    warn "  screen там работать не будет, запускайте стенд вручную (npm run dev) или через systemd"
    warn "лог: $LOG_FILE"
    tail -n 20 "$LOG_FILE" 2>/dev/null || true
    die "сессия screen не запущена"
  fi

  step "Жду ответа от http://127.0.0.1:$PORT/login (до ${READY_TIMEOUT}s, первая компиляция небыстрая)"
  local waited=0
  while [ "$waited" -lt "$READY_TIMEOUT" ]; do
    if http_ok "$PORT"; then
      ok "сервер отвечает"
      return 0
    fi
    if ! session_running; then
      warn "сессия screen завершилась, последние строки лога:"
      tail -n 40 "$LOG_FILE" 2>/dev/null || true
      die "дев-сервер не поднялся (см. лог: $LOG_FILE)"
    fi
    sleep 2
    waited=$((waited + 2))
    [ $((waited % 10)) -eq 0 ] && dim "  ... ${waited}s"
  done

  warn "сервер не ответил за ${READY_TIMEOUT}s. Откройте лог: tail -f $LOG_FILE"
  die "проверьте ошибки выше (сессия: screen -ls, лог: $LOG_FILE)"
}

# ── команды ─────────────────────────────────────────────────────────────────
# Скрипт живёт в репозитории, а деплой-каталог — обычно отдельный клон. Но если
# его запустили прямо из APP_DIR (частый случай на сервере), `git reset --hard`
# перепишет файл, который сейчас читает bash. Поэтому в таком случае работаем из
# временной копии: репозиторий обновляется как обычно, а выполнение не рвётся.
guard_self_deploy() {
  [ "$NO_UPDATE" -eq 1 ] && return 0
  [ -n "${DCS_DEV_SELF_COPY:-}" ] && return 0
  local self_path self_dir app_real tmp rc
  self_path="${BASH_SOURCE[0]}"
  self_dir=$(cd "$(dirname "$self_path")" 2>/dev/null && pwd -P) || return 0
  app_real=$(cd "$APP_DIR" 2>/dev/null && pwd -P) || return 0
  [ -n "$app_real" ] || return 0
  case "$self_dir/" in
    "$app_real"/*) ;;
    *) return 0 ;;
  esac
  tmp=$(mktemp "${TMPDIR:-/tmp}/dcs-dev.XXXXXX.sh") \
    || die "не удалось создать временную копию скрипта (TMPDIR=${TMPDIR:-/tmp})"
  cp -p "$self_path" "$tmp" || die "не удалось скопировать скрипт в $tmp"
  chmod 700 "$tmp"
  dim "скрипт лежит внутри $APP_DIR — работаю из копии $tmp, чтобы git reset не оборвал выполнение"
  if DCS_DEV_SELF_COPY=1 bash "$tmp" "${ORIG_ARGS[@]}"; then
    rc=0
  else
    rc=$?
  fi
  rm -f "$tmp"
  exit "$rc"
}

cmd_deploy() {
  need git "apt-get install -y git"
  need npm "установите Node.js >= 20"
  need screen "apt-get install -y screen"
  guard_self_deploy

  ensure_log_dir
  take_lock

  ensure_repo
  update_code
  install_deps
  stop_server
  if [ "$RESET_DATA" -eq 1 ]; then
    wipe_data
  fi
  start_server
  print_summary
}

cmd_start() {
  need screen "apt-get install -y screen"
  ensure_log_dir
  take_lock
  ensure_repo
  start_server
  print_summary
}

cmd_restart() {
  need screen "apt-get install -y screen"
  ensure_log_dir
  take_lock
  stop_server
  start_server
  print_summary
}

cmd_stop() {
  # блокировку намеренно не берём: stop — это путь восстановления,
  # он должен работать даже если предыдущий deploy оставил за собой процесс
  stop_server
  ok "готово"
}

cmd_test() {
  need npm "установите Node.js >= 20"

  [ -d "$APP_DIR" ] || die "Нет каталога $APP_DIR — сначала: bash scripts/dcs-dev.sh deploy"
  [ -d "$APP_DIR/node_modules" ] || die "Нет $APP_DIR/node_modules — сначала: bash scripts/dcs-dev.sh deploy"

  step "юнит-тесты в $APP_DIR"
  ( cd "$APP_DIR" && npm run -s test ) \
    || die "Юнит-тесты упали. Полный вывод: cd $APP_DIR && npm test"
  ok "юнит-тесты пройдены"

  if http_ok "$PORT"; then
    step "smoke по запущенному стенду (http://127.0.0.1:$PORT)"
    # --data-dir: проверяем файлы на диске и удаляем тестовый аккаунт после прогона
    ( cd "$APP_DIR" && node scripts/smoke.mjs -u "http://127.0.0.1:$PORT" --data-dir "$DATA_DIR" ) \
      || die "Smoke-тест упал (лог стенда: $LOG_FILE)"
    ok "smoke пройден, тестовые данные удалены из $DATA_DIR"
  else
    warn "стенд на порту $PORT не отвечает — smoke пропущен"
    dim "запуск: bash scripts/dcs-dev.sh start (или deploy)"
  fi

  ok "проверки завершены"
}

cmd_status() {
  printf '%sКаталог:%s   %s\n' "$C_BOLD" "$C_RESET" "$APP_DIR"
  printf '%sПорт:%s      %s (host %s)\n' "$C_BOLD" "$C_RESET" "$PORT" "$HOST"
  printf '%sScreen:%s    %s\n' "$C_BOLD" "$C_RESET" "$SESSION"
  printf '%sЛог:%s       %s\n' "$C_BOLD" "$C_RESET" "$LOG_FILE"

  if [ -d "$APP_DIR/.git" ] && have git; then
    printf '%sКод:%s       %s %s\n' "$C_BOLD" "$C_RESET" \
      "$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)" \
      "$(git -C "$APP_DIR" log -1 --format='%h %s (%cr)')"
    local dirty
    dirty=$(git -C "$APP_DIR" status --porcelain | wc -l | tr -d ' ')
    [ "$dirty" -gt 0 ] && warn "в рабочем дереве $dirty незакоммиченных изменений"
  else
    printf '%sКод:%s       нет репозитория в %s\n' "$C_BOLD" "$C_RESET" "$APP_DIR"
  fi

  if have screen; then
    if session_running; then
      printf '%sСессия:%s    %sзапущена%s\n' "$C_BOLD" "$C_RESET" "$C_GREEN" "$C_RESET"
    else
      printf '%sСессия:%s    %sне запущена%s\n' "$C_BOLD" "$C_RESET" "$C_YELLOW" "$C_RESET"
    fi
  else
    warn "screen не установлен"
  fi

  if port_busy "$PORT"; then
    printf '%sПорт %s:%s   %sслушает%s\n' "$C_BOLD" "$PORT" "$C_RESET" "$C_GREEN" "$C_RESET"
  else
    printf '%sПорт %s:%s   %sсвободен%s\n' "$C_BOLD" "$PORT" "$C_RESET" "$C_YELLOW" "$C_RESET"
  fi

  if [ -d "$DATA_DIR" ]; then
    local users size
    users=$(find "$DATA_DIR/users" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
    size=$(du -sh "$DATA_DIR" 2>/dev/null | cut -f1)
    printf '%sДанные:%s     %s (аккаунтов: %s, %s)\n' "$C_BOLD" "$C_RESET" "$DATA_DIR" "$users" "$size"
  else
    printf '%sДанные:%s     каталога нет\n' "$C_BOLD" "$C_RESET"
  fi

  if [ -f "$LOG_FILE" ]; then
    echo
    dim "── последние строки лога ──"
    tail -n 12 "$LOG_FILE" 2>/dev/null || true
  fi
}

cmd_logs() {
  local lines="${1:-200}"
  [ -f "$LOG_FILE" ] || die "лога пока нет: $LOG_FILE"
  tail -n "$lines" -f "$LOG_FILE"
}

cmd_attach() {
  session_running || die "сессия $SESSION не запущена (сначала bash scripts/dcs-dev.sh deploy)"
  echo "Отцепиться от сессии: Ctrl-A, затем D"
  screen -r "$SESSION"
}

cmd_reset_data() {
  ensure_log_dir
  take_lock
  local was_running=0
  session_running && was_running=1
  [ "$was_running" -eq 1 ] && stop_server
  wipe_data
  if [ "$was_running" -eq 1 ]; then
    start_server
    print_summary
  else
    ok "сервер не был запущен, данные удалены"
  fi
}

print_summary() {
  echo
  printf '%s══ Готово ══%s\n' "$C_BOLD" "$C_RESET"
  printf '  Каталог : %s\n' "$APP_DIR"
  printf '  Ветка   : %s\n' "$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo n/a)"
  printf '  Код     : %s\n' "$(git -C "$APP_DIR" log -1 --format='%h %s' 2>/dev/null || echo n/a)"
  printf '  URL     : %shttp://<ip-сервера>:%s%s\n' "$C_BOLD" "$PORT" "$C_RESET"
  printf '  Локально: http://127.0.0.1:%s/login\n' "$PORT"
  printf '  Screen  : %s\n' "$SESSION"
  printf '  Лог     : %s\n' "$LOG_FILE"
  echo
  dim "  bash scripts/dcs-dev.sh status        — состояние"
  dim "  bash scripts/dcs-dev.sh logs          — хвост лога (Ctrl-C — выйти)"
  dim "  bash scripts/dcs-dev.sh attach        — зайти в сессию (Ctrl-A D — отцепиться)"
  dim "  bash scripts/dcs-dev.sh stop          — остановить"
  dim "  bash scripts/dcs-dev.sh reset-data    — стереть аккаунты и листы"
}

# ── разбор аргументов ───────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    deploy|update|up|start|restart|stop|status|logs|attach|reset-data|test|check|verify|help)
      COMMAND="$1"; shift ;;
    -p|--port)    PORT="${2:?--port требует значение}"; shift 2 ;;
    -d|--dir)     APP_DIR="${2:?--dir требует значение}"; shift 2 ;;
    -s|--session) SESSION="${2:?--session требует значение}"; shift 2 ;;
    -b|--branch)  BRANCH="${2:?--branch требует значение}"; shift 2 ;;
    --no-update)  NO_UPDATE=1; shift ;;
    -f|--force-install) FORCE_INSTALL=1; shift ;;
    -r|--reset-data)    RESET_DATA=1; shift ;;
    -y|--yes)     ASSUME_YES=1; shift ;;
    -h|--help)    usage; exit 0 ;;
    [0-9]*)       LOG_LINES="$1"; shift ;;   # bash scripts/dcs-dev.sh logs 500
    *)
      if [ -z "$COMMAND" ]; then
        die "Неизвестная команда: $1 (список команд: --help)"
      else
        die "Неизвестный аргумент: $1 (см. --help)"
      fi ;;
  esac
done

COMMAND="${COMMAND:-deploy}"

# ── нормализация и проверки ─────────────────────────────────────────────────
APP_DIR="${APP_DIR%/}"
[ -n "$APP_DIR" ] || die "пустой --dir"
[[ "$PORT" =~ ^[0-9]+$ ]] && [ "$PORT" -ge 1 ] && [ "$PORT" -le 65535 ] \
  || die "порт должен быть числом 1..65535, получено: $PORT"
[ -n "$SESSION" ] || SESSION="dcs-dev-$PORT"
[[ "$SESSION" =~ ^[A-Za-z0-9._-]+$ ]] || die "имя сессии screen: только A-Z a-z 0-9 . _ -"
[ -n "$LOG_DIR" ] || LOG_DIR="$(dirname "$APP_DIR")/dcs-dev-logs"
# В контейнерах /run/screen часто недоступен — даём свой каталог сокетов.
if [ -n "$SCREENDIR_OVERRIDE" ]; then
  export SCREENDIR="${SCREENDIR_OVERRIDE%/}"
  mkdir -p "$SCREENDIR" 2>/dev/null && chmod 700 "$SCREENDIR" 2>/dev/null || true
fi

LOG_FILE="$LOG_DIR/$SESSION.log"
LOCK_FILE="$LOG_DIR/$SESSION.lock"
STAMP_FILE="$LOG_DIR/$SESSION.npm-lock.sha256"
DATA_DIR="$APP_DIR/data"

case "$COMMAND" in
  deploy)  cmd_deploy ;;
  update|up) cmd_deploy ;;
  start)   cmd_start ;;
  restart) cmd_restart ;;
  stop)    cmd_stop ;;
  status)  cmd_status ;;
  logs)    cmd_logs "${LOG_LINES:-200}" ;;
  attach)  cmd_attach ;;
  reset-data) cmd_reset_data ;;
  test|check|verify) cmd_test ;;
  help)    usage ;;
  *)       die "Неизвестная команда: $COMMAND (см. --help)" ;;
esac
