-- Additive only: preserve all historical data and its unknown provenance.
-- NULL = unknown, TRUE = simulated, FALSE = hardware-reported.
ALTER TABLE "sensor_readings" ADD COLUMN IF NOT EXISTS "is_simulated" BOOLEAN;
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "is_simulated" BOOLEAN;

-- Durable alert receipt shares one transaction with incident creation/reuse.
CREATE TABLE IF NOT EXISTS "alert_receipts" (
  "helmet_id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "worker_id" TEXT NOT NULL,
  "is_simulated" BOOLEAN,
  "incident_id" TEXT NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "alert_receipts_pkey" PRIMARY KEY ("helmet_id", "event_id"),
  CONSTRAINT "alert_receipts_incident_id_fkey" FOREIGN KEY ("incident_id")
    REFERENCES "incidents"("incident_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "alert_receipts_incident_id_idx" ON "alert_receipts"("incident_id");
