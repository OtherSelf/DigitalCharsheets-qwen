@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul 2>&1

rem ============================================================================
rem  dcs-dev.bat — дев-сервер Digital Character Sheets на Windows
rem
rem  Bash-версия scripts/dcs-dev.sh держится на screen, sudo и systemd, которых
rem  в Windows нет. Здесь те же задачи решены средствами cmd:
rem
rem    start    — поставить зависимости, если их нет, поднять npm run dev
rem               в отдельном свёрнутом окне и дождаться ответа /api/health;
rem    stop     — погасить node.exe, слушающий порт, и дождаться, пока порт
rem               освободится;
rem    restart  — stop, затем start со сбросом .next;
rem    status   — порт, процесс, health, ветка и коммит, аккаунты, хвост лога;
rem    logs     — хвост лога и слежение за ним, Ctrl-C — выйти;
rem    open     — открыть http://HOST:PORT/login в браузере.
rem
rem  Почему отдельное окно: `npm run dev` живёт дольше скрипта, а закрытие
rem  родительского окна не должно его убивать. Вывод идёт в файл лога, чтобы
rem  `status` и `logs` работали, даже когда окно свернуто.
rem
rem  Примеры:
rem    scripts\dcs-dev.bat                  start на http://127.0.0.1:3000
rem    scripts\dcs-dev.bat -p 3002          другой порт
rem    scripts\dcs-dev.bat -H 0.0.0.0       слушать все интерфейсы
rem    scripts\dcs-dev.bat restart          перезапуск со свежим .next
rem    scripts\dcs-dev.bat status           состояние сервера
rem    scripts\dcs-dev.bat logs 500         последние 500 строк и слежение
rem    scripts\dcs-dev.bat stop             остановить и освободить порт
rem
rem  Переменные окружения: DCS_PORT, DCS_HOST, DCS_READY_TIMEOUT, DCS_LOG_DIR.
rem  DCS_DATA_DIR пробрасывается в Next как есть, по умолчанию — <проект>\data.
rem
rem  Прод на Windows не поддерживается: scripts/dcs-prod.sh остаётся
rem  Linux/systemd-сценарием, этот файл — только локальный стенд для тестов.
rem ============================================================================

rem Каталог проекта — родитель scripts\, независимо от текущего каталога.
pushd "%~dp0.." >nul 2>&1
if errorlevel 1 (
  echo [x] не могу перейти в каталог проекта: "%~dp0.."
  exit /b 1
)

set "D_APP_DIR=%CD%"
set "D_SELF=%~f0"
set "D_SCRIPT=%~nx0"
set "D_PORT=3000"
set "D_HOST=127.0.0.1"
set "D_TIMEOUT=120"
set "D_TAIL=200"
set "D_COMMAND="
set "D_FORCE=0"
set "D_SKIP_INSTALL=0"
set "D_FRESH=0"
set "D_RC=0"

if defined DCS_PORT set "D_PORT=%DCS_PORT%"
if defined DCS_HOST set "D_HOST=%DCS_HOST%"
if defined DCS_READY_TIMEOUT set "D_TIMEOUT=%DCS_READY_TIMEOUT%"

rem Лог вне репозитория: dev-сервер пишет много, а рабочее дерево должно
rem оставаться чистым для git status.
set "D_LOG_DIR=%TEMP%\dcs-dev-logs"
if defined LOCALAPPDATA set "D_LOG_DIR=%LOCALAPPDATA%\dcs-dev\logs"
if defined DCS_LOG_DIR set "D_LOG_DIR=%DCS_LOG_DIR%"

rem Служебный режим: родитель запускает копию себя в отдельном окне, чтобы
rem сервер пережил выход скрипта.
if /i "%~1"=="__serve" goto :serve

rem ── разбор аргументов ───────────────────────────────────────────────────────
:parse
if "%~1"=="" goto :parsed
set "D_ARG=%~1"

