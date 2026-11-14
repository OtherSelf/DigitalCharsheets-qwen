#!/usr/bin/env bash
# ============================================================================
#  scripts/visual.sh — визуальные (screenshot regression) тесты DigitalCharsheets
#
#  Что делает:
#    1. при необходимости собирает приложение (next build; при EXDEV — повтор
#       с scripts/lib/fs-rename-fallback.cjs);
#    2. поднимает production-сервер на свободном порту с ВРЕМЕННЫМ каталогом
#       данных (DCS_DATA_DIR), чтобы не трогать ./data;
#    3. наполняет его фикстурами (2 персонажа: D&D и Dark Heresy);
#    4. гоняет Playwright в двух проектах: desktop (1440x900) и mobile
#       (Pixel 7, touch, isMobile);
#    5. сравнивает PNG с эталонами в tests/visual/__screenshots__/;
#    6. гасит сервер и удаляет временные данные.
#
#  Использование:
#    npm run test:visual                 # полный прогон (сборка + сервер)
#    npm run test:visual -- --skip-build # быстрый прогон на текущем .next
#    npm run test:visual -- --update-snapshots   # перезаписать эталоны
#    npm run test:visual -- --grep "лист D&D"    # только часть тестов
#    npm run test:visual -- --skip-build tests/visual/themes.spec.ts
#                                        # один файл
#    npm run test:visual -- --skip-build tests/visual/themes.spec.ts:70:7
#                                        # один тест по строке
#    bash scripts/visual.sh --base-url http://localhost:3000  # против живого сервера
#
#  Любой аргумент, который скрипт не знает, уходит в `playwright test` как есть
#  (--grep, --project, --last-failed, пути спек и т.д.), поэтому набор можно
#  запускать точечно. Подробности и подводные камни — bash scripts/visual.sh --help.
#
#  Код возврата: 0 — эталоны совпали, 1 — есть отличия/падения.
#  Флаги и проброс в Playwright: bash scripts/visual.sh --help
#  Связано: playwright.config.ts, tests/visual/, docs/testing.md
# ============================================================================

set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

BUILD=1
BASE_URL=""
PORT=""
KEEP=0
LIST=0
PLAY_ARGS=()

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
${C_BOLD}visual.sh${C_RESET} — визуальные тесты DigitalCharsheets (Playwright)

${C_BOLD}Использование:${C_RESET}
  bash scripts/visual.sh [флаги] [аргументы playwright]

${C_BOLD}Флаги:${C_RESET}
  --skip-build           не собирать, использовать текущий .next/
  --build                принудительно пересобрать (по умолчанию и так собирает)
  --base-url URL         гонять против уже запущенного сервера
  -p, --port PORT        порт временного сервера (по умолчанию свободный)
  --keep                 не удалять временный каталог и лог сервера
  -h, --help             эта справка

