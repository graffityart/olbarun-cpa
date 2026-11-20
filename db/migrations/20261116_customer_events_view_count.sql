-- Add the column read by the home page event preview.
-- Additive, idempotent migration; does not modify existing event counts.
-- Apply only after the customer_events table has been created.
ALTER TABLE public.customer_events
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;
