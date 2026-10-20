#pragma once
// Copy to config.h. Keep credentials out of Git.
// Defaults are a proposed classic ESP32-WROOM DevKit layout, NOT verified wiring.
constexpr bool HARDWARE_CONFIRMED = false;
constexpr bool NETWORK_ENABLED = false;
constexpr char WIFI_SSID[] = "YOUR_2_4_GHZ_WIFI";
constexpr char WIFI_PASSWORD[] = "";
constexpr char MQTT_HOST[] = "172.20.10.4"; // Mac LAN IP observed during setup; may change.
constexpr uint16_t MQTT_PORT = 8084;
constexpr char MQTT_USER[] = "";
constexpr char MQTT_PASSWORD[] = "";
constexpr char HELMET_ID[] = "H-201";
constexpr char WORKER_ID[] = "W-101";
constexpr int I2C_SDA = 21, I2C_SCL = 22;
constexpr uint8_t MPU_ADDRESS = 0x68; // AD0 high: 0x69
constexpr int DHT_PIN = 4;
constexpr int GAS_PIN = 34; // ADC1; input only. NEVER connect 5V AO directly.
constexpr int BUZZER_PIN = 25; // Verify actual wiring and use an appropriate driver.
constexpr bool BUZZER_ACTIVE_HIGH = true;
constexpr bool BUZZER_IS_PASSIVE = false;
constexpr int SOS_PIN = -1, LED_PIN = -1; // Not present in user's current hardware.
constexpr bool GAS_CONDITIONING_CONFIRMED = false;
constexpr uint32_t GAS_WARMUP_MS = 180000; // Runtime settling only; see initial aging in README.
constexpr uint32_t PPG_CONTACT_IR_MIN = 50000; // Experimental; tune for actual mounting.
constexpr bool ENABLE_EXPERIMENTAL_FALL = false;
constexpr bool ENABLE_EXPERIMENTAL_INACTIVITY = false;
constexpr uint32_t INACTIVITY_MS = 60000;
