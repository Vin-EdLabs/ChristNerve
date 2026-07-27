-- Per-tenant PWA branding
ALTER TABLE church_tenants
  ADD COLUMN IF NOT EXISTS brand_color VARCHAR(20) DEFAULT '#2D1B69';

ALTER TABLE church_tenants
  ADD COLUMN IF NOT EXISTS short_name VARCHAR(50);