${C_BOLD}Проброс в Playwright:${C_RESET}
  --update-snapshots     обновить эталоны (то же: --update)
  --grep PATTERN         только тесты, чьё имя подходит под PATTERN (то же: -g)
  --grep-invert PATTERN  наоборот: исключить подходящие
  --project NAME         только один проект (desktop, mobile или tablet)
  --last-failed          только тесты, упавшие в прошлый раз
                         (если падений не было — Playwright пишет
                         "No tests found" и возвращает код 1;
                         добавьте --pass-with-no-tests, если это не ошибка)
  --list                 показать список тестов и выйти
  --headed               показать браузер (нужен X-сервер)
  прочие аргументы уходят в \`playwright test\` как есть

${C_BOLD}Точечный прогон (без сборки и без запуска всего набора):${C_RESET}
  npm run test:visual -- --skip-build tests/visual/themes.spec.ts
  npm run test:visual -- --skip-build tests/visual/themes.spec.ts:70:7
  npm run test:visual -- --skip-build --grep "тёмная тема" --project desktop

  ВНИМАНИЕ: --grep — регулярное выражение, а не подстрока. Скобки, точки и
  плюсы экранируются: --grep "dashboard — тёмная тема \\(en\\)". Без
  экранирования "(en)" — группа, совпадений нет и Playwright пишет
  "No tests found".

${C_BOLD}Примеры:${C_RESET}
  npm run test:visual
  npm run test:visual -- --skip-build
  npm run test:visual -- --update-snapshots
  npm run test:visual -- --grep "mobile"
  bash scripts/visual.sh --base-url http://127.0.0.1:3001

${C_BOLD}Где смотреть результат:${C_RESET}
  playwright-report/index.html   — HTML-отчёт с диффами
  test-results/visual/           — actual/expected/diff PNG упавших тестов
  tests/visual/__screenshots__/  — эталоны (коммитятся в git)
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-build) BUILD=0 ;;
    --build)      BUILD=1 ;;
    --keep)       KEEP=1 ;;
    --base-url)   shift; BASE_URL="${1:-}"; [ -n "$BASE_URL" ] || die "--base-url требует URL" ;;
    -p|--port)    shift; PORT="${1:-}"; [ -n "$PORT" ] || die "-p требует номер порта" ;;
    --update)     PLAY_ARGS+=("--update-snapshots") ;;
    --update-snapshots) PLAY_ARGS+=("--update-snapshots") ;;
    --grep)       shift; [ -n "${1:-}" ] || die "--grep требует шаблон"; PLAY_ARGS+=("--grep" "$1") ;;
    --list)       LIST=1; PLAY_ARGS+=("--list") ;;
    --headed)     PLAY_ARGS+=("--headed") ;;
    -h|--help)    usage; exit 0 ;;
    *)            PLAY_ARGS+=("$1") ;;
  esac
  shift
done

need() { command -v "$1" >/dev/null 2>&1 || die "Не найдено: $1. $2"; }
have() { command -v "$1" >/dev/null 2>&1; }

have node || die "Не найден node. Нужен Node.js 18.18+."
have npm  || die "Не найден npm."
[ -d node_modules ] || die "Нет node_modules. Сначала: npm ci"
[ -x ./node_modules/.bin/playwright ] || die "Нет Playwright. Установите: npm i -D @playwright/test && npx playwright install chromium"

# Если браузеры сложены локально (как в этом окружении), используем их.
if [ -z "${PLAYWRIGHT_BROWSERS_PATH:-}" ] && [ -d "$APP_DIR/.playwright-browsers" ]; then
  export PLAYWRIGHT_BROWSERS_PATH="$APP_DIR/.playwright-browsers"
  dim "браузеры Playwright: $PLAYWRIGHT_BROWSERS_PATH"
fi

# Минимальные образы без libnspr4/libnss3: если рядом распакован локальный
# набор зависимостей — подхватываем. На обычной машине каталога нет и этот
# блок ничего не делает.
if [ -d "$APP_DIR/.chromium-deps/root/usr/lib/x86_64-linux-gnu" ]; then
  export LD_LIBRARY_PATH="$APP_DIR/.chromium-deps/root/usr/lib/x86_64-linux-gnu:$APP_DIR/.chromium-deps/root/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  dim "локальные библиотеки Chromium: $APP_DIR/.chromium-deps"
fi

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/dcs-visual.XXXXXX")"
DATA_DIR="$TMP_DIR/data"
SERVER_LOG="$TMP_DIR/server.log"
STATE_FILE="$TMP_DIR/visual-state.json"
SERVER_PID=""

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
    warn "Временные файлы сохранены: $TMP_DIR"
    [ -f "$SERVER_LOG" ] && warn "Лог сервера: $SERVER_LOG"
  else
    rm -rf "$TMP_DIR"
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

printf '%s%s%s\n' "$C_BOLD" "DigitalCharsheets — визуальные тесты" "$C_RESET"
dim "каталог проекта: $APP_DIR"
dim "node $(node -v), playwright $(./node_modules/.bin/playwright --version 2>/dev/null || echo '?')"

if [ -n "$BASE_URL" ]; then
  BASE_URL="${BASE_URL%/}"
  step "0/2 сервер: используем готовый $BASE_URL"
  wait_for_http "$BASE_URL/login" 15 || die "Сервер $BASE_URL не отвечает на /login"
  ok "сервер отвечает"
else
  if [ "$BUILD" -eq 1 ]; then
    step "1/3 сборка (next build)"
    # На overlayfs/9p next build падает на EXDEV при переносе 404/500.html;
    # scripts/lib/fs-rename-fallback.cjs подменяет rename только при EXDEV.
    NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
      NODE_OPTIONS="--require $APP_DIR/scripts/lib/fs-rename-fallback.cjs ${NODE_OPTIONS:-}" \
      ./node_modules/.bin/next build
    ok "сборка готова"
  else
    [ -f .next/BUILD_ID ] || die "Нет .next/BUILD_ID — сначала запустите без --skip-build"
    step "1/3 сборка пропущена (--skip-build)"
  fi

  PORT="${PORT:-$(free_port)}"
  BASE_URL="http://127.0.0.1:$PORT"
  mkdir -p "$DATA_DIR"

  step "2/3 временный сервер на $BASE_URL"
  # Подпись версии в снимках должна быть одинаковой при каждом прогоне, а
  # /api/version иначе назвал бы реальный коммит (из env или из `.git`).
  # Поэтому задаём фиктивные значения явно, а не гасим переменные: «пусто»
  # теперь означает «прочитать .git», и снимки менялись бы после каждого
  # коммита. Ожидаемая подпись на снимках: «vX.Y.Z · 0000000».
  DCS_DATA_DIR="$DATA_DIR" NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    DCS_GIT_COMMIT=0000000 DCS_GIT_BRANCH=visual DCS_BUILD_DATE= \
    GIT_COMMIT= VERCEL_GIT_COMMIT_SHA= \
    ./node_modules/.bin/next start -H 127.0.0.1 -p "$PORT" >"$SERVER_LOG" 2>&1 &
  SERVER_PID=$!

  if ! wait_for_http "$BASE_URL/login" 60; then
    warn "сервер не поднялся, лог:"
    tail -n 40 "$SERVER_LOG" >&2 || true
    die "не удалось запустить next start"
  fi
  ok "сервер готов (pid $SERVER_PID), данные: $DATA_DIR"
fi

export DCS_VISUAL_BASE_URL="$BASE_URL"
export DCS_VISUAL_STATE="$STATE_FILE"

# Каталог данных временного сервера: global-setup сеет в него детерминированные
# аккаунты для снимков /admin (фиксированные даты/роли/блокировки). В режиме
# --base-url сервер чужой, каталога нет — админские снимки будут пропущены.
if [ -d "$DATA_DIR" ]; then
  export DCS_VISUAL_DATA_DIR="$DATA_DIR"
fi

step "3/3 playwright"
if [ "${#PLAY_ARGS[@]}" -gt 0 ]; then
  dim "аргументы: ${PLAY_ARGS[*]}"
fi
set +e
./node_modules/.bin/playwright test ${PLAY_ARGS[@]+"${PLAY_ARGS[@]}"}
PLAY_CODE=$?
set -e

if [ "$LIST" -eq 1 ]; then
  # --list только печатает список: ни один тест не запускался, поэтому
  # «эталоны совпали» здесь было бы неправдой. Код возврата — от Playwright.
  [ "$PLAY_CODE" -eq 0 ] || warn "playwright --list завершился с кодом $PLAY_CODE"
  exit "$PLAY_CODE"
fi

if [ "$PLAY_CODE" -ne 0 ]; then
  printf '\n%s✗ Визуальные тесты не пройдены (код %s)%s\n' "$C_RED" "$PLAY_CODE" "$C_RESET"
  printf '%s  Диффы и отчёт: playwright-report/index.html, test-results/visual/%s\n' "$C_DIM" "$C_RESET"
  exit "$PLAY_CODE"
fi

printf '\n%s%s%s\n' "$C_GREEN" "$C_BOLD" "Визуальные тесты пройдены: эталоны совпали." "$C_RESET"
