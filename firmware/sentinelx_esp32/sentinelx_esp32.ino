#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <DHT.h>
#include <MAX30105.h>
#include <spo2_algorithm.h>
#include <esp_timer.h>
#include <esp_system.h>
#include <time.h>
#include <math.h>
#include "payload.h"
#include "sensor_logic.h"
#include "alert_outbox.h"
#if __has_include("config.h")
#include "config.h"
#else
#include "config.example.h"
#endif
#if !CONFIG_IDF_TARGET_ESP32
#error "This pin configuration is for classic ESP32 only. Review pin mapping before porting."
#endif

// Only networkTask owns Wi-Fi/MQTT. The sensor task uses checked I2C transfers.
// NVS commits are serialized; an alert is never removed on a socket write alone.
QueueHandle_t telemetryQueue;
SemaphoreHandle_t outboxMutex;
Preferences preferences;
sentinelx::AlertOutbox outbox, stagedOutbox;
bool outboxReady = false;
MAX30105 optical;
DHT dht(DHT_PIN, DHT11);
sentinelx::PpgWindow ppg;
sentinelx::MotionTracker motion;
bool mpuOk = false, opticalOk = false, ready = false;
bool alarmLatched = false, fallLatched = false, inactive = false;
float heartRate = NAN, oxygen = NAN, temperature = NAN, humidity = NAN;
int gasRaw = -1;
uint32_t lastPpgPoll = 0, lastOpticalSample = 0, lastVitals = 0;
bool haveOpticalSample = false, haveVitals = false;
uint32_t lastDht = 0, lastImu = 0, lastGas = 0, lastTelemetry = 0;
uint32_t lastSensorRetry = 0, lastPpgConfigCheck = 0;
char bootId[40];
uint32_t sequence = 0;
constexpr uint8_t OPTICAL_ADDRESS = 0x57;

bool isoTimestamp(int64_t capturedUs, char* output, size_t length) {
  time_t current = time(nullptr);
  int64_t nowUs = esp_timer_get_time();
  if (current < 1767225600 || capturedUs < 0 || capturedUs > nowUs) return false;
  time_t captured = current - (nowUs - capturedUs) / 1000000;
  struct tm utc;
  return gmtime_r(&captured, &utc) && strftime(output, length, "%Y-%m-%dT%H:%M:%SZ", &utc);
}

// Called with outboxMutex held. Keep the RAM copy unchanged on an NVS failure.
bool commitOutbox() {
  if (!outboxReady || preferences.putBytes("alerts", &stagedOutbox, sizeof(stagedOutbox)) != sizeof(stagedOutbox)) {
    Serial.println("ALERT STORAGE WRITE FAILED: local alarm stays latched; check NVS.");
    return false;
  }
  outbox = stagedOutbox;
  return true;
}

void beginOutbox() {
  outboxMutex = xSemaphoreCreateMutex();
  if (!outboxMutex || !preferences.begin("sentinelx", false)) {
    Serial.println("ALERT STORAGE UNAVAILABLE: local alarms only for new events."); return;
  }
  size_t length = preferences.getBytesLength("alerts");
  if (length) {
    if (length != sizeof(outbox) || preferences.getBytes("alerts", &outbox, sizeof(outbox)) != sizeof(outbox) || !outbox.valid()) {
      Serial.println("ALERT STORAGE INVALID: saved bytes preserved; inspect before clearing NVS.");
      outbox = sentinelx::AlertOutbox{}; return;
    }
  }
  outboxReady = true;
  alarmLatched = outbox.count > 0;
  Serial.printf("Durable alert outbox: %lu pending\n", (unsigned long)outbox.count);
}

void queueAlert(const char* type, const char* description) {
  alarmLatched = true;
  sentinelx::StoredAlert record{};
  record.event.capturedUs = esp_timer_get_time();
  snprintf(record.event.id, sizeof(record.event.id), "%s-%lu", bootId, (unsigned long)++sequence);
  strlcpy(record.event.type, type, sizeof(record.event.type));
  strlcpy(record.event.description, description, sizeof(record.event.description));
  strlcpy(record.helmetId, HELMET_ID, sizeof(record.helmetId));
  strlcpy(record.workerId, WORKER_ID, sizeof(record.workerId));
  strlcpy(record.capturedBoot, bootId, sizeof(record.capturedBoot));
  isoTimestamp(record.event.capturedUs, record.timestamp, sizeof(record.timestamp));
  if (!outboxReady || xSemaphoreTake(outboxMutex, pdMS_TO_TICKS(100)) != pdTRUE) {
    Serial.println("ALERT NOT SAVED: storage unavailable; local alarm remains latched."); return;
  }
  stagedOutbox = outbox;
  if (!stagedOutbox.append(record))
    Serial.println("ALERT OUTBOX FULL: new event not saved; existing events retained, local alarm latched.");
  else if (commitOutbox()) Serial.printf("Alert saved: %s\n", record.event.id);
  xSemaphoreGive(outboxMutex);
}

