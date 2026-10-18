#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
libraries=${SENTINELX_LIBRARIES:-$HOME/Documents/Codex/toolchains/sentinelx-arduino/sketchbook/libraries}
if [ ! -d "$libraries" ]; then libraries="$HOME/Documents/Arduino/libraries"; fi
mkdir -p "$root/build"
clang++ -std=c++17 -I "$libraries/ArduinoJson/src" "$root/tests/payload.cpp" -o "$root/build/payload-test"
"$root/build/payload-test" > "$root/build/payloads.jsonl"
"$root/../backend/node_modules/.bin/tsx" "$root/tests/validate-payloads.ts" "$root/build/payloads.jsonl"
