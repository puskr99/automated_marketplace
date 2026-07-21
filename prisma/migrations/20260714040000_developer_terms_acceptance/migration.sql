-- Tracks when a developer accepted the developer terms/privacy gate shown
-- before "Publish a worker". Null means not yet accepted.
ALTER TABLE "developer_profiles" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
