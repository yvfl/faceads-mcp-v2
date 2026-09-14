CREATE TABLE "oauth_used_refresh_tokens" (
  "refresh_token" TEXT NOT NULL PRIMARY KEY,
  "operation_owner_id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL REFERENCES "oauth_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "resource" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "retain_until" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "oauth_used_refresh_tokens_retain_until_idx" ON "oauth_used_refresh_tokens"("retain_until");
CREATE INDEX "oauth_access_tokens_operation_owner_id_idx" ON "oauth_access_tokens"("operation_owner_id");
