#pragma once
#include "payload.h"
#include <string.h>

namespace sentinelx {
constexpr uint32_t OUTBOX_MAGIC = 0x53584f42;
constexpr uint32_t OUTBOX_VERSION = 1;
constexpr size_t OUTBOX_CAPACITY = 8;
struct StoredAlert {
  AlertEvent event{};
  char helmetId[48]{}, workerId[48]{}, capturedBoot[40]{}, timestamp[32]{};
};

template <size_t N> bool validText(const char (&value)[N], bool required = true) {
  return memchr(value, '\0', N) && (!required || value[0]);
}
struct AlertOutbox {
  uint32_t magic = OUTBOX_MAGIC, version = OUTBOX_VERSION, count = 0;
  StoredAlert items[OUTBOX_CAPACITY]{};
  bool valid() const {
    if (magic != OUTBOX_MAGIC || version != OUTBOX_VERSION || count > OUTBOX_CAPACITY) return false;
    for (uint32_t i = 0; i < count; ++i) {
      const auto& r = items[i];
      if (!validText(r.event.id) || !validText(r.event.type) || !validText(r.event.description, false) ||
          !validText(r.helmetId) || !validText(r.workerId) || !validText(r.capturedBoot) ||
          !validText(r.timestamp, false)) return false;
    }
    return true;
  }
  bool append(const StoredAlert& event) {
    if (count == OUTBOX_CAPACITY) return false;
    items[count++] = event; return true;
  }
  int find(const char* helmet, const char* worker, const char* event) const {
    if (!helmet || !worker || !event) return -1;
    for (uint32_t i = 0; i < count; ++i)
      if (!strcmp(items[i].helmetId, helmet) && !strcmp(items[i].workerId, worker) &&
          !strcmp(items[i].event.id, event)) return static_cast<int>(i);
    return -1;
  }
  bool remove(int index) {
    if (index < 0 || static_cast<uint32_t>(index) >= count) return false;
    for (uint32_t i = static_cast<uint32_t>(index) + 1; i < count; ++i) items[i - 1] = items[i];
    items[--count] = StoredAlert{}; return true;
  }
};
} // namespace sentinelx
