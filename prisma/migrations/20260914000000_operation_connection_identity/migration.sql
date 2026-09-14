ALTER TABLE "oauth_access_tokens" ADD COLUMN "operation_owner_id" TEXT;
UPDATE "oauth_access_tokens" SET "operation_owner_id" = gen_random_uuid()::text;
ALTER TABLE "oauth_access_tokens" ALTER COLUMN "operation_owner_id" SET NOT NULL;
