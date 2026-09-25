#!/usr/bin/env bash
# Runs every suite, one at a time, and prints a single roll-up at the end.
# Serial on purpose: they all drive Chromium against the same local server.
cd "$(dirname "$0")"
PASS=(); FAIL=()
for f in verify-*.js verify-*.mjs; do
  case "$f" in *-helpers.js) continue;; esac   # shared helpers, not a suite
  out=$(timeout 1800 node "$f" 2>&1); rc=$?
  # Judged by the exit code, which every suite sets (0 green, 1 red), not by
  # the wording of its last line: three suites end "all green", "DOORMAT
  # VERIFIED" and "ARTWORK ONLY NEVER REACHES CHECKOUT" and read as red for
  # months. Each suite's whole output is kept beside this script's log dir
  # when RUN_ALL_LOGS is set, so a red one can be read without re-running.
  [ -n "$RUN_ALL_LOGS" ] && { mkdir -p "$RUN_ALL_LOGS"; printf '%s\n' "$out" > "$RUN_ALL_LOGS/$f.log"; }
  if [ "$rc" -eq 0 ]; then
    PASS+=("$f")
    echo "PASS  $f"
  else
    FAIL+=("$f")
    echo "FAIL  $f"
    printf '%s\n' "$out" | grep -E "^\[|FAIL|ERROR" | head -6 | sed 's/^/        /'
  fi
done
echo
echo "===== ROLL-UP ====="
echo "passed: ${#PASS[@]}   failed: ${#FAIL[@]}"
[ ${#FAIL[@]} -gt 0 ] && printf 'failing: %s\n' "${FAIL[*]}"
