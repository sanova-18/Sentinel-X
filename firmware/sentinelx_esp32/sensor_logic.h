#pragma once
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <math.h>

// Host-testable state used by the actual sensor task. All short elapsed-time
// comparisons use unsigned subtraction so millis() wrapping is harmless.
namespace sentinelx {
constexpr uint32_t PPG_MAX_GAP_MS = 250;
constexpr uint32_t IMU_MAX_GAP_MS = 200;

inline int16_t signedBigEndian(const uint8_t* bytes) {
  return static_cast<int16_t>((uint16_t(bytes[0]) << 8) | bytes[1]);
}
inline uint32_t optical18(const uint8_t* bytes) {
  return ((uint32_t(bytes[0]) << 16) | (uint32_t(bytes[1]) << 8) | bytes[2]) & 0x3ffff;
}
inline int gasForContract(int raw12, bool conditioned, int64_t uptimeUs, uint32_t warmupMs) {
  if (!conditioned || uptimeUs < int64_t(warmupMs) * 1000 || raw12 < 0 || raw12 > 4095) return -1;
  return (raw12 * 1023L + 2047) / 4095;
}

struct PpgWindow {
  uint32_t ir[100]{}, red[100]{};
  size_t count = 0;
  void reset() { count = 0; }
  bool push(uint32_t irValue, uint32_t redValue, uint32_t contactMinimum) {
    if (irValue < contactMinimum || redValue == 0 || irValue >= 260000 || redValue >= 260000) {
      reset(); return false;
    }
    if (count >= 100) slide();
    ir[count] = irValue; red[count] = redValue;
    return ++count == 100;
  }
  void slide() {
    if (count != 100) return;
    memmove(ir, ir + 25, 75 * sizeof(uint32_t));
    memmove(red, red + 25, 75 * sizeof(uint32_t));
    count = 75;
  }
};

struct MotionTracker {
  uint8_t phase = 0;
  bool haveSample = false, trackingStillness = false, inactive = false;
  uint32_t lastSample = 0, lastMotion = 0, phaseAt = 0, stillAt = 0;
  void invalidate(uint32_t now) {
    phase = 0; trackingStillness = false; haveSample = false;
    inactive = false; lastMotion = now;
  }
  // Returns a fall candidate only after contiguous low-g/impact/stillness data.
  bool update(uint32_t now, float g, float rotation, bool enableFall,
              bool enableInactivity, uint32_t inactivityMs) {
    if (!isfinite(g) || !isfinite(rotation)) { invalidate(now); return false; }
    if (!haveSample || uint32_t(now - lastSample) > IMU_MAX_GAP_MS) invalidate(now);
    haveSample = true; lastSample = now;
    bool still = fabsf(g - 1.0f) < 0.12f && rotation < 0.15f;
    if (!still) lastMotion = now;
    inactive = enableInactivity && uint32_t(now - lastMotion) >= inactivityMs;
    if (!enableFall) { phase = 0; trackingStillness = false; return false; }
    if (phase == 0 && g < 0.5f) { phase = 1; phaseAt = now; }
    else if (phase == 1) {
      if (uint32_t(now - phaseAt) > 1000) phase = 0;
      else if (g > 3.0f) { phase = 2; phaseAt = now; trackingStillness = false; }
    } else if (phase == 2) {
      if (uint32_t(now - phaseAt) > 5000) { phase = 0; trackingStillness = false; }
      else if (!still) trackingStillness = false;
      else if (!trackingStillness) { trackingStillness = true; stillAt = now; }
      else if (uint32_t(now - stillAt) >= 2000) {
        phase = 0; trackingStillness = false; return true;
      }
    }
    return false;
  }
};
} // namespace sentinelx
