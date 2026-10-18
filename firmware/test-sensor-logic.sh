#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
libraries=${SENTINELX_LIBRARIES:-$HOME/Documents/Codex/toolchains/sentinelx-arduino/sketchbook/libraries}
if [ ! -d "$libraries" ]; then libraries="$HOME/Documents/Arduino/libraries"; fi
mkdir -p "$root/build"
clang++ -std=c++17 -Wall -Wextra -Werror -fsanitize=address,undefined \
  -I "$libraries/ArduinoJson/src" "$root/tests/sensor-and-outbox.cpp" -o "$root/build/sensor-and-outbox-test"
"$root/build/sensor-and-outbox-test"