if /i "%D_ARG%"=="start" goto :set_start
if /i "%D_ARG%"=="stop" goto :set_stop
if /i "%D_ARG%"=="restart" goto :set_restart
if /i "%D_ARG%"=="status" goto :set_status
if /i "%D_ARG%"=="logs" goto :set_logs
if /i "%D_ARG%"=="open" goto :set_open
if "%D_ARG%"=="-h" goto :usage
if /i "%D_ARG%"=="--help" goto :usage
if /i "%D_ARG%"=="help" goto :usage
if /i "%D_ARG%"=="-p" goto :opt_port
if /i "%D_ARG%"=="--port" goto :opt_port
if "%D_ARG%"=="-H" goto :opt_host
if /i "%D_ARG%"=="--host" goto :opt_host
if /i "%D_ARG%"=="--timeout" goto :opt_timeout
if /i "%D_ARG%"=="-f" goto :opt_force
if /i "%D_ARG%"=="--force-install" goto :opt_force
if /i "%D_ARG%"=="--skip-install" goto :opt_skip_install
if /i "%D_ARG%"=="--fresh" goto :opt_fresh

rem Число без команды — сколько строк лога показать: dcs-dev.bat logs 500
echo %D_ARG%| findstr /r "^[0-9][0-9]*$" >nul
if not errorlevel 1 (
  set "D_TAIL=%D_ARG%"
  shift
  goto :parse
)
goto :unknown_arg

:set_start
set "D_COMMAND=start"
shift
goto :parse

:set_stop
set "D_COMMAND=stop"
shift
goto :parse

:set_restart
set "D_COMMAND=restart"
shift
goto :parse

:set_status
set "D_COMMAND=status"
shift
goto :parse

:set_logs
set "D_COMMAND=logs"
shift
goto :parse

:set_open
set "D_COMMAND=open"
shift
goto :parse

:opt_port
if "%~2"=="" (
  echo [x] -p требует значение, например: -p 3001
  set "D_RC=1"
  goto :end
)
set "D_PORT=%~2"
shift
shift
goto :parse

:opt_host
if "%~2"=="" (
  echo [x] -H требует значение, например: -H 0.0.0.0
  set "D_RC=1"
  goto :end
)
set "D_HOST=%~2"
shift
shift
goto :parse

:opt_timeout
if "%~2"=="" (
  echo [x] --timeout требует значение в секундах, например: --timeout 180
  set "D_RC=1"
  goto :end
)
set "D_TIMEOUT=%~2"
shift
shift
goto :parse

:opt_force
set "D_FORCE=1"
shift
goto :parse

:opt_skip_install
set "D_SKIP_INSTALL=1"
shift
goto :parse

:opt_fresh
set "D_FRESH=1"
shift
goto :parse

:unknown_arg
if "%D_COMMAND%"=="" (
  echo [x] неизвестная команда: %D_ARG%
) else (
  echo [x] неизвестный аргумент: %D_ARG%
)
echo     список команд и флагов: %D_SCRIPT% --help
set "D_RC=1"
goto :end

rem ── общие проверки ──────────────────────────────────────────────────────────
:init_paths
set "D_DATA_DIR=%D_APP_DIR%\data"
if defined DCS_DATA_DIR set "D_DATA_DIR=%DCS_DATA_DIR%"
set "D_CHECK_HOST=127.0.0.1"
if not "%D_HOST%"=="0.0.0.0" set "D_CHECK_HOST=%D_HOST%"
set "D_LOG_FILE=%D_LOG_DIR%\dcs-dev-%D_PORT%.log"
rem Метка выхода дочернего окна: пока сервер жив, файла нет, а после падения
rem родитель видит код возврата и не ждёт таймаут впустую.
set "D_STATE_FILE=%D_LOG_DIR%\dcs-dev-%D_PORT%.exit"
exit /b 0

