-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "token_type" TEXT NOT NULL DEFAULT 'user',
    "ad_account_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "scopes" TEXT,
    "meta_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_clients" (
    "id" TEXT NOT NULL,
    "client_secret" TEXT,
    "token_endpoint_auth_method" TEXT NOT NULL DEFAULT 'none',
    "client_name" TEXT NOT NULL,
    "redirect_uris" TEXT[],
    "grant_types" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorization_codes" (
    "code" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT '',
    "code_challenge" TEXT NOT NULL,
    "code_challenge_method" TEXT NOT NULL DEFAULT 'S256',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "resource" TEXT NOT NULL,
    "selected_account_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "meta_token_id" TEXT NOT NULL,

    CONSTRAINT "authorization_codes_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "oauth_access_tokens" (
    "token" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT '',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resource" TEXT NOT NULL,
    "selected_account_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "meta_token_id" TEXT NOT NULL,
    "refresh_expires_at" TIMESTAMP(3),

    CONSTRAINT "oauth_access_tokens_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "oauth_flows" (
    "id" TEXT NOT NULL,
    "browser_secret_hash" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "code_challenge" TEXT NOT NULL,
    "state" TEXT,
    "user_id" TEXT,
    "pending_meta_token" TEXT,
    "meta_user_id" TEXT,
    "accounts" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_flows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "meta_tokens_user_id_idx" ON "meta_tokens"("user_id");

-- CreateIndex
CREATE INDEX "authorization_codes_client_id_idx" ON "authorization_codes"("client_id");

-- CreateIndex
CREATE INDEX "authorization_codes_user_id_idx" ON "authorization_codes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_access_tokens_refresh_token_key" ON "oauth_access_tokens"("refresh_token");

-- CreateIndex
CREATE INDEX "oauth_access_tokens_client_id_idx" ON "oauth_access_tokens"("client_id");

-- CreateIndex
CREATE INDEX "oauth_access_tokens_user_id_idx" ON "oauth_access_tokens"("user_id");

-- CreateIndex
CREATE INDEX "oauth_access_tokens_refresh_token_idx" ON "oauth_access_tokens"("refresh_token");

-- CreateIndex
CREATE INDEX "oauth_flows_expires_at_idx" ON "oauth_flows"("expires_at");

-- AddForeignKey
ALTER TABLE "meta_tokens" ADD CONSTRAINT "meta_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorization_codes" ADD CONSTRAINT "authorization_codes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorization_codes" ADD CONSTRAINT "authorization_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

