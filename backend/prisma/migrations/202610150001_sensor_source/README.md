# Source provenance migration

This database previously used `prisma db push` and has no baseline migration history.
Do not run `prisma migrate reset` or reseed it. Apply this reviewed additive SQL to
an existing database with `prisma db execute --file prisma/migrations/202610150001_sensor_source/migration.sql --schema prisma/schema.prisma`,
then run `prisma generate` and restart the backend. It adds two nullable columns
and a durable alert receipt table, without updating, deleting or relabelling existing records. Establish a migration
baseline before adopting `prisma migrate deploy` on a fresh database.

`isSimulated`: `true` = simulator, `false` = hardware-reported, `null` = unknown.
The source flag is sender-declared provenance, not authentication or proof of
physical measurements. Historical rows remain unknown.

Immediate MQTT alerts use application acknowledgements on
`sentinelx/{helmetId}/ack` with `{helmetId, workerId, eventId, status: "persisted"}`
at QoS 1, non-retained. The receipt and incident commit together. Duplicate event
IDs for the same helmet are acknowledged only after their persisted identity,
source and alert type are checked. Receipt rows survive restarts; deleting their
incident deliberately also deletes its receipts. Ordinary incident resolution
preserves receipts. This is prototype delivery support, not a certified alarm path.