:validate
if "%D_PORT%"=="" (
  echo [x] порт не задан
  exit /b 1
)
for /f "delims=0123456789" %%d in ("%D_PORT%") do (
  echo [x] порт должен быть числом 1..65535, получено: %D_PORT%
  exit /b 1
)
if %D_PORT% LSS 1 (
  echo [x] порт должен быть числом 1..65535, получено: %D_PORT%
  exit /b 1
)
if %D_PORT% GTR 65535 (
  echo [x] порт должен быть числом 1..65535, получено: %D_PORT%
  exit /b 1
)
if "%D_TIMEOUT%"=="" (
  echo [x] --timeout не может быть пустым
  exit /b 1
)
for /f "delims=0123456789" %%d in ("%D_TIMEOUT%") do (
  echo [x] --timeout должен быть числом секунд, получено: %D_TIMEOUT%
  exit /b 1
)
exit /b 0

:preflight
where node >nul 2>&1
if errorlevel 1 (
  echo [x] Node.js не найден в PATH. Нужен Node.js 22.12 или новее: https://nodejs.org/
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo [x] npm не найден в PATH. Обычно ставится вместе с Node.js.
  exit /b 1
)
where powershell >nul 2>&1
if errorlevel 1 (
  echo [x] Windows PowerShell не найден в PATH, а на нём проверка порта и лог.
  exit /b 1
)
set "D_NODE_VERSION="
for /f "delims=" %%v in ('node -v 2^>nul') do set "D_NODE_VERSION=%%v"
node -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]>22||(v[0]===22&&v[1]>=12)?0:1)" >nul 2>&1
if errorlevel 1 (
  echo [x] нужен Node.js 22.12 или новее, сейчас %D_NODE_VERSION%. Версия закреплена в package.json.
  exit /b 1
)
echo [ok] Node.js %D_NODE_VERSION%
exit /b 0

:ensure_deps
if "%D_SKIP_INSTALL%"=="1" (
  echo [i] --skip-install: зависимости не проверяю
  exit /b 0
)
set "D_NEED_INSTALL=0"
if "%D_FORCE%"=="1" set "D_NEED_INSTALL=1"
if not exist "node_modules\.package-lock.json" set "D_NEED_INSTALL=1"
if not exist "node_modules\next\package.json" set "D_NEED_INSTALL=1"
if "%D_NEED_INSTALL%"=="0" (
  echo [ok] зависимости на месте, npm ci пропускаю. Форсировать: -f
  exit /b 0
)
echo [..] npm ci: зависимостей нет или они неполные, это может занять несколько минут
call npm ci --no-audit --no-fund
if errorlevel 1 (
  echo [x] npm ci упал, вывод выше. Исправьте причину и повторите.
  exit /b 1
)
echo [ok] зависимости установлены
exit /b 0

rem ── процесс на порту ────────────────────────────────────────────────────────
rem PID ищу по локальному адресу, а не по строке состояния: названия состояний
rem в netstat локализованы, а поле адреса одинаково во всех локалях.
:find_port_pid
set "D_PID="
set "D_IMAGE="
for /f "tokens=2,5" %%a in ('netstat -ano -p tcp ^| findstr /c:":%D_PORT%" 2^>nul') do (
  if not defined D_PID (
    echo %%a| findstr /e /c:":%D_PORT%" >nul && set "D_PID=%%b"
  )
)
if defined D_PID (
  for /f "tokens=1 delims=," %%i in ('tasklist /FI "PID eq !D_PID!" /FO CSV /NH 2^>nul') do set "D_IMAGE=%%~i"
)
exit /b 0

rem Проверяю /api/health, а не /login: health-маршрут компилируется за
rem секунду, тогда как первая сборка страницы легко переживает таймаут
rem запроса, и опрос /login принимал бы живого сервера за мёртвого.
:http_ok
set "D_HEALTH_URL=http://%D_CHECK_HOST%:%D_PORT%/api/health"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -Uri $env:D_HEALTH_URL -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
exit /b %errorlevel%

