#!/usr/bin/env bash
# Runs every suite, one at a time, and prints a single roll-up at the end.
# Serial on purpose: they all drive Chromium against the same local server.
cd "$(dirname "$0")"
PASS=(); FAIL=()
for f in verify-*.js verify-*.mjs; do
  out=$(timeout 600 node "$f" 2>&1)
  if printf '%s' "$out" | grep -qE "ALL .*PASSED|ALL VERIFICATIONS PASSED"; then
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
