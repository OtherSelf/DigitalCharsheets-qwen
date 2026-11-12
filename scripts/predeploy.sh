#!/usr/bin/env bash
# ============================================================================
#  scripts/predeploy.sh — проверки перед разворачиванием DigitalCharsheets
#
#  Прогоняет всё, что имеет смысл проверить ДО деплоя, на этой же машине:
#
#    1/7 lockfile  — npm ci --dry-run: package.json и package-lock.json собраны
#                    одной версией npm (иначе установка на сервере падает)
#    2/7 формат    — prettier --check .: стиль и порядок импортов
#                    (аналог `black --check` / `isort --check`)
#    3/7 линт      — eslint .: hooks, async, React/Next-правила
#                    (next/core-web-vitals + next/typescript), границы
#                    импортов плагинов (scripts/plugins/check-boundaries.mjs)
#                    и актуальность сгенерированного реестра (plugins:check)
#    4/7 typecheck — tsc --noEmit отдельным шагом: падение видно до сборки и не
#                    тонет в выводе next build
#    5/7 unit      — vitest: авторизация, файловое хранилище, экспорт/импорт,
#                    API-роуты (без сети, на временном каталоге данных)
#    6/7 build     — next build (NODE_ENV=production); при EXDEV — повтор с
#                    scripts/lib/fs-rename-fallback.cjs, затем проверка того, что
#                    .next/server/pages/{404,500}.html на месте
#    7/7 smoke     — поднимает `next start` на свободном порту с ВРЕМЕННЫМ
#                    каталогом данных (DCS_DATA_DIR), гоняет по HTTP
#                    scripts/smoke.mjs и гасит сервер
#
#  Реальные ./data, запущенные серверы и открытые порты не затрагиваются.
#
#  Использование:
#    bash scripts/predeploy.sh                  # полный прогон
#    bash scripts/predeploy.sh --skip-build     # без шага 6/7, использовать готовый .next
#    bash scripts/predeploy.sh --skip-smoke     # без шага 7/7
#    bash scripts/predeploy.sh --base-url http://localhost:3001   # только smoke по стенду
#    bash scripts/predeploy.sh --keep           # сохранить временные данные и лог сервера
#
#  Флаги и сценарии: bash scripts/predeploy.sh --help
#  Код возврата: 0 — можно деплоить, 1 — есть падения.
#  Связано: scripts/smoke.mjs, scripts/lib/fs-rename-fallback.cjs, tests/,
#           _RUN_INSTRUCTIONS.md §2.5, _TESTING_UNIT.md
# ============================================================================

set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

SKIP_BUILD=0
SKIP_UNIT=0
SKIP_SMOKE=0
KEEP=0
PORT=""
BASE_URL=""

# ── вывод ───────────────────────────────────────────────────────────────────
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_RESET=$'\033[0m'; C_DIM=$'\033[2m'; C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_BLUE=$'\033[36m'; C_BOLD=$'\033[1m'
else
  C_RESET=""; C_DIM=""; C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_BOLD=""
fi

step() { printf '\n%s▶%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
ok()   { printf '%s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()  { printf '%s✗%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }
dim()  { printf '%s%s%s\n' "$C_DIM" "$*" "$C_RESET"; }

usage() {
  cat <<EOF
${C_BOLD}predeploy.sh${C_RESET} — проверки перед деплоем DigitalCharsheets

${C_BOLD}Использование:${C_RESET}
  bash scripts/predeploy.sh [флаги]

${C_BOLD}Флаги:${C_RESET}
  --skip-build        не выполнять next build (нужен готовый .next/)
  --skip-unit         не выполнять vitest
  --skip-smoke        не поднимать сервер и не выполнять smoke-тест
  --base-url URL      только smoke-тест против УЖЕ запущенного сервера
  -p, --port PORT     порт для временного сервера (по умолчанию свободный)
  --keep              сохранить временный каталог данных и лог сервера
  -h, --help          эта справка

${C_BOLD}Типичные сценарии:${C_RESET}
  bash scripts/predeploy.sh                                   # перед прод-деплоем
  bash scripts/predeploy.sh --skip-build                      # быстрая перепроверка
  bash scripts/predeploy.sh --base-url http://localhost:3001  # проверить дев-стенд
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-build) SKIP_BUILD=1 ;;
    --skip-unit)  SKIP_UNIT=1 ;;
    --skip-smoke) SKIP_SMOKE=1 ;;
    --keep)       KEEP=1 ;;
    --base-url)   shift; BASE_URL="${1:-}"; [ -n "$BASE_URL" ] || die "--base-url требует URL" ;;
    -p|--port)    shift; PORT="${1:-}"; [ -n "$PORT" ] || die "-p требует номер порта" ;;
    -h|--help)    usage; exit 0 ;;
    *) die "Неизвестный флаг: $1 (см. --help)" ;;
  esac
  shift
