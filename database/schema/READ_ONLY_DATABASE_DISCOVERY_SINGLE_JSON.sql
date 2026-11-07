-- EduLedger Read-Only Schema Discovery (Single JSON Output for Supabase / Neon / psql)
-- Safe, read-only catalog extraction. Never mutates data. Always rolls back.
BEGIN TRANSACTION READ ONLY;

WITH 
target_info AS (
  SELECT jsonb_build_object(
    'database_name', current_database(),
    'effective_role', current_user,
    'login_role', session_user,
    'server_version', current_setting('server_version'),
    'server_address', inet_server_addr()::text,
    'server_port', inet_server_port()
  ) AS data
),
extensions_info AS (
  SELECT jsonb_agg(jsonb_build_object(
    'extension_name', e.extname,
    'extension_version', e.extversion,
    'schema_name', n.nspname
  ) ORDER BY e.extname) AS data
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
),
tables_info AS (
  SELECT jsonb_agg(jsonb_build_object(
    'schema_name', n.nspname,
    'object_name', c.relname,
    'object_type', CASE c.relkind
      WHEN 'r' THEN 'table'
      WHEN 'p' THEN 'partitioned table'
      WHEN 'v' THEN 'view'
      WHEN 'm' THEN 'materialized view'
      WHEN 'S' THEN 'sequence'
      ELSE c.relkind::text
    END,
    'rls_enabled', c.relrowsecurity,
    'rls_forced', c.relforcerowsecurity
  ) ORDER BY n.nspname, c.relname) AS data
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND n.nspname NOT LIKE 'pg_toast%'
    AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
),
columns_info AS (
  SELECT jsonb_agg(jsonb_build_object(
    'table_schema', table_schema,
    'table_name', table_name,
    'ordinal_position', ordinal_position,
    'column_name', column_name,
    'data_type', data_type,
    'is_nullable', is_nullable,
    'column_default', column_default
  ) ORDER BY table_schema, table_name, ordinal_position) AS data
  FROM information_schema.columns
  WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
),
constraints_info AS (
  SELECT jsonb_agg(jsonb_build_object(
    'schema_name', n.nspname,
    'table_name', t.relname,
    'constraint_name', con.conname,
    'constraint_type', CASE con.contype
      WHEN 'p' THEN 'primary key'
      WHEN 'f' THEN 'foreign key'
      WHEN 'u' THEN 'unique'
      WHEN 'c' THEN 'check'
      WHEN 'x' THEN 'exclusion'
      ELSE con.contype::text
    END,
    'definition', pg_get_constraintdef(con.oid, true)
  ) ORDER BY n.nspname, t.relname, con.conname) AS data
  FROM pg_constraint con
  JOIN pg_class t ON t.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
),
indexes_info AS (
  SELECT jsonb_agg(jsonb_build_object(
    'schema_name', schemaname,
    'table_name', tablename,
    'index_name', indexname,
    'definition', indexdef
  ) ORDER BY schemaname, tablename, indexname) AS data
  FROM pg_indexes
  WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
),
policies_info AS (
  SELECT jsonb_agg(jsonb_build_object(
    'schema_name', schemaname,
    'table_name', tablename,
    'policyname', policyname,
    'cmd', cmd,
    'roles', roles
  ) ORDER BY schemaname, tablename, policyname) AS data
  FROM pg_policies
  WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
),
migration_candidates AS (
  SELECT jsonb_agg(jsonb_build_object(
    'schema_name', n.nspname,
    'table_name', c.relname
  ) ORDER BY n.nspname, c.relname) AS data
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p')
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND c.relname ILIKE '%migration%'
)
SELECT jsonb_pretty(jsonb_build_object(
  'generated_at', CURRENT_TIMESTAMP,
  'target', (SELECT data FROM target_info),
  'extensions', (SELECT COALESCE(data, '[]'::jsonb) FROM extensions_info),
  'tables', (SELECT COALESCE(data, '[]'::jsonb) FROM tables_info),
  'columns', (SELECT COALESCE(data, '[]'::jsonb) FROM columns_info),
  'constraints', (SELECT COALESCE(data, '[]'::jsonb) FROM constraints_info),
  'indexes', (SELECT COALESCE(data, '[]'::jsonb) FROM indexes_info),
  'policies', (SELECT COALESCE(data, '[]'::jsonb) FROM policies_info),
  'migration_tables', (SELECT COALESCE(data, '[]'::jsonb) FROM migration_candidates)
)) AS discovery_report;

ROLLBACK;

