# shellcheck shell=bash
# Ожидание HTTP и свободный порт. Требует common.sh (have/die) и переменную
# SERVER_PID (может быть пустой).

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
    if [ -n "${SERVER_PID:-}" ] && ! kill -0 "$SERVER_PID" 2>/dev/null; then
      return 1
    fi
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

kill_server() {
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 "$SERVER_PID" 2>/dev/null || break
      sleep 0.3
    done
    kill -9 "$SERVER_PID" 2>/dev/null || true
  fi
}
