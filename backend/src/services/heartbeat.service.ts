import { prisma } from '../config/db.js';
import { config } from '../config/index.js';
import { ConnectivityStatus } from '../types/index.js';
import { emitHelmetStatus } from '../socket/io.js';

export class HeartbeatService {
  private static timer: NodeJS.Timeout | null = null;
  private static helmetCache = new Map<string, { lastSeen: Date; status: ConnectivityStatus }>();

  public static async recordPing(helmetId: string, _deviceTimestamp?: Date) {
    // Record arrival timestamp at the gateway
    const arrivalTime = new Date();
    const cached = this.helmetCache.get(helmetId);

    if (!cached || cached.status === ConnectivityStatus.OFFLINE) {
      // Transition from OFFLINE to ONLINE
      this.helmetCache.set(helmetId, { lastSeen: arrivalTime, status: ConnectivityStatus.ONLINE });
      try {
        await prisma.helmet.update({
          where: { helmetId },
          data: {
            connectivityStatus: ConnectivityStatus.ONLINE,
            lastSeen: arrivalTime,
          },
        });
        console.log(`🟢 [HeartbeatService] Helmet ${helmetId} is ONLINE`);
        emitHelmetStatus({ helmetId, status: ConnectivityStatus.ONLINE, lastSeen: arrivalTime });
      } catch (err) {
        console.error(`[HeartbeatService] Error marking helmet ${helmetId} ONLINE:`, err);
      }
    } else {
      // Update cached and db timestamp
      this.helmetCache.set(helmetId, { lastSeen: arrivalTime, status: ConnectivityStatus.ONLINE });
      // Update DB timestamp
      prisma.helmet.update({
        where: { helmetId },
        data: { lastSeen: arrivalTime },
      }).catch(() => {});
    }
  }

  public static startWatchdog() {
    if (this.timer) return;

    console.log(`[HeartbeatService] Watchdog started with timeout = ${config.heartbeatTimeoutMs}ms`);

    this.timer = setInterval(async () => {
      try {
        const now = Date.now();
        const helmets = await prisma.helmet.findMany();

        for (const helmet of helmets) {
          const timeSinceSeen = now - new Date(helmet.lastSeen).getTime();

          if (timeSinceSeen > config.heartbeatTimeoutMs && helmet.connectivityStatus === ConnectivityStatus.ONLINE) {
            // Mark as OFFLINE
            await prisma.helmet.update({
              where: { helmetId: helmet.helmetId },
              data: { connectivityStatus: ConnectivityStatus.OFFLINE },
            });

            this.helmetCache.set(helmet.helmetId, {
              lastSeen: helmet.lastSeen,
              status: ConnectivityStatus.OFFLINE,
            });

            console.log(`🔴 [HeartbeatService] Helmet ${helmet.helmetId} TIMEOUT (${Math.round(timeSinceSeen/1000)}s)! Marked OFFLINE.`);
            emitHelmetStatus({
              helmetId: helmet.helmetId,
              status: ConnectivityStatus.OFFLINE,
              lastSeen: helmet.lastSeen,
            });
          }
        }
      } catch (err) {
        console.error('[HeartbeatService] Watchdog check error:', err);
      }
    }, config.thresholds.heartbeatWatchdogIntervalMs);
  }

  public static stopWatchdog() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
