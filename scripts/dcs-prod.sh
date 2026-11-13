#!/usr/bin/env bash
# ============================================================================
#  dcs-prod.sh — обновление прод-стенда Digital Character Sheets
#
#  Заменяет ручной цикл в корне проекта:
#    git pull && npm ci && npm run build && sudo systemctl restart dcs-prod
#
#  Что делает deploy:
#    1. проверяет, что дерево чистое и ветка та, что ожидается
#    2. git fetch + merge --ff-only (без force, прод не переписываем)
#    3. npm ci и npm run build — только при успехе идём дальше
#    4. sudo systemctl restart dcs-prod
#    5. ждёт 200 от /api/health
#  При падении на любом шаге старая версия остаётся работать: рестарт идёт
#  последним, после успешной сборки.
#
#  Примеры:
#    bash scripts/dcs-prod.sh deploy                  # обновить и перезапустить
#    bash scripts/dcs-prod.sh deploy --skip-build     # только pull + restart
#    bash scripts/dcs-prod.sh deploy --no-restart     # pull + build без рестарта
#    bash scripts/dcs-prod.sh status                  # ветка, коммит, сервис, health
#    bash scripts/dcs-prod.sh logs 200                # журнал сервиса и tail -f
#    bash scripts/dcs-prod.sh restart                 # рестарт без git/build
#
#  Переменные окружения (вместо флагов):
#    DCS_PROD_DIR, DCS_PROD_BRANCH, DCS_PROD_SERVICE, DCS_PROD_HEALTH_URL,
#    DCS_PROD_TIMEOUT
# ============================================================================

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

APP_DIR="${DCS_PROD_DIR:-$(cd "$SCRIPT_DIR/.." && pwd -P)}"
BRANCH="${DCS_PROD_BRANCH:-}"
SERVICE="${DCS_PROD_SERVICE:-dcs-prod}"
HEALTH_URL="${DCS_PROD_HEALTH_URL:-http://127.0.0.1:3000/api/health}"
READY_TIMEOUT="${DCS_PROD_TIMEOUT:-60}"

SKIP_PULL=0
SKIP_BUILD=0
NO_RESTART=0
NO_HEALTH=0
ALLOW_DIRTY=0
COMMAND=""
LOG_LINES=100
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
${C_BOLD}dcs-prod.sh${C_RESET} — прод-стенд Digital Character Sheets (systemd: ${SERVICE})

${C_BOLD}Использование:${C_RESET}
  bash scripts/dcs-prod.sh deploy [флаги]   pull + build + restart + health
  bash scripts/dcs-prod.sh restart          перезапустить сервис без git и build
  bash scripts/dcs-prod.sh status           ветка, коммит, сервис, health
  bash scripts/dcs-prod.sh logs [N]         журнал сервиса (100 строк) и tail -f
  bash scripts/dcs-prod.sh help             эта справка

${C_BOLD}Флаги:${C_RESET}
  -d, --dir PATH        каталог прод-чекаута      (по умолчанию родитель scripts/)
  -b, --branch NAME     ожидаемая ветка           (по умолчанию текущая)
  -s, --service NAME    имя unit'а systemd        (по умолчанию dcs-prod)
      --health-url URL  адрес проверки            (по умолчанию $HEALTH_URL)
      --timeout SEC     сколько ждать health      (по умолчанию $READY_TIMEOUT)
      --skip-pull       не делать git fetch/merge
      --skip-build      не делать npm ci / npm run build
      --no-restart      не перезапускать сервис
      --no-health       не проверять /api/health
      --allow-dirty     не падать на незакоммиченных изменениях
  -h, --help            эта справка

${C_BOLD}Сценарии:${C_RESET}
  после правки конфига без изменения кода — deploy --skip-pull
  обновить код, собрать и проверить, но перезапустить позже — deploy --no-restart
  откатиться: git reset --hard <старый-коммит> && bash scripts/dcs-prod.sh restart
EOF
}

need() {
  local tool="$1" hint="${2:-}"
  command -v "$tool" >/dev/null 2>&1 || die "нужен $tool${hint:+: $hint}"
}

have() { command -v "$1" >/dev/null 2>&1; }

git_repo() { git -C "$APP_DIR" "$@"; }

current_branch() { git_repo rev-parse --abbrev-ref HEAD 2>/dev/null || echo ""; }

is_dirty() { [ -n "$(git_repo status --porcelain 2>/dev/null)" ]; }

unit_exists() {
  # `... | grep -q` под pipefail падал: grep закрывал пайп, systemctl получал
  # SIGPIPE (141) и проверка считалась проваленной. Спрашиваем LoadState.
  [ "$(systemctl show -p LoadState --value "$SERVICE" 2>/dev/null || true)" = "loaded" ]
}

service_state() { systemctl is-active "$SERVICE" 2>/dev/null || true; }