done

# ── утилиты ─────────────────────────────────────────────────────────────────
need() { command -v "$1" >/dev/null 2>&1 || die "Не найдено: $1. Установите: $2"; }
have() { command -v "$1" >/dev/null 2>&1; }

have node || die "Не найден node. Нужен Node.js 18.18+ (проверено на 24)."
have npm  || die "Не найден npm."

bin() {
  # Локальный бинарник из node_modules, без npx и сетевых запросов.
  local name="$1"
  if [ -x "./node_modules/.bin/$name" ]; then
    echo "./node_modules/.bin/$name"
  else
    echo "$name"
  fi
}

TSC="$(bin tsc)"
VITEST="$(bin vitest)"
NEXT="$(bin next)"
PRETTIER="$(bin prettier)"
ESLINT="$(bin eslint)"

TMP_DIRS=()
SERVER_PID=""
SERVER_LOG=""

cleanup() {
  local code=$?
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 "$SERVER_PID" 2>/dev/null || break
      sleep 0.3
    done
    kill -9 "$SERVER_PID" 2>/dev/null || true
  fi

  if [ "$KEEP" -eq 1 ]; then
    if [ -n "$SERVER_LOG" ] && [ -f "$SERVER_LOG" ]; then
      warn "Лог сервера сохранён: $SERVER_LOG"
    fi
  else
    for dir in "${TMP_DIRS[@]:-}"; do
      [ -n "$dir" ] && rm -rf "$dir"
    done
  fi

  exit "$code"
}
trap cleanup EXIT

free_port() {
  node -e '
    const net = require("net");
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => process.stdout.write(String(port)));
    });
  '
}

