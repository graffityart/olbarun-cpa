-- Administrator-provided files for posting campaigns. Apply before deploying the upload API.
CREATE TABLE IF NOT EXISTS posting_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  filename varchar(180) NOT NULL,
  mime_type varchar(100) NOT NULL,
  file_size integer NOT NULL CHECK (file_size > 0 AND file_size <= 5242880),
  file_data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS posting_materials_campaign_idx ON posting_materials(campaign_id);