bool pendingAlert(sentinelx::StoredAlert& record) {
  if (!outboxReady || xSemaphoreTake(outboxMutex, pdMS_TO_TICKS(100)) != pdTRUE) return false;
  bool present = outbox.count > 0;
  if (present) record = outbox.items[0];
  xSemaphoreGive(outboxMutex);
  return present;
}

bool prepareAlertTimestamp(sentinelx::StoredAlert& record) {
  if (record.timestamp[0]) return true;
  if (!strcmp(record.capturedBoot, bootId)) {
    if (!isoTimestamp(record.event.capturedUs, record.timestamp, sizeof(record.timestamp))) return false;
  } else {
    // A reboot loses the old monotonic clock. Preserve the event and disclose the
    // unavailable capture time instead of applying this boot's uptime to it.
    if (!isoTimestamp(esp_timer_get_time(), record.timestamp, sizeof(record.timestamp))) return false;
    char original[sizeof(record.event.description)];
    strlcpy(original, record.event.description, sizeof(original));
    snprintf(record.event.description, sizeof(record.event.description),
             "%.60s; capture time unknown after reboot; timestamp estimates delivery", original);
  }
  if (xSemaphoreTake(outboxMutex, pdMS_TO_TICKS(100)) != pdTRUE) return false;
  int index = outbox.find(record.helmetId, record.workerId, record.event.id);
  bool saved = false;
  if (index >= 0) {
    stagedOutbox = outbox; stagedOutbox.items[index] = record;
    saved = commitOutbox();
  }
  xSemaphoreGive(outboxMutex);
  return saved;
}

void mqttAcknowledgement(char* topic, byte* payload, unsigned int length) {
  if (length > 512 || !outboxReady) return;
  JsonDocument doc;
  if (deserializeJson(doc, payload, length)) return;
  const char* status = doc["status"] | "";
  const char* helmet = doc["helmetId"] | "";
  const char* worker = doc["workerId"] | "";
  const char* event = doc["eventId"] | "";
  char expectedTopic[112];
  snprintf(expectedTopic, sizeof(expectedTopic), "sentinelx/%s/ack", helmet);
  if (strcmp(status, "persisted") || strcmp(topic, expectedTopic)) return;
  if (xSemaphoreTake(outboxMutex, pdMS_TO_TICKS(100)) != pdTRUE) return;
  int index = outbox.find(helmet, worker, event);
  if (index >= 0) {
    stagedOutbox = outbox; stagedOutbox.remove(index);
    if (commitOutbox()) Serial.printf("Backend persisted alert: %s\n", event);
  }
  xSemaphoreGive(outboxMutex);
}

void setBuzzer(bool on) {
  if (BUZZER_PIN < 0) return;
  // Avoid restarting tone/PWM on every 1ms loop iteration.
  static bool initialized = false, previous = false;
  if (initialized && previous == on) return;
  initialized = true; previous = on;
  if (BUZZER_IS_PASSIVE) {
    if (on) tone(BUZZER_PIN, 2200); else noTone(BUZZER_PIN);
  } else digitalWrite(BUZZER_PIN, on == BUZZER_ACTIVE_HIGH ? HIGH : LOW);
}

void serviceLocal(uint32_t now) {
  static bool previous = false, stable = false;
  static uint32_t changed = 0;
  if (SOS_PIN >= 0) {
    bool pressed = digitalRead(SOS_PIN) == LOW;
    if (pressed != previous) { previous = pressed; changed = now; }
    if (uint32_t(now - changed) >= 40 && stable != pressed) {
      stable = pressed;
      if (pressed) queueAlert("SOS_TRIGGERED", "Physical SOS button pressed (prototype device)");
    }
  }
  if (Serial.available() && Serial.read() == 'r') {
    alarmLatched = false; fallLatched = false; motion.invalidate(now);
  }
  bool pulse = alarmLatched && (now % 800 < 250);
  setBuzzer(pulse);
  if (LED_PIN >= 0) digitalWrite(LED_PIN, alarmLatched ? HIGH : LOW);
}

