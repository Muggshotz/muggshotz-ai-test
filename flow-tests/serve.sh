#!/usr/bin/env bash
# Keeps the static server the suites need alive on 127.0.0.1:8788.
#
# The bare `python3 -m http.server &` this repo used kept dying between suites
# -- it inherits the shell's process group, so anything that tears that group
# down takes the server with it, and every scenario then fails with
# ERR_CONNECTION_REFUSED, which reads exactly like a broken product.
# setsid detaches it; the loop restarts it if it dies anyway.
cd "$(dirname "$0")/.."
while true; do
  python3 -m http.server 8788 --bind 127.0.0.1 >/dev/null 2>&1
  sleep 1
done
