// Host test of the exact JSON builders used in the ESP32 sketch.
#include "../sentinelx_esp32/payload.h"
#include <iostream>
int main() {
  const char* timestamp = "2026-10-15T00:00:00Z";
  Snapshot normal{0, 76, 98, 27, 54, 200, false, false};
  Snapshot missing{0, NAN, NAN, NAN, NAN, -1, false, false};
  for (const Snapshot& data : {normal, missing}) {
    JsonDocument doc;
    telemetryDocument(doc, data, "host-fixture", "H-201", "W-101", timestamp);
    serializeJson(doc, std::cout); std::cout << '\n';
  }
  AlertEvent event{0, "host-event", "SOS_TRIGGERED", "Host serialization fixture"};
  JsonDocument doc;
  alertDocument(doc, event, "H-201", "W-101", timestamp);
  serializeJson(doc, std::cout); std::cout << '\n';
}