wait_for_http() {
  local url="$1" timeout="$2" waited=0
  while [ "$waited" -lt "$timeout" ]; do
    if have curl; then
      if curl -fsS -o /dev/null -m 3 "$url" 2>/dev/null; then return 0; fi
    else
      if node -e '
        fetch(process.argv[1], { signal: AbortSignal.timeout(3000) })
          .then((r) => process.exit(r.ok ? 0 : 1))
          .catch(() => process.exit(1));
      ' "$url" 2>/dev/null; then return 0; fi
    fi
    if [ -n "$SERVER_PID" ] && ! kill -0 "$SERVER_PID" 2>/dev/null; then
      return 1
    fi
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

# ── 0. окружение ────────────────────────────────────────────────────────────
printf '%s%s%s\n' "$C_BOLD" "DigitalCharsheets — проверки перед деплоем" "$C_RESET"
dim "каталог проекта: $APP_DIR"
dim "node $(node -v), npm $(npm -v)"

if [ ! -d node_modules ]; then
  die "Нет node_modules. Сначала: npm ci"
fi

if [ -n "$BASE_URL" ]; then
  # Режим «проверить уже запущенный сервер».
  SKIP_BUILD=1
  SKIP_UNIT=0
  step "smoke: $BASE_URL"
  node scripts/smoke.mjs --base-url "$BASE_URL" || die "Smoke-тест не пройден: $BASE_URL"
  ok "smoke-тест пройден"
  printf '\n%s%s%s\n' "$C_GREEN" "$C_BOLD" "Сервер $BASE_URL отвечает корректно." "$C_RESET"
  exit 0
fi

# ── 1. lockfile ─────────────────────────────────────────────────────────────
# `npm ci` на сервере падает, если lock собран другим мажором npm (например,
# локально npm 11, на сервере npm 10) — проверяем это здесь, а не на деплое.
step "1/7 lockfile (npm ci --dry-run, npm $(npm -v))"
NPM_CI_LOG="$(mktemp "${TMPDIR:-/tmp}/dcs-predeploy-npmci-XXXXXX")"
[ "$KEEP" -eq 1 ] || TMP_DIRS+=("$NPM_CI_LOG")
if ! npm ci --dry-run --no-audit --no-fund >"$NPM_CI_LOG" 2>&1; then
  tail -n 20 "$NPM_CI_LOG"
  die "package.json и package-lock.json рассинхронизированы (npm $(npm -v)).
Похоже, lock собран другой мажорной версией npm. Исправление:
  npm install --package-lock-only --no-audit --no-fund   # и закоммитить package-lock.json
Для повторяемости зафиксируйте версию npm (packageManager или Volta/.nvmrc)."
fi
ok "lockfile в синхроне"

# ── 2. формат ───────────────────────────────────────────────────────────────
# Аналог `black --check`: стиль и порядок импортов не должны «уплывать» между
# прогонами. Падает быстро (< 5 c) и не требует сети.
[ -x ./node_modules/.bin/prettier ] || die "Нет prettier в node_modules. Установите dev-зависимости: npm ci"
step "2/7 формат (prettier --check .)"
"$PRETTIER" --check . || die "Формат нарушен. Запустите: npm run format (или npm run format:check — посмотреть список)"
ok "формат соблюдён"

# ── 3. линт ─────────────────────────────────────────────────────────────────
# Ошибки ESLint — блокер. Предупреждения (известные exhaustive-deps и
# неиспользуемые переменные) печатаются, но деплой не останавливают.
[ -x ./node_modules/.bin/eslint ] || die "Нет eslint в node_modules. Установите dev-зависимости: npm ci"
step "3/7 линт (eslint .)"
"$ESLINT" . || die "ESLint нашёл ошибки (см. вывод выше)"
ok "линт без ошибок"

# Границы импортов плагинов: ESLint их не видит, ему не важен путь модуля.
# Храповик (scripts/plugins/boundaries.json) падает и на новой зависимости
# плагина от ядра, и на неубранной записи после сокращения долга.
step "3/7 границы плагинов (scripts/plugins/check-boundaries.mjs)"
node scripts/plugins/check-boundaries.mjs \
  || die "Нарушены границы импортов плагинов (см. вывод выше; правила — scripts/plugins/boundaries.json)"
ok "границы плагинов соблюдены"

# Реестр плагинов: `registry.generated.ts` обязан совпадать с манифестами.
# Отдельная проверка нужна потому, что prebuild перегенерирует файл и молча
# «починил» бы расхождение в рабочем дереве, а не в коммите.
step "3/7 реестр плагинов (npm run plugins:check)"
node scripts/plugins/generate.mjs --check \
  || die "Реестр плагинов устарел: запустите npm run plugins:generate и закоммитьте src/games/registry.generated.ts"
ok "реестр плагинов в синхроне"

# ── 4. typecheck ────────────────────────────────────────────────────────────
step "4/7 typecheck ($TSC --noEmit)"
"$TSC" --noEmit || die "TypeScript-ошибки. Почините их или запустите с --skip-unit? (см. вывод выше)"
ok "типы сходятся"

# ── 5. unit-тесты ───────────────────────────────────────────────────────────
if [ "$SKIP_UNIT" -eq 0 ]; then
  step "5/7 unit-тесты ($VITEST run)"
  "$VITEST" run || die "Юнит-тесты упали (см. вывод выше)"
  ok "юнит-тесты зелёные"
else
  warn "5/7 unit-тесты пропущены (--skip-unit)"
fi

# ── 6. сборка ───────────────────────────────────────────────────────────────
if [ "$SKIP_BUILD" -eq 0 ]; then
  step "6/7 сборка (npm run build)"

  BUILD_LOG="$(mktemp "${TMPDIR:-/tmp}/dcs-predeploy-build-XXXXXX")"
  [ "$KEEP" -eq 1 ] || TMP_DIRS+=("$BUILD_LOG")

  if NODE_ENV=production npm run build >"$BUILD_LOG" 2>&1; then
    tail -n 5 "$BUILD_LOG"
    ok "сборка прошла, .next/BUILD_ID обновлён"
  elif grep -q "EXDEV" "$BUILD_LOG"; then
    warn "next build упал на EXDEV (ФС не умеет rename между каталогами) — повторяю с обходом"
    dim "  scripts/lib/fs-rename-fallback.cjs подменяет только rename с ошибкой EXDEV"
    if NODE_ENV=production \
       NODE_OPTIONS="--require $APP_DIR/scripts/lib/fs-rename-fallback.cjs" \
       npm run build >>"$BUILD_LOG" 2>&1; then
      ok "сборка прошла (с обходом EXDEV — это не влияет на рантайм)"
    else
      printf '\n%s── последние строки сборки ──%s\n' "$C_DIM" "$C_RESET" >&2
      tail -n 40 "$BUILD_LOG" >&2 || true
      die "Сборка упала и с обходом EXDEV (полный лог: $BUILD_LOG)"
    fi
  else
    printf '\n%s── последние строки сборки ──%s\n' "$C_DIM" "$C_RESET" >&2
    tail -n 40 "$BUILD_LOG" >&2 || true
    die "Сборка упала (полный лог: $BUILD_LOG). Проверьте доступ к fonts.googleapis.com (next/font) и ошибки выше"
  fi
else
  [ -f .next/BUILD_ID ] || die "Нет .next/BUILD_ID, а сборка пропущена. Запустите npm run build или уберите --skip-build"
  warn "6/7 сборка пропущена (--skip-build), используем .next от $(date -r .next/BUILD_ID '+%Y-%m-%d %H:%M' 2>/dev/null || echo 'неизвестно когда')"
fi

# Контракт EXDEV-обхода (§5.2): next build обязан оставить страницы ошибок на
# месте. Если их нет — последний перенос не состоялся, и проверять дальше
# (смоук на живом сервере) нет смысла. Проверяем результат, а не механизм:
# если будущая версия Next перестанет переносить эти файлы, чек упадёт и
# напомнит, что шим scripts/lib/fs-rename-fallback.cjs больше не нужен.
for page in 404 500; do
  [ -s ".next/server/pages/$page.html" ] \
    || die "Нет .next/server/pages/$page.html — сборка не доехала до конца (EXDEV? см. _RUN_INSTRUCTIONS.md §5.2)"
done
ok "артефакты .next/server/pages/{404,500}.html на месте"

# ── 7. smoke-тест на временном сервере ──────────────────────────────────────
if [ "$SKIP_SMOKE" -eq 1 ]; then
  warn "7/7 smoke-тест пропущен (--skip-smoke)"
else
  step "7/7 smoke: next start + HTTP-проверки"

  [ -n "$PORT" ] || PORT="$(free_port)"
  [ -n "$PORT" ] || die "Не удалось выбрать свободный порт"

  TMP_DATA="$(mktemp -d "${TMPDIR:-/tmp}/dcs-predeploy-data-XXXXXX")"
  TMP_DIRS+=("$TMP_DATA")
  SERVER_LOG="$(mktemp "${TMPDIR:-/tmp}/dcs-predeploy-log-XXXXXX")"
  [ "$KEEP" -eq 1 ] || TMP_DIRS+=("$SERVER_LOG")

  dim "временный каталог данных: $TMP_DATA"
  dim "порт: $PORT, лог: $SERVER_LOG"

  DCS_DATA_DIR="$TMP_DATA" PORT="$PORT" "$NEXT" start -H 127.0.0.1 -p "$PORT" >"$SERVER_LOG" 2>&1 &
  SERVER_PID=$!

  if ! wait_for_http "http://127.0.0.1:$PORT/login" 90; then
    printf '\n%s── лог сервера ──%s\n' "$C_DIM" "$C_RESET" >&2
    tail -n 40 "$SERVER_LOG" >&2 || true
    die "Сервер не поднялся на порту $PORT за 90 с"
  fi
  ok "сервер отвечает на http://127.0.0.1:$PORT"

  node scripts/smoke.mjs --base-url "http://127.0.0.1:$PORT" --data-dir "$TMP_DATA" \
    || die "Smoke-тест не пройден (лог сервера: $SERVER_LOG)"

  ok "smoke-тест пройден"
fi

printf '\n%s%s%s\n' "$C_GREEN" "$C_BOLD" "Всё зелёное — можно деплоить." "$C_RESET"
dim "Прод-запуск: npm start (из корня проекта, каталог data/ должен быть writable)."
