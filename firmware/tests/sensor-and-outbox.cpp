#include "../sentinelx_esp32/sensor_logic.h"
#include "../sentinelx_esp32/alert_outbox.h"
#include <cassert>
#include <iostream>
#include <cstring>
#include <limits>
using namespace sentinelx;

static void testPpgWindows() {
  PpgWindow window;
  for (uint32_t i = 0; i < 100; ++i)
    assert(window.push(60000 + i, 40000 + i, 50000) == (i == 99));
  window.slide();
  assert(window.count == 75 && window.ir[0] == 60025 && window.ir[74] == 60099);
  for (uint32_t i = 0; i < 25; ++i)
    assert(window.push(60100 + i, 40100 + i, 50000) == (i == 24));
  assert(window.ir[0] == 60025 && window.ir[99] == 60124);
  assert(!window.push(49999, 40000, 50000) && window.count == 0);
  assert(!window.push(60000, 0, 50000) && window.count == 0);
  assert(!window.push(260000, 40000, 50000) && window.count == 0);
  assert(!window.push(60000, 260000, 50000) && window.count == 0);
  // Loss of contact requires a whole new four-second window.
  for (uint32_t i = 0; i < 99; ++i) assert(!window.push(60000, 40000, 50000));
  assert(window.push(60000, 40000, 50000));
}

static bool fallSequence(uint32_t base) {
  MotionTracker motion;
  assert(!motion.update(base, 0.2f, 0, true, true, 60000));
  assert(!motion.update(base + 20, 3.8f, 0.8f, true, true, 60000));
  for (uint32_t elapsed = 40; elapsed < 2040; elapsed += 20)
    assert(!motion.update(base + elapsed, 1.0f, 0.01f, true, true, 60000));
  return motion.update(base + 2040, 1.0f, 0.01f, true, true, 60000);
}
static void testMotion() {
  assert(fallSequence(1000));
  assert(fallSequence(std::numeric_limits<uint32_t>::max() - 1000));
  // Stillness starting exactly at millis()==0 must be represented explicitly.
  assert(fallSequence(std::numeric_limits<uint32_t>::max() - 39));
  MotionTracker motion;
  motion.update(0, 0.2f, 0, true, true, 1000);
  motion.update(20, 4.0f, 1, true, true, 1000);
  motion.update(40, 1, 0, true, true, 1000);
  // A sensor outage cannot be counted as stillness in a fall sequence.
  assert(!motion.update(3000, 1, 0, true, true, 1000));
  assert(motion.phase == 0 && !motion.inactive);
  for (uint32_t now = 3020; now <= 4000; now += 20)
    assert(!motion.update(now, 1, 0, true, true, 1000));
  assert(motion.inactive);
  motion.invalidate(4020);
  assert(!motion.inactive && motion.phase == 0 && !motion.haveSample);
  assert(!motion.update(4030, NAN, 0, true, true, 1000));
  assert(!motion.haveSample);
  // Impact alone, ordinary movement, and expired low-g cannot create a fall.
  MotionTracker normal;
  assert(!normal.update(0, 4, 1, true, false, 1000));
  for (uint32_t now = 20; now < 3000; now += 20) assert(!normal.update(now, 1, 0, true, false, 1000));
  assert(normal.phase == 0 && !normal.inactive);
  normal.update(3000, 0.2f, 0, true, false, 1000);
  for (uint32_t now = 3020; now <= 4100; now += 20) normal.update(now, 1, 0, true, false, 1000);
  assert(normal.phase == 0);
  assert(!normal.update(4120, 4, 1, true, false, 1000));
  assert(!normal.update(4140, 0.2f, 0, false, false, 1000) && normal.phase == 0);
}

static StoredAlert record(const char* id, const char* helmet = "H-201", const char* worker = "W-101") {
  StoredAlert result{};
  std::strcpy(result.event.id, id); std::strcpy(result.event.type, "FALL_DETECTED");
  std::strcpy(result.event.description, "Bench fixture");
  std::strcpy(result.helmetId, helmet); std::strcpy(result.workerId, worker);
  std::strcpy(result.capturedBoot, "previous-boot");
  return result;
}
static void testOutbox() {
  AlertOutbox outbox;
  assert(outbox.valid() && outbox.count == 0);
  assert(outbox.append(record("old-event")));
  assert(outbox.append(record("new-event", "H-202", "W-102")));
  // A byte-for-byte stored record can survive restart and preserves old identity.
  unsigned char persisted[sizeof(outbox)]; std::memcpy(persisted, &outbox, sizeof(outbox));
  AlertOutbox restored; std::memcpy(&restored, persisted, sizeof(restored));
  assert(restored.valid());
  assert(restored.find("H-201", "W-101", "old-event") == 0);
  assert(restored.find("H-201", "W-102", "old-event") == -1);
  assert(restored.find("H-202", "W-101", "old-event") == -1);
  assert(restored.find("H-201", "W-101", "new-event") == -1);
  assert(restored.find(nullptr, "W-101", "old-event") == -1);
  // PubSubClient socket success does not mutate this state; only an ACK match
  // is supplied to remove(). Duplicate/stale ACKs must not remove a new event.
  assert(!restored.remove(restored.find("H-201", "W-102", "old-event")) && restored.count == 2);
  assert(restored.remove(restored.find("H-201", "W-101", "old-event")));
  assert(restored.count == 1 && !strcmp(restored.items[0].event.id, "new-event"));
  assert(!restored.remove(restored.find("H-201", "W-101", "old-event")) && restored.count == 1);
  for (size_t i = 1; i < OUTBOX_CAPACITY; ++i) {
    char id[32]; std::snprintf(id, sizeof(id), "event-%zu", i); assert(restored.append(record(id)));
  }
  assert(!restored.append(record("overflow")) && restored.count == OUTBOX_CAPACITY);
  assert(!strcmp(restored.items[0].event.id, "new-event"));
  assert(restored.valid());
  restored.count = OUTBOX_CAPACITY + 1; assert(!restored.valid());
  restored.count = 1; restored.version = 9000; assert(!restored.valid());
  restored.version = OUTBOX_VERSION;
  std::memset(restored.items[0].event.id, 'x', sizeof(restored.items[0].event.id));
  assert(!restored.valid());
}
static void testConversions() {
  assert(gasForContract(4095, false, 999999999, 180000) == -1);
  assert(gasForContract(4095, true, 179999999, 180000) == -1);
  assert(gasForContract(4095, true, 180000000, 180000) == 1023);
  assert(gasForContract(0, true, 180000000, 180000) == 0);
  assert(gasForContract(2048, true, 180000000, 180000) == 512);
  assert(gasForContract(4096, true, 180000000, 180000) == -1);
  assert(gasForContract(4095, true, (int64_t(1) << 32) * 1000, 180000) == 1023);
  uint8_t negative[] = {0x80, 0x00}, maximum[] = {0x7f, 0xff}, optical[] = {0xff, 0xff, 0xff};
  assert(signedBigEndian(negative) == -32768 && signedBigEndian(maximum) == 32767);
  assert(optical18(optical) == 262143);
}
int main() {
  testPpgWindows(); testMotion(); testOutbox(); testConversions();
  std::cout << "PASS: PPG contact/saturation/window continuity; fall timing/outages/millis wrap; "
               "gas warmup/ADC conversion; durable outbox format/identity/capacity/duplicate ACK state\n";
}
