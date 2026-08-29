-- Must be its own migration/transaction — Postgres forbids using a freshly
-- ALTER TYPE ... ADD VALUE'd enum value in the same transaction that added it.
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'case';