bool readRegisters(uint8_t address, uint8_t reg, uint8_t* result, size_t length) {
  Wire.beginTransmission(address); Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  size_t received = Wire.requestFrom(address, static_cast<uint8_t>(length));
  if (received != length) { while (Wire.available()) Wire.read(); return false; }
  for (size_t i = 0; i < length; ++i) result[i] = Wire.read();
  return true;
}

bool writeRegister(uint8_t address, uint8_t reg, uint8_t value) {
  Wire.beginTransmission(address); Wire.write(reg); Wire.write(value);
  return Wire.endTransmission() == 0;
}

void resetPpg() {
  ppg.reset(); heartRate = NAN; oxygen = NAN; haveVitals = false;
}

bool clearOpticalFifo() {
  // The software ring in SparkFun 1.1.2 has only three usable samples and its
  // clearFIFO() does not clear that ring. Read the hardware FIFO directly.
  bool ok = writeRegister(OPTICAL_ADDRESS, 0x04, 0);
  ok = writeRegister(OPTICAL_ADDRESS, 0x05, 0) && ok;
  ok = writeRegister(OPTICAL_ADDRESS, 0x06, 0) && ok;
  resetPpg(); haveOpticalSample = false;
  return ok;
}

bool opticalConfigurationValid() {
  uint8_t config[3];
  return readRegisters(OPTICAL_ADDRESS, 0x08, config, sizeof(config)) &&
         (config[0] & 0xf0) == 0x50 && (config[1] & 0xc7) == 0x03 &&
         (config[2] & 0x7f) == 0x27;
}

bool initializeOptical() {
  uint8_t identity;
  if (!readRegisters(OPTICAL_ADDRESS, 0xff, &identity, 1) || identity != 0x15 ||
      !optical.begin(Wire, I2C_SPEED_FAST)) return false;
  // Red+IR, 100 samples/s averaged by 4 => 25 Hz for Maxim's FS=25 algorithm.
  optical.setup(60, 4, 2, 100, 411, 4096);
  lastPpgPoll = millis(); lastPpgConfigCheck = millis();
  return opticalConfigurationValid() && clearOpticalFifo();
}

void sensorSetupDelay(uint32_t duration) {
  uint32_t started = millis();
  while (uint32_t(millis() - started) < duration) { serviceLocal(millis()); delay(1); }
}

bool initializeMotion() {
  uint8_t identity, power = 0x80;
  motion.invalidate(millis());
  if (!readRegisters(MPU_ADDRESS, MPU6050_WHO_AM_I, &identity, 1) || identity != MPU6050_DEVICE_ID ||
      !writeRegister(MPU_ADDRESS, MPU6050_PWR_MGMT_1, 0x80)) return false;
  // Mirror the Adafruit setup using checked writes and a bounded reset wait:
  // Adafruit 2.2.9 reset() otherwise waits forever for this bit to clear.
  uint32_t started = millis();
  do {
    sensorSetupDelay(1);
    if (!readRegisters(MPU_ADDRESS, MPU6050_PWR_MGMT_1, &power, 1)) return false;
    if (uint32_t(millis() - started) >= 500) return false;
  } while (power & 0x80);
  sensorSetupDelay(100);
  if (!writeRegister(MPU_ADDRESS, MPU6050_SIGNAL_PATH_RESET, 0x07)) return false;
  sensorSetupDelay(100);
  if (!writeRegister(MPU_ADDRESS, MPU6050_SMPLRT_DIV, 0) ||
      !writeRegister(MPU_ADDRESS, MPU6050_CONFIG, MPU6050_BAND_21_HZ) ||
      !writeRegister(MPU_ADDRESS, MPU6050_GYRO_CONFIG, MPU6050_RANGE_500_DEG << 3) ||
      !writeRegister(MPU_ADDRESS, MPU6050_ACCEL_CONFIG, MPU6050_RANGE_8_G << 3) ||
      !writeRegister(MPU_ADDRESS, MPU6050_PWR_MGMT_1, 0x01)) return false;
  sensorSetupDelay(100);
  uint8_t ranges[2];
  return readRegisters(MPU_ADDRESS, MPU6050_GYRO_CONFIG, ranges, 2) &&
         (ranges[0] & 0x18) == 0x08 && (ranges[1] & 0x18) == 0x10;
}

