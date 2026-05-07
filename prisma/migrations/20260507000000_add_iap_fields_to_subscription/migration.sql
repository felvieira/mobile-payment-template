-- CreateTable (if not exists from previous migrations applied directly)
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateTable (if not exists)
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerSubId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_provider_providerSubId_key" ON "Subscription"("provider", "providerSubId");
CREATE INDEX IF NOT EXISTS "Subscription_userId_idx" ON "Subscription"("userId");
CREATE INDEX IF NOT EXISTS "Subscription_customerEmail_idx" ON "Subscription"("customerEmail");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");

-- CreateTable (if not exists)
CREATE TABLE IF NOT EXISTS "IAPReceipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "purchaseToken" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IAPReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IAPReceipt_purchaseToken_key" ON "IAPReceipt"("purchaseToken");
CREATE INDEX IF NOT EXISTS "IAPReceipt_userId_idx" ON "IAPReceipt"("userId");
CREATE INDEX IF NOT EXISTS "IAPReceipt_customerEmail_idx" ON "IAPReceipt"("customerEmail");

-- AlterTable: add new IAP fields to Subscription
ALTER TABLE "Subscription"
    ADD COLUMN IF NOT EXISTS "currentPeriodStart" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "platform" TEXT,
    ADD COLUMN IF NOT EXISTS "source" TEXT,
    ADD COLUMN IF NOT EXISTS "productId" TEXT,
    ADD COLUMN IF NOT EXISTS "purchaseToken" TEXT,
    ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex for purchaseToken
CREATE INDEX IF NOT EXISTS "Subscription_purchaseToken_idx" ON "Subscription"("purchaseToken");
