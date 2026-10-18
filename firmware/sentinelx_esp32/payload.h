#pragma once
#include <ArduinoJson.h>
#include <stdint.h>
#include <math.h>

struct Snapshot {
  int64_t capturedUs;
  float hr, spo2, temp, humidity;
  int gas;
  bool fall, inactive;
};
struct AlertEvent {
  int64_t capturedUs;
  char id[72], type[32], description[140];
};

template <typename T>
inline void numberOrNull(T field, float value) {
  if (isfinite(value)) field.set(value); else field.set(nullptr);
}

inline void telemetryDocument(JsonDocument& doc, const Snapshot& data,
                              const char* messageId, const char* helmetId,
                              const char* workerId, const char* timestamp) {
  doc["messageId"] = messageId; doc["helmetId"] = helmetId; doc["workerId"] = workerId;
  doc["timestamp"] = timestamp; doc["isSimulated"] = false;
  numberOrNull(doc["vitals"]["heartRate"], data.hr);
  numberOrNull(doc["vitals"]["spo2"], data.spo2);
  numberOrNull(doc["environment"]["temperature"], data.temp);
  numberOrNull(doc["environment"]["humidity"], data.humidity);
  if (data.gas >= 0) doc["environment"]["gasRaw"] = data.gas;
  else doc["environment"]["gasRaw"] = nullptr;
  doc["motion"]["fallDetected"] = data.fall;
  doc["motion"]["inactivityDetected"] = data.inactive;
}

inline void alertDocument(JsonDocument& doc, const AlertEvent& data,
                          const char* helmetId, const char* workerId, const char* timestamp) {
  doc["eventId"] = data.id; doc["helmetId"] = helmetId; doc["workerId"] = workerId;
  doc["timestamp"] = timestamp; doc["alertType"] = data.type;
  doc["severity"] = "CRITICAL"; doc["description"] = data.description;
  doc["isSimulated"] = false;
}
