-- The current grant row is created on issuance and recreated on each refresh.
-- Extend only still-valid refresh credentials; never revive an expired/revoked grant.
UPDATE "oauth_access_tokens"
SET "refresh_expires_at" = GREATEST("refresh_expires_at", "created_at" + INTERVAL '90 days')
WHERE "refresh_token" IS NOT NULL AND "refresh_expires_at" > CURRENT_TIMESTAMP;