void opticalFailure() {
  opticalOk = false; haveOpticalSample = false; resetPpg();
  Serial.println("MAX30102 unavailable/configuration changed; readings are null, retrying.");
}

void samplePpg(uint32_t now) {
  if (!opticalOk) return;
  if (uint32_t(now - lastPpgPoll) > sentinelx::PPG_MAX_GAP_MS) {
    if (!clearOpticalFifo()) { opticalFailure(); return; }
  }
  lastPpgPoll = now;
  if (uint32_t(now - lastPpgConfigCheck) >= 1000) {
    lastPpgConfigCheck = now;
    if (!opticalConfigurationValid()) { opticalFailure(); return; }
  }
  uint8_t pointers[3];
  if (!readRegisters(OPTICAL_ADDRESS, 0x04, pointers, sizeof(pointers))) { opticalFailure(); return; }
  if ((pointers[0] | pointers[1] | pointers[2]) & 0xe0) { opticalFailure(); return; }
  if (pointers[1] != 0) {
    if (!clearOpticalFifo()) opticalFailure();
    return;
  }
  uint8_t samples = (pointers[0] - pointers[2]) & 0x1f;
  for (uint8_t i = 0; i < samples; ++i) {
    uint8_t raw[6];
    if (!readRegisters(OPTICAL_ADDRESS, 0x07, raw, sizeof(raw))) { opticalFailure(); return; }
    uint32_t red = sentinelx::optical18(raw), ir = sentinelx::optical18(raw + 3);
    lastOpticalSample = millis(); haveOpticalSample = true;
    bool full = ppg.push(ir, red, PPG_CONTACT_IR_MIN);
    if (ppg.count == 0) { resetPpg(); continue; }
    if (full) {
      int32_t hr, spo2; int8_t hrValid, spo2Valid;
      maxim_heart_rate_and_oxygen_saturation(ppg.ir, 100, ppg.red, &spo2, &spo2Valid, &hr, &hrValid);
      heartRate = hrValid && hr >= 30 && hr <= 220 ? hr : NAN;
      oxygen = spo2Valid && spo2 >= 0 && spo2 <= 100 ? spo2 : NAN;
      lastVitals = millis(); haveVitals = true; ppg.slide();
    }
  }
  uint32_t freshNow = millis();
  if ((haveOpticalSample && uint32_t(freshNow - lastOpticalSample) > sentinelx::PPG_MAX_GAP_MS) ||
      (haveVitals && uint32_t(freshNow - lastVitals) > 2500)) {
    resetPpg(); haveOpticalSample = false;
  }
}

void sampleMotion(uint32_t now) {
  if (!mpuOk || uint32_t(now - lastImu) < 20) return;
  lastImu = now;
  uint8_t raw[14], ranges[2];
  // Adafruit 2.2.9 getEvent() always returns true and ignores failed I2C reads.
  // Validate both the transfer length and configured scales before using data.
  if (!readRegisters(MPU_ADDRESS, MPU6050_GYRO_CONFIG, ranges, sizeof(ranges)) ||
      (ranges[0] & 0x18) != 0x08 || (ranges[1] & 0x18) != 0x10 ||
      !readRegisters(MPU_ADDRESS, MPU6050_ACCEL_OUT, raw, sizeof(raw))) {
    mpuOk = false; inactive = false; motion.invalidate(now);
    Serial.println("MPU6050 unavailable/configuration changed; motion candidate cleared, retrying."); return;
  }
  float ax = sentinelx::signedBigEndian(raw) / 4096.0f;
  float ay = sentinelx::signedBigEndian(raw + 2) / 4096.0f;
  float az = sentinelx::signedBigEndian(raw + 4) / 4096.0f;
  constexpr float gyroToRadians = 0.01745329252f / 65.5f;
  float gx = sentinelx::signedBigEndian(raw + 8) * gyroToRadians;
  float gy = sentinelx::signedBigEndian(raw + 10) * gyroToRadians;
  float gz = sentinelx::signedBigEndian(raw + 12) * gyroToRadians;
  bool candidate = motion.update(millis(), sqrtf(ax * ax + ay * ay + az * az),
      sqrtf(gx * gx + gy * gy + gz * gz), ENABLE_EXPERIMENTAL_FALL && !fallLatched,
      ENABLE_EXPERIMENTAL_INACTIVITY, INACTIVITY_MS);
  inactive = motion.inactive;
  if (candidate) {
    fallLatched = true;
    queueAlert("FALL_DETECTED", "Experimental low-g/impact/stillness candidate; verify worker condition");
  }
}

