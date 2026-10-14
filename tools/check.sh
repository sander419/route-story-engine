#!/usr/bin/env bash
# Полная проверка Route Story: поднимает сервер, гоняет тесты, гасит сервер.
# Запуск из корня проекта: bash tools/check.sh
set -u
cd "$(dirname "$0")/.."

if [ ! -d "C:/Users/glina/route-story-spike" ]; then
  echo "НЕТ: C:/Users/glina/route-story-spike (Playwright для smoke и own-journey)"; exit 1
fi

python -m http.server 4180 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 2

fail=0
for t in tools/route-test.mjs tools/art-test.mjs tools/director-test.mjs tools/smoke.mjs tools/own-journey-test.mjs tools/fonts-test.mjs tools/terrain-test.mjs tools/timing-audit.mjs tools/journal-layout-test.mjs tools/custom-test.mjs tools/phone-test.mjs; do
  echo "=== $t"
  if node "$t" >/tmp/check-out 2>&1; then
    echo "OK"
  else
    echo "ПАДЕНИЕ"; tail -20 /tmp/check-out; fail=1
  fi
done

if [ $fail -eq 0 ]; then echo "ВСЁ ПРОШЛО"; else echo "ЕСТЬ ПАДЕНИЯ"; fi
exit $fail