:wait_http
set "D_WAITED=0"
echo [..] жду ответа от http://%D_CHECK_HOST%:%D_PORT%/api/health, до %D_TIMEOUT% с
:wait_http_loop
call :http_ok
if not errorlevel 1 (
  echo [ok] сервер отвечает
  exit /b 0
)
if exist "%D_STATE_FILE%" (
  set "D_EXIT_CODE=?"
  set /p D_EXIT_CODE=<"%D_STATE_FILE%"
  echo [x] npm run dev завершился с кодом !D_EXIT_CODE! до первого ответа
  exit /b 1
)
set /a D_WAITED+=2
if !D_WAITED! GEQ %D_TIMEOUT% (
  echo [x] сервер не ответил за %D_TIMEOUT% с
  exit /b 1
)
ping -n 2 127.0.0.1 >nul 2>&1
goto :wait_http_loop

:wait_port_free
set "D_WAITED=0"
:wait_free_loop
call :find_port_pid
if not defined D_PID exit /b 0
set /a D_WAITED+=1
if !D_WAITED! GEQ 20 exit /b 1
ping -n 2 127.0.0.1 >nul 2>&1
goto :wait_free_loop

rem Лог одного порта растёт от запуска к запуску; 10 МБ хватает на разбор
rem падения, а старый файл нужен, чтобы не потерять причину прошлого сбоя.
:rotate_log
if not exist "%D_LOG_FILE%" exit /b 0
for %%f in ("%D_LOG_FILE%") do (
  if %%~zf GTR 10485760 (
    move /y "%D_LOG_FILE%" "%D_LOG_FILE%.1" >nul 2>&1
    echo [i] лог был больше 10 МБ, старый сохранён как %D_LOG_FILE%.1
  )
)
exit /b 0

rem Кеш Turbopack принадлежит конкретному процессу: вкладка, открытая до
rem рестарта, применяет патчи к графу прошлого процесса и падает с
rem "module factory is not available". data\ при этом не трогаем.
:wipe_next
if not exist "%D_APP_DIR%\.next" (
  echo [i] .next нет, чистить кеш нечего
  exit /b 0
)
echo [..] удаляю .next: кеш dev-сервера прошлого процесса
rmdir /s /q "%D_APP_DIR%\.next" 2>nul
if exist "%D_APP_DIR%\.next" (
  echo [warn] не удалось удалить .next, возможно его держит старый сервер
  exit /b 1
)
echo [ok] кеш .next сброшен
exit /b 0

rem ── команды ─────────────────────────────────────────────────────────────────
:cmd_start
call :preflight
if errorlevel 1 exit /b 1
call :ensure_deps
if errorlevel 1 exit /b 1

call :find_port_pid
if defined D_PID (
  call :http_ok
  if not errorlevel 1 (
    echo [warn] сервер уже отвечает на http://%D_CHECK_HOST%:%D_PORT%/login, PID !D_PID!
    echo     остановить: %D_SCRIPT% stop
    exit /b 0
  )
  echo [x] порт %D_PORT% занят процессом %D_IMAGE% PID !D_PID!, это не наш сервер
  echo     закройте его или выберите другой порт: %D_SCRIPT% -p 3001
  exit /b 1
)

if "%D_FRESH%"=="1" call :wipe_next
if not exist "%D_LOG_DIR%" mkdir "%D_LOG_DIR%" >nul 2>&1
call :rotate_log

echo [..] запускаю npm run dev на %D_HOST%:%D_PORT% в отдельном окне
if exist "%D_STATE_FILE%" del /q "%D_STATE_FILE%" >nul 2>&1
start "DCS dev :%D_PORT%" /min "%D_SELF%" __serve %D_PORT% %D_HOST%

call :wait_http
if errorlevel 1 (
  echo [x] последние строки лога:
  call :tail_log 40
  exit /b 1
)
call :print_summary
exit /b 0