bool publishDocument(PubSubClient& mqtt, const char* topic, JsonDocument& doc) {
  char payload[1024];
  size_t needed = measureJson(doc);
  if (needed >= sizeof(payload)) { Serial.println("JSON exceeds publish buffer"); return false; }
  size_t size = serializeJson(doc, payload, sizeof(payload));
  return size == needed && mqtt.publish(topic, reinterpret_cast<const uint8_t*>(payload), size, false);
}

void networkTask(void*) {
  WiFiClient socket;
  PubSubClient mqtt(socket);
  mqtt.setServer(MQTT_HOST, MQTT_PORT); mqtt.setCallback(mqttAcknowledgement);
  if (!mqtt.setBufferSize(1536)) {
    Serial.println("MQTT buffer allocation failed; local sensors continue."); vTaskDelete(nullptr); return;
  }
  mqtt.setSocketTimeout(2); mqtt.setKeepAlive(15); socket.setConnectionTimeout(1500);
  WiFi.mode(WIFI_STA); WiFi.setAutoReconnect(true); WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  char clientId[112], telemetryTopic[112], subscribedAck[112] = "", timestamp[32];
  snprintf(clientId, sizeof(clientId), "sentinelx-%s-%s", HELMET_ID, bootId);
  snprintf(telemetryTopic, sizeof(telemetryTopic), "sentinelx/%s/telemetry", HELMET_ID);
  uint32_t lastConnect = 0, lastWifi = millis(), lastAlertAttempt = 0;
  char lastAttemptedId[72] = "";
  for (;;) {
    uint32_t now = millis();
    if (WiFi.status() != WL_CONNECTED) {
      subscribedAck[0] = '\0';
      if (uint32_t(now - lastWifi) > 15000) { lastWifi = now; WiFi.reconnect(); }
    } else if (!mqtt.connected()) {
      subscribedAck[0] = '\0'; lastAttemptedId[0] = '\0';
      if (uint32_t(now - lastConnect) >= 5000) {
        lastConnect = now;
        bool ok = strlen(MQTT_USER) ? mqtt.connect(clientId, MQTT_USER, MQTT_PASSWORD) : mqtt.connect(clientId);
        Serial.printf("MQTT %s (state %d)\n", ok ? "connected" : "retry", mqtt.state());
      }
    } else {
      mqtt.loop();
      sentinelx::StoredAlert pending{};
      if (mqtt.connected() && pendingAlert(pending) && prepareAlertTimestamp(pending)) {
        char ackTopic[112], alertTopic[112];
        // Stored identity is authoritative for old events after reassignment.
        snprintf(ackTopic, sizeof(ackTopic), "sentinelx/%s/ack", pending.helmetId);
        snprintf(alertTopic, sizeof(alertTopic), "sentinelx/%s/alert", pending.helmetId);
        bool subscribed = !strcmp(subscribedAck, ackTopic);
        if (!subscribed && mqtt.subscribe(ackTopic, 1)) {
          if (subscribedAck[0]) mqtt.unsubscribe(subscribedAck);
          strlcpy(subscribedAck, ackTopic, sizeof(subscribedAck)); subscribed = true;
        }
        if (subscribed && (strcmp(lastAttemptedId, pending.event.id) || uint32_t(now - lastAlertAttempt) >= 5000)) {
          JsonDocument doc;
          alertDocument(doc, pending.event, pending.helmetId, pending.workerId, pending.timestamp);
          publishDocument(mqtt, alertTopic, doc);
          strlcpy(lastAttemptedId, pending.event.id, sizeof(lastAttemptedId)); lastAlertAttempt = now;
          // QoS0 publish result never removes a durable event. Only matching
          // backend status:'persisted' ACK commits removal from the NVS outbox.
        }
      }
      Snapshot data;
      if (mqtt.connected() && xQueueReceive(telemetryQueue, &data, 0) == pdTRUE &&
          esp_timer_get_time() - data.capturedUs < 5000000 && isoTimestamp(data.capturedUs, timestamp, sizeof(timestamp))) {
        JsonDocument doc; char messageId[72];
        snprintf(messageId, sizeof(messageId), "%s-%lld", bootId, data.capturedUs);
        telemetryDocument(doc, data, messageId, HELMET_ID, WORKER_ID, timestamp);
        if (!publishDocument(mqtt, telemetryTopic, doc)) Serial.println("Telemetry publish failed");
      }
    }
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

void setup() {
  Serial.begin(115200);
  if (!HARDWARE_CONFIRMED) {
    Serial.println("Hardware disabled: verify board/pins and configure config.h first."); return;
  }
  if (strlen(HELMET_ID) >= sizeof(sentinelx::StoredAlert{}.helmetId) ||
      strlen(WORKER_ID) >= sizeof(sentinelx::StoredAlert{}.workerId) ||
      !strlen(HELMET_ID) || !strlen(WORKER_ID) || strpbrk(HELMET_ID, "/+#")) {
    Serial.println("Invalid worker/helmet identity; check config.h."); return;
  }
  telemetryQueue = xQueueCreate(1, sizeof(Snapshot));
  if (!telemetryQueue) { Serial.println("Queue allocation failed"); return; }
  snprintf(bootId, sizeof(bootId), "%012llx-%08lx", ESP.getEfuseMac(), (unsigned long)esp_random());
  beginOutbox();
  if (SOS_PIN >= 0) pinMode(SOS_PIN, INPUT_PULLUP);
  if (LED_PIN >= 0) { pinMode(LED_PIN, OUTPUT); digitalWrite(LED_PIN, LOW); }
  if (BUZZER_PIN >= 0) { pinMode(BUZZER_PIN, OUTPUT); setBuzzer(false); }
  Wire.begin(I2C_SDA, I2C_SCL); Wire.setTimeOut(20);
  mpuOk = initializeMotion(); opticalOk = initializeOptical();
  dht.begin(); analogReadResolution(12); analogSetPinAttenuation(GAS_PIN, ADC_11db);
  lastSensorRetry = millis();
  Serial.printf("MPU6050: %s, MAX30102: %s\n", mpuOk ? "found" : "missing", opticalOk ? "found" : "missing");
  if (NETWORK_ENABLED && xTaskCreate(networkTask, "mqtt", 8192, nullptr, 1, nullptr) != pdPASS)
    Serial.println("Network task creation failed; local sensors only.");
  ready = true;
}

void loop() {
  if (!ready) { delay(100); return; }
  serviceLocal(millis()); samplePpg(millis()); sampleMotion(millis());
  uint32_t now = millis();
  if (uint32_t(now - lastSensorRetry) >= 5000 && (!mpuOk || !opticalOk)) {
    lastSensorRetry = now;
    if (!mpuOk) mpuOk = initializeMotion();
    if (!opticalOk) opticalOk = initializeOptical();
  }
  now = millis();
  if (uint32_t(now - lastDht) >= 2500) {
    lastDht = now; temperature = dht.readTemperature(); humidity = dht.readHumidity();
    if (!isfinite(temperature) || !isfinite(humidity) || humidity < 0 || humidity > 100) {
      temperature = NAN; humidity = NAN;
    }
  }
  now = millis();
  if (uint32_t(now - lastGas) >= 250) {
    lastGas = now;
    gasRaw = sentinelx::gasForContract(analogRead(GAS_PIN), GAS_CONDITIONING_CONFIRMED,
                                     esp_timer_get_time(), GAS_WARMUP_MS);
  }
  if (gasRaw >= 650 || (isfinite(temperature) && temperature >= 38) ||
      (isfinite(heartRate) && (heartRate <= 50 || heartRate >= 125)) ||
      (isfinite(oxygen) && oxygen <= 92)) alarmLatched = true;
  if (uint32_t(now - lastTelemetry) >= 2000) {
    lastTelemetry = now;
    Snapshot data{esp_timer_get_time(), heartRate, oxygen, temperature, humidity, gasRaw, fallLatched, inactive};
    xQueueOverwrite(telemetryQueue, &data);
    Serial.printf("hr=%.1f spo2=%.1f temp=%.1f humidity=%.1f gas10=%d fall=%d alarm=%d\n",
                  heartRate, oxygen, temperature, humidity, gasRaw, fallLatched, alarmLatched);
  }
  delay(1);
}
