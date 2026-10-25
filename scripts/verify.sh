#!/usr/bin/env bash
# The one web check every agent and the lead run (harness doc, changes 4
# and 5). Bun only.
#
#   scripts/verify.sh [--fast|--full] [--base REV] [--no-build] [path...]
#
#   --fast  while working: typecheck, and the Bun tests of the area each
#           changed file sits in (its nearest folder with a __tests__ dir).
#   --full  once, before reporting (default): typecheck, every Bun test, and
#           `bun run build`. --no-build skips the build when a dev server is
#           using .next in this tree.
#
# Paths narrow the tests to those files or folders. Prints one PASS/FAIL line
# per stage and RESULT PASS|FAIL, the same contract as
# modernsmapp/scripts/verify/*.sh. Never prints environment values.

set -u
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT" || exit 2
LOG_DIR="${VERIFY_LOG_DIR:-${TMPDIR:-/tmp}/verify-logs/web-$(date +%Y%m%dT%H%M%S)-$$}"
mkdir -p "$LOG_DIR"
FAILED=0

run_stage() {
  local stage="$1" target="$2"
  shift 2
  local log="$LOG_DIR/$stage.log" start=$SECONDS
  "$@" >"$log" 2>&1
  local rc=$?
  if [ $rc -eq 0 ]; then
    printf 'PASS %-14s %s  (%ss)\n' "$stage" "$target" "$((SECONDS - start))"
  else
    FAILED=$((FAILED + 1))
    printf 'FAIL %-14s %s  (%ss)  log: %s\n' "$stage" "$target" "$((SECONDS - start))" "$log"
    tail -n 30 "$log" | sed 's/^/    /'
  fi
}

MODE=full
BASE=""
BUILD=1
PATHS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --fast) MODE=fast ;;
    --full) MODE=full ;;
    --base) BASE="$2"; shift ;;
    --no-build) BUILD=0 ;;
    -h | --help) sed -n '2,16p' "$0"; exit 0 ;;
    -*) echo "unknown flag: $1" >&2; exit 2 ;;
    *) PATHS+=("$1") ;;
  esac
  shift
done

changed_files() {
  {
    git status --porcelain --untracked-files=all | sed -E 's/^.{3}//; s/^.* -> //; s/^"//; s/"$//'
    [ -n "$BASE" ] && git diff --name-only "$BASE"...HEAD
  } | sort -u
}

# test_area <file>: nearest folder at or above the file holding a __tests__ dir.
test_area() {
  local d
  d="$(dirname "$1")"
  case "$d" in */__tests__) d="$(dirname "$d")" ;; esac
  while [ "$d" != "." ] && [ "$d" != "src" ] && [ "$d" != "/" ]; do
    if [ -d "$d/__tests__" ]; then printf '%s' "$d"; return 0; fi
    d="$(dirname "$d")"
  done
  return 1
}

run_stage typecheck tsc bunx tsc --noEmit

if [ "$MODE" = fast ] && [ ${#PATHS[@]} -eq 0 ]; then
  mapfile -t PATHS < <(changed_files | grep -E '^src/.*\.(ts|tsx)$' | while read -r f; do
    [ -e "$f" ] || continue
    test_area "$f" && echo
  done | sed '/^$/d' | sort -u)
  if [ ${#PATHS[@]} -eq 0 ]; then
    echo "SKIP tests          (no changed area with tests)"
  fi
fi

if [ ${#PATHS[@]} -gt 0 ]; then
  run_stage tests "${#PATHS[@]}-areas" bunx bun test "${PATHS[@]}"
elif [ "$MODE" = full ]; then
  run_stage tests all bunx bun test
fi

if [ "$MODE" = full ]; then
  if [ $BUILD -eq 1 ]; then
    run_stage build next bun run build
  else
    echo "SKIP build          (--no-build)"
  fi
fi

if [ $FAILED -eq 0 ]; then
  echo "RESULT PASS  (logs: $LOG_DIR)"
else
  echo "RESULT FAIL ($FAILED failed)  (logs: $LOG_DIR)"
  exit 1
fi