:cmd_stop
call :find_port_pid
if not defined D_PID (
  echo [i] на порту %D_PORT% никто не слушает, останавливать нечего
  exit /b 0
)
if /i not "%D_IMAGE%"=="node.exe" (
  echo [x] порт %D_PORT% держит %D_IMAGE% PID !D_PID!, это не Node.js, не трогаю
  exit /b 1
)
echo [..] останавливаю node.exe PID !D_PID! на порту %D_PORT%
taskkill /F /T /PID !D_PID! >nul 2>&1
if errorlevel 1 (
  echo [x] taskkill не смог остановить PID !D_PID!, закройте окно сервера вручную
  exit /b 1
)
call :wait_port_free
if errorlevel 1 (
  echo [x] порт %D_PORT% всё ещё занят, проверьте: netstat -ano ^| findstr :%D_PORT%
  exit /b 1
)
echo [ok] сервер остановлен, порт %D_PORT% свободен
exit /b 0

:cmd_restart
call :cmd_stop
if errorlevel 1 exit /b 1
call :wipe_next
call :cmd_start
exit /b %errorlevel%

:cmd_status
echo.
echo == DCS dev ==
echo   Каталог : %D_APP_DIR%
echo   Хост    : %D_HOST%
echo   Порт    : %D_PORT%
call :find_port_pid
if defined D_PID (
  echo   Процесс : %D_IMAGE% PID !D_PID!
) else (
  echo   Процесс : не запущен
)
call :http_ok
if errorlevel 1 (
  echo   Health  : нет ответа на http://%D_CHECK_HOST%:%D_PORT%/api/health
) else (
  echo   Health  : 200 http://%D_CHECK_HOST%:%D_PORT%/api/health
)
if exist "%D_APP_DIR%\.git" (
  set "D_BRANCH="
  set "D_COMMIT="
  for /f "delims=" %%b in ('git -C "%D_APP_DIR%" rev-parse --abbrev-ref HEAD 2^>nul') do set "D_BRANCH=%%b"
  for /f "delims=" %%c in ('git -C "%D_APP_DIR%" log -1 --format=%%h 2^>nul') do set "D_COMMIT=%%c"
  if defined D_COMMIT echo   Код     : !D_BRANCH! !D_COMMIT!
)
if exist "%D_DATA_DIR%" (
  set "D_USERS=0"
  for /d %%d in ("%D_DATA_DIR%\users\*") do set /a D_USERS+=1
  echo   Данные  : "%D_DATA_DIR%", аккаунтов: !D_USERS!
)
echo   Лог     : "%D_LOG_FILE%"
if exist "%D_STATE_FILE%" (
  set "D_LAST_EXIT=?"
  set /p D_LAST_EXIT=<"%D_STATE_FILE%"
  echo   Прошлый : завершился с кодом !D_LAST_EXIT!
)
call :tail_log 12
exit /b 0

:cmd_logs
if not exist "%D_LOG_FILE%" (
  echo [x] лога ещё нет: "%D_LOG_FILE%"
  exit /b 1
)
set "D_TAIL_FILE=%D_LOG_FILE%"
echo [..] Ctrl-C — выйти из слежения
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -LiteralPath $env:D_TAIL_FILE -Tail %D_TAIL% -Wait -Encoding UTF8"
exit /b 0

:cmd_open
start "" "http://%D_CHECK_HOST%:%D_PORT%/login"
exit /b 0

:tail_log
if not exist "%D_LOG_FILE%" exit /b 0
echo.
echo   -- последние строки лога --
set "D_TAIL_FILE=%D_LOG_FILE%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -LiteralPath $env:D_TAIL_FILE -Tail %~1 -Encoding UTF8" 2>nul
exit /b 0

:print_summary
echo.
echo == Готово ==
echo   URL     : http://%D_CHECK_HOST%:%D_PORT%/login
echo   Каталог : %D_APP_DIR%
echo   Лог     : "%D_LOG_FILE%"
echo   Данные  : "%D_DATA_DIR%"
echo.
echo   %D_SCRIPT% status   — состояние сервера
echo   %D_SCRIPT% logs     — следить за логом
echo   %D_SCRIPT% stop     — остановить
echo   %D_SCRIPT% restart  — перезапуск со свежим .next
exit /b 0