health_ok() {
  have curl || return 1
  curl -fsS -m 2 -o /dev/null "$HEALTH_URL" 2>/dev/null
}

wait_health() {
  local i
  for i in $(seq 1 "$READY_TIMEOUT"); do
    if health_ok; then
      ok "health: $HEALTH_URL отвечает 200 (${i}s)"
      return 0
    fi
    sleep 1
  done
  return 1
}

check_dir() {
  [ -d "$APP_DIR" ] || die "нет каталога $APP_DIR (--dir)"
  [ -e "$APP_DIR/.git" ] || die "$APP_DIR не git-чекаут (--dir)"
}

resolve_branch() {
  local cur
  cur="$(current_branch)"
  [ -n "$cur" ] || die "не удалось определить ветку в $APP_DIR"
  [ "$cur" != "HEAD" ] || die "в $APP_DIR detached HEAD: переключитесь на ветку ($BRANCH) вручную"
  if [ -z "$BRANCH" ]; then
    BRANCH="$cur"
  elif [ "$BRANCH" != "$cur" ]; then
    die "чекаут на ветке '$cur', а запрошена '$BRANCH'. Переключите вручную: git -C $APP_DIR checkout $BRANCH"
  fi
}

preflight() {
  check_dir
  need git "apt-get install -y git"
  if [ "$SKIP_BUILD" -eq 0 ]; then
    need npm "установите Node.js >= 20"
  fi
  [ "$NO_HEALTH" -eq 0 ] && ! have curl && warn "curl не найден — health-проверку пропускаю"
  if ! have systemctl; then
    die "нет systemctl: скрипт рассчитан на systemd-юнит $SERVICE"
  fi
  if [ "$NO_RESTART" -eq 0 ] && ! unit_exists; then
    die "нет юнита $SERVICE.service (см. systemctl list-unit-files; имя задаётся --service)"
  fi
  resolve_branch
}

pull_code() {
  local old new
  old="$(git_repo rev-parse HEAD)"
  step "Обновляю $BRANCH из origin ($APP_DIR)"
  if ! git_repo fetch --prune origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" >/dev/null 2>&1; then
    die "git fetch не удался (нет сети/доступа?). Прод не перезапущен, работает старая версия."
  fi
  if ! git_repo merge --ff-only "origin/$BRANCH" >/dev/null 2>&1; then
    die "merge --ff-only не прошёл: локальная история разошлась с origin/$BRANCH.
Прод не перезапущен, работает старая версия. Разберитесь вручную (git -C $APP_DIR log --oneline origin/$BRANCH..HEAD)."
  fi
  new="$(git_repo rev-parse HEAD)"
  if [ "$old" = "$new" ]; then
    ok "код уже актуален: $(git_repo log -1 --format='%h %s')"
  else
    ok "обновлено $(git_repo log -1 --format='%h %s' "$old") → $(git_repo log -1 --format='%h %s')"
  fi
}

build_app() {
  step "npm ci"
  ( cd "$APP_DIR" && npm ci ) || die "npm ci упал. Прод не перезапущен, работает старая версия."
  step "npm run build"
  ( cd "$APP_DIR" && npm run build ) || die "npm run build упал. Прод не перезапущен, работает старая версия."
  ok "сборка готова"
}

restart_service() {
  step "systemctl restart $SERVICE"
  sudo systemctl restart "$SERVICE" || die "рестарт $SERVICE упал. Смотрите: journalctl -u $SERVICE -n 100"
  sleep 1
  [ "$(service_state)" = "active" ] || die "$SERVICE не active после рестарта. Смотрите: journalctl -u $SERVICE -n 100"
  ok "сервис active"
}

verify_health() {
  [ "$NO_HEALTH" -eq 1 ] && { dim "--no-health: проверку не делаю"; return 0; }
  have curl || { dim "curl не найден: проверку пропускаю"; return 0; }
  step "Проверяю $HEALTH_URL"
  wait_health || die "$HEALTH_URL не ответил 200 за ${READY_TIMEOUT}s. Смотрите: journalctl -u $SERVICE -n 100"
}

print_status() {
  local branch commit state
  branch="$(current_branch)"
  commit="$(git_repo log -1 --format='%h %s' 2>/dev/null || echo 'n/a')"
  state="$(service_state)"
  echo
  printf '%s══ Состояние ══%s\n' "$C_BOLD" "$C_RESET"
  printf '  Каталог : %s\n' "$APP_DIR"
  printf '  Ветка   : %s\n' "${branch:-n/a}"
  printf '  Код     : %s\n' "$commit"
  printf '  Грязно  : %s\n' "$(is_dirty && echo 'да (есть незакоммиченные изменения)' || echo 'нет')"
  printf '  Сервис  : %s (%s)\n' "$SERVICE" "${state:-unknown}"
  if [ "$NO_HEALTH" -eq 0 ] && have curl; then
    if health_ok; then
      printf '  Health  : %s 200\n' "$HEALTH_URL"
    else
      printf '  Health  : %s НЕ отвечает\n' "$HEALTH_URL"
    fi
  fi
  echo
}

