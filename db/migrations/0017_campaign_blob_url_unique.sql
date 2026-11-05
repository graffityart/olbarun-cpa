-- Avoid duplicate metadata rows when Vercel Blob completion callbacks retry.
CREATE UNIQUE INDEX IF NOT EXISTS campaign_blob_materials_blob_url_unique_idx
ON campaign_blob_materials(blob_url);