rem ── служебный режим: сам сервер в отдельном окне ─────────────────────────────
:serve
set "D_PORT=%~2"
set "D_HOST=%~3"
if "%D_PORT%"=="" set "D_PORT=3000"
if "%D_HOST%"=="" set "D_HOST=127.0.0.1"
call :init_paths
title DCS dev :%D_PORT%
if not exist "%D_LOG_DIR%" mkdir "%D_LOG_DIR%" >nul 2>&1
>>"%D_LOG_FILE%" echo ===== %DATE% %TIME% ^| start port %D_PORT% ^| %D_APP_DIR% =====
cd /d "%D_APP_DIR%"
call npm run dev -- -p %D_PORT% -H %D_HOST% >>"%D_LOG_FILE%" 2>&1
>>"%D_LOG_FILE%" echo ===== npm завершился с кодом %errorlevel% =====
>"%D_STATE_FILE%" echo %errorlevel%
exit /b 0

rem ── справка и диспетчеризация ───────────────────────────────────────────────
:usage
echo %D_SCRIPT% — дев-сервер Digital Character Sheets на Windows
echo.
echo Использование:
echo   %D_SCRIPT% start [флаги]      поднять сервер, по умолчанию без флагов
echo   %D_SCRIPT% stop               остановить сервер и освободить порт
echo   %D_SCRIPT% restart [флаги]    stop + start, кеш .next стирается
echo   %D_SCRIPT% status             порт, процесс, health, ветка и коммит
echo   %D_SCRIPT% logs [N]           последние N строк лога и слежение
echo   %D_SCRIPT% open               открыть /login в браузере
echo   %D_SCRIPT% help               эта справка
echo.
echo Флаги:
echo   -p, --port PORT      порт дев-сервера, по умолчанию 3000
echo   -H, --host ADDR      адрес прослушивания, по умолчанию 127.0.0.1
echo       --timeout SEC    сколько ждать ответа сервера, по умолчанию 120
echo   -f, --force-install  выполнить npm ci, даже если зависимости на месте
echo       --skip-install   не проверять и не ставить зависимости
echo       --fresh          удалить .next перед запуском
echo   -h, --help           эта справка
echo.
echo Окружение: DCS_PORT, DCS_HOST, DCS_READY_TIMEOUT, DCS_LOG_DIR, DCS_DATA_DIR
echo Лог: %%LOCALAPPDATA%%\dcs-dev\logs\dcs-dev-PORT.log
echo Сервер живёт в отдельном окне и переживает выход скрипта.
exit /b 0

:parsed
call :init_paths
call :validate
if errorlevel 1 (
  set "D_RC=1"
  goto :end
)
if "%D_COMMAND%"=="" set "D_COMMAND=start"
if /i "%D_COMMAND%"=="start" goto :run_start
if /i "%D_COMMAND%"=="stop" goto :run_stop
if /i "%D_COMMAND%"=="restart" goto :run_restart
if /i "%D_COMMAND%"=="status" goto :run_status
if /i "%D_COMMAND%"=="logs" goto :run_logs
if /i "%D_COMMAND%"=="open" goto :run_open
echo [x] неизвестная команда: %D_COMMAND%
set "D_RC=1"
goto :end

:run_start
call :cmd_start
set "D_RC=%errorlevel%"
goto :end

:run_stop
call :cmd_stop
set "D_RC=%errorlevel%"
goto :end

:run_restart
call :cmd_restart
set "D_RC=%errorlevel%"
goto :end

:run_status
call :cmd_status
set "D_RC=%errorlevel%"
goto :end

:run_logs
call :cmd_logs
set "D_RC=%errorlevel%"
goto :end

:run_open
call :cmd_open
set "D_RC=%errorlevel%"
goto :end

:end
popd
if not "%D_RC%"=="0" (
  echo.
  echo [x] код возврата: %D_RC%
)
exit /b %D_RC%
