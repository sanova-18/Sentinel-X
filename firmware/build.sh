#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
local_toolchain="$HOME/Documents/Codex/toolchains/sentinelx-arduino/arduino"
if [ -n "${SENTINELX_ARDUINO:-}" ]; then arduino=$SENTINELX_ARDUINO
elif [ -x "$local_toolchain" ]; then arduino=$local_toolchain
else arduino=arduino-cli
fi
exec "$arduino" compile --fqbn "${SENTINELX_FQBN:-esp32:esp32:esp32}" \
  --build-path "$root/build/esp32" "$root/sentinelx_esp32"
