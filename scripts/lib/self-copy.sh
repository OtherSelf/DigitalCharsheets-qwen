# shellcheck shell=bash
# Общий guard для скриптов, которые обновляют свой же каталог. Если скрипт
# лежит внутри APP_DIR, git reset/merge может переписать файл на ходу; тогда
# работаем из временной копии. Требует common.sh и APP_DIR/ORIG_ARGS.

# guard_self_copy <skip:0|1> <marker_env> <tmp_prefix> [extra_env]
guard_self_copy() {
  local skip="$1" marker_env="$2" tmp_prefix="$3" extra_env="${4:-}"
  [ "$skip" -eq 1 ] && return 0
  [ -n "${!marker_env:-}" ] && return 0

  local self_path self_dir app_real tmp rc
  self_path="${BASH_SOURCE[1]}"
  self_dir=$(cd "$(dirname "$self_path")" 2>/dev/null && pwd -P) || return 0
  app_real=$(cd "$APP_DIR" 2>/dev/null && pwd -P) || return 0
  [ -n "$app_real" ] || return 0
  case "$self_dir/" in
    "$app_real"/*) ;;
    *) return 0 ;;
  esac

  tmp=$(mktemp "${TMPDIR:-/tmp}/${tmp_prefix}.XXXXXX.sh") \
    || die "не удалось создать временную копию скрипта (TMPDIR=${TMPDIR:-/tmp})"
  cp -p "$self_path" "$tmp" || die "не удалось скопировать скрипт в $tmp"
  chmod 700 "$tmp"
  dim "скрипт лежит внутри $APP_DIR — работаю из копии $tmp, чтобы обновление не оборвало выполнение"

  local -a envs=("$marker_env=1" "DCS_LIB_DIR=${DCS_LIB_DIR:-$SCRIPT_DIR}")
  [ -n "$extra_env" ] && envs+=("$extra_env")
  if env "${envs[@]}" bash "$tmp" "${ORIG_ARGS[@]}"; then
    rc=0
  else
    rc=$?
  fi
  rm -f "$tmp"
  exit "$rc"
}
