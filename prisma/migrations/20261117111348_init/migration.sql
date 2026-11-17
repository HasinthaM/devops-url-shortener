-- CreateTable
CREATE TABLE "urls" (
    "id" UUID NOT NULL,
    "original_url" TEXT NOT NULL,
    "short_code" VARCHAR(16) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "expires_at" TIMESTAMPTZ,

    CONSTRAINT "urls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "url_click_analytics" (
    "id" UUID NOT NULL,
    "url_id" UUID NOT NULL,
    "clicked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referrer" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "url_click_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "urls_short_code_key" ON "urls"("short_code");

-- CreateIndex
CREATE INDEX "urls_created_at_idx" ON "urls"("created_at");

-- CreateIndex
CREATE INDEX "urls_is_active_expires_at_idx" ON "urls"("is_active", "expires_at");

-- CreateIndex
CREATE INDEX "url_click_analytics_url_id_idx" ON "url_click_analytics"("url_id");

-- CreateIndex
CREATE INDEX "url_click_analytics_clicked_at_idx" ON "url_click_analytics"("clicked_at");

-- AddForeignKey
ALTER TABLE "url_click_analytics" ADD CONSTRAINT "url_click_analytics_url_id_fkey" FOREIGN KEY ("url_id") REFERENCES "urls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
