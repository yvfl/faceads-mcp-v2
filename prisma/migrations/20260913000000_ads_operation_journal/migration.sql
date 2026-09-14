CREATE TABLE "ads_operations" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "owner_hash" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "record" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ads_operations_status_check" CHECK ("status" IN ('pending', 'succeeded', 'failed', 'unknown'))
);
CREATE INDEX "ads_operations_owner_hash_request_id_idx" ON "ads_operations" ("owner_hash", "request_id");
CREATE INDEX "ads_operations_owner_hash_fingerprint_status_idx" ON "ads_operations" ("owner_hash", "fingerprint", "status");