print_summary() {
  print_status
  dim "  bash scripts/dcs-prod.sh logs     — журнал и tail -f"
  dim "  bash scripts/dcs-prod.sh restart  — перезапуск без git/build"
}

# Скрипт лежит в том же каталоге, который обновляет: `git merge --ff-only`
# переписывает и его. Если файл внутри APP_DIR, работаем из временной копии,
# иначе bash может дочитать уже изменённый файл на середине.
guard_self_update() {
  [ "$SKIP_PULL" -eq 1 ] && return 0
  [ -n "${DCS_PROD_SELF_COPY:-}" ] && return 0
  local self_path self_dir app_real tmp rc
  self_path="${BASH_SOURCE[0]}"
  self_dir=$(cd "$(dirname "$self_path")" 2>/dev/null && pwd -P) || return 0
  app_real=$(cd "$APP_DIR" 2>/dev/null && pwd -P) || return 0
  [ -n "$app_real" ] || return 0
  case "$self_dir/" in
    "$app_real"/*) ;;
    *) return 0 ;;
  esac
  tmp=$(mktemp "${TMPDIR:-/tmp}/dcs-prod.XXXXXX.sh") \
    || die "не удалось создать временную копию скрипта (TMPDIR=${TMPDIR:-/tmp})"
  cp -p "$self_path" "$tmp" || die "не удалось скопировать скрипт в $tmp"
  chmod 700 "$tmp"
  dim "скрипт лежит внутри $APP_DIR — работаю из копии $tmp, чтобы обновление не переписало его на ходу"
  if DCS_PROD_DIR="$APP_DIR" DCS_PROD_SELF_COPY=1 bash "$tmp" "${ORIG_ARGS[@]}"; then
    rc=0
  else
    rc=$?
  fi
  rm -f "$tmp"
  exit "$rc"
}

cmd_deploy() {
  guard_self_update
  preflight
  if is_dirty && [ "$ALLOW_DIRTY" -eq 0 ]; then
    die "в $APP_DIR есть незакоммиченные изменения:
$(git_repo status --short | sed 's/^/  /')
Закоммитьте/уберите их или запустите с --allow-dirty."
  fi
  [ "$SKIP_PULL" -eq 1 ] && dim "--skip-pull: код не обновляю" || pull_code
  [ "$SKIP_BUILD" -eq 1 ] && dim "--skip-build: npm ci и build пропущены" || build_app
  [ "$NO_RESTART" -eq 1 ] && dim "--no-restart: сервис не перезапускаю" || restart_service
  verify_health
  print_summary
}

cmd_restart() {
  check_dir
  need systemctl "systemd"
  unit_exists || die "нет юнита $SERVICE.service (имя задаётся --service)"
  restart_service
  verify_health
  print_status
}

cmd_status() {
  check_dir
  print_status
}

cmd_logs() {
  need journalctl "systemd"
  journalctl -u "$SERVICE" -n "$LOG_LINES" -f
}

# ── разбор аргументов ───────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    deploy|update|up|restart|status|logs|help)
      COMMAND="$1"; shift ;;
    -d|--dir)        APP_DIR="${2:?--dir требует значение}"; shift 2 ;;
    -b|--branch)     BRANCH="${2:?--branch требует значение}"; shift 2 ;;
    -s|--service)    SERVICE="${2:?--service требует значение}"; shift 2 ;;
    --health-url)    HEALTH_URL="${2:?--health-url требует значение}"; shift 2 ;;
    --timeout)       READY_TIMEOUT="${2:?--timeout требует значение}"; shift 2 ;;
    --skip-pull)     SKIP_PULL=1; shift ;;
    --skip-build)    SKIP_BUILD=1; shift ;;
    --no-restart)    NO_RESTART=1; shift ;;
    --no-health)     NO_HEALTH=1; shift ;;
    --allow-dirty)   ALLOW_DIRTY=1; shift ;;
    -h|--help)       usage; exit 0 ;;
    [0-9]*)          LOG_LINES="$1"; shift ;;
    *)
      if [ -z "$COMMAND" ]; then
        die "Неизвестная команда: $1 (список команд: --help)"
      else
        die "Неизвестный аргумент: $1 (см. --help)"
      fi ;;
  esac
done

COMMAND="${COMMAND:-deploy}"
APP_DIR="${APP_DIR%/}"
[[ "$READY_TIMEOUT" =~ ^[0-9]+$ ]] || die "--timeout должен быть числом секунд"

case "$COMMAND" in
  deploy|update|up) cmd_deploy ;;
  restart)          cmd_restart ;;
  status)           cmd_status ;;
  logs)             cmd_logs ;;
  help)             usage ;;
  *)                die "Неизвестная команда: $COMMAND (см. --help)" ;;
esac
