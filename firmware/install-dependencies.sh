#!/bin/sh
set -eu
local_toolchain="$HOME/Documents/Codex/toolchains/sentinelx-arduino/arduino"
if [ -n "${SENTINELX_ARDUINO:-}" ]; then arduino=$SENTINELX_ARDUINO
elif [ -x "$local_toolchain" ]; then arduino=$local_toolchain
else arduino=arduino-cli
fi
index=https://espressif.github.io/arduino-esp32/package_esp32_index.json
"$arduino" core update-index --additional-urls "$index"
"$arduino" core install esp32:esp32@3.3.12 --additional-urls "$index"
"$arduino" lib install \
  'Adafruit MPU6050@2.2.9' 'Adafruit Unified Sensor@1.1.15' 'Adafruit BusIO@1.17.4' \
  'SparkFun MAX3010x Pulse and Proximity Sensor Library@1.1.2' \
  'DHT sensor library@1.4.7' 'PubSubClient@2.8' 'ArduinoJson@7.4.3'
"$arduino" core list
"$arduino" lib list
