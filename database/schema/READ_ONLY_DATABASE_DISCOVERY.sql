-- EduLedger schema discovery query pack.
-- Owner/DBA use only. This file was not executed.
-- All statements in the runnable block are catalog reads or SHOW commands.
-- Do not supply a password/connection string in this file or shell history.
-- Review and redact output before sharing; definitions/defaults can contain literals.

BEGIN TRANSACTION READ ONLY;

-- 1. Target identity and server version. Record the owner-verified provider project
-- separately; redact network addresses if required by policy.
SELECT current_database() AS database_name,
       current_user AS effective_role,
       session_user AS login_role,
       inet_server_addr() AS server_address,
       inet_server_port() AS server_port,
       current_setting('server_version') AS server_version;

-- 2. Installed extensions.
SELECT e.extname AS extension_name,
       e.extversion AS extension_version,
       n.nspname AS schema_name
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY e.extname;

-- 3. Tables, partitioned tables, views, materialized views, and sequences.
SELECT n.nspname AS schema_name,
       c.relname AS object_name,
       CASE c.relkind
         WHEN 'r' THEN 'table'
         WHEN 'p' THEN 'partitioned table'
         WHEN 'v' THEN 'view'
         WHEN 'm' THEN 'materialized view'
         WHEN 'S' THEN 'sequence'
         ELSE c.relkind::text
       END AS object_type,
       c.relpersistence AS persistence,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
  AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
ORDER BY n.nspname, c.relkind, c.relname;

-- 4. Columns, types, nullability, defaults, generated/identity metadata.
SELECT table_schema,
       table_name,
       ordinal_position,
       column_name,
       data_type,
       udt_schema,
       udt_name,
       is_nullable,
       column_default,
       is_identity,
       identity_generation,
       is_generated,
       generation_expression
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, ordinal_position;

-- 5. Primary keys, foreign keys, unique/check/exclusion constraints.
SELECT n.nspname AS schema_name,
       t.relname AS table_name,
       con.conname AS constraint_name,
       CASE con.contype
         WHEN 'p' THEN 'primary key'
         WHEN 'f' THEN 'foreign key'
         WHEN 'u' THEN 'unique'
         WHEN 'c' THEN 'check'
         WHEN 'x' THEN 'exclusion'
         ELSE con.contype::text
       END AS constraint_type,
       con.convalidated AS validated,
       pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint con
JOIN pg_class t ON t.oid = con.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, t.relname, con.conname;

-- 6. Index definitions (includes unique/partial/expression indexes).
SELECT schemaname AS schema_name,
       tablename AS table_name,
       indexname AS index_name,
       indexdef AS definition
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename, indexname;

-- 7. PostgreSQL enum types and labels.
SELECT n.nspname AS schema_name,
       t.typname AS enum_name,
       e.enumsortorder AS label_order,
       e.enumlabel AS label
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
ORDER BY n.nspname, t.typname, e.enumsortorder;

-- 8. Views/materialized views and definitions. Review/redact definitions before sharing.
SELECT schemaname AS schema_name,
       viewname AS object_name,
       definition
FROM pg_views
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, viewname;

SELECT schemaname AS schema_name,
       matviewname AS object_name,
       definition
FROM pg_matviews
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, matviewname;

-- 9. Sequences and their owned table/column (where catalog dependency exists).
SELECT sn.nspname AS sequence_schema,
       s.relname AS sequence_name,
       tn.nspname AS table_schema,
       tbl.relname AS table_name,
       a.attname AS column_name
FROM pg_class s
JOIN pg_namespace sn ON sn.oid = s.relnamespace
LEFT JOIN pg_depend d
  ON d.objid = s.oid AND d.classid = 'pg_class'::regclass
 AND d.refclassid = 'pg_class'::regclass AND d.deptype IN ('a', 'i')
LEFT JOIN pg_class tbl ON tbl.oid = d.refobjid
LEFT JOIN pg_namespace tn ON tn.oid = tbl.relnamespace
LEFT JOIN pg_attribute a ON a.attrelid = tbl.oid AND a.attnum = d.refobjsubid
WHERE s.relkind = 'S'
  AND sn.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY sn.nspname, s.relname;

-- 10. Non-internal triggers and their definitions.
SELECT n.nspname AS schema_name,
       t.relname AS table_name,
       tr.tgname AS trigger_name,
       p.proname AS function_name,
       pg_get_triggerdef(tr.oid, true) AS trigger_definition
FROM pg_trigger tr
JOIN pg_class t ON t.oid = tr.tgrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_proc p ON p.oid = tr.tgfoid
WHERE NOT tr.tgisinternal
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, t.relname, tr.tgname;

-- 11. User-defined functions/procedures. Function bodies may contain literals;
-- inspect locally and redact before sharing.
SELECT n.nspname AS schema_name,
       p.proname AS routine_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS result_type,
       l.lanname AS language,
       pg_get_userbyid(p.proowner) AS owner_name,
       p.prosecdef AS security_definer,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND p.prokind IN ('f', 'p')
ORDER BY n.nspname, p.proname, arguments;

-- 12. RLS enablement and policies.
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, c.relname;

SELECT schemaname AS schema_name,
       tablename AS table_name,
       policyname,
       permissive,
       roles,
       cmd AS command,
       qual AS using_expression,
       with_check
FROM pg_policies
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename, policyname;

-- 13. Table and column privileges, plus safe role capability metadata.
SELECT table_schema,
       table_name,
       grantee,
       privilege_type,
       is_grantable
FROM information_schema.table_privileges
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, grantee, privilege_type;

SELECT table_schema,
       table_name,
       column_name,
       grantee,
       privilege_type,
       is_grantable
FROM information_schema.column_privileges
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, ordinal_position, grantee, privilege_type;

SELECT r.rolname AS role_name,
       r.rolcanlogin AS can_login,
       r.rolsuper AS is_superuser,
       r.rolcreatedb AS can_create_database,
       r.rolcreaterole AS can_create_roles,
       r.rolreplication AS can_replicate,
       r.rolbypassrls AS bypasses_rls,
       r.rolvaliduntil AS valid_until
FROM pg_roles r
ORDER BY r.rolname;

-- 14. Candidate migration tracking objects. This returns names/columns only.
-- Inspect names with the owner before querying records; do not assume a table
-- whose name contains "migration" is authoritative.
SELECT n.nspname AS schema_name,
       c.relname AS candidate_table,
       a.attnum AS ordinal_position,
       a.attname AS column_name,
       pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
       a.attnotnull AS not_null
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid
WHERE c.relkind IN ('r', 'p')
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND c.relname ILIKE '%migration%'
ORDER BY n.nspname, c.relname, a.attnum;

-- After the owner verifies an authoritative ledger table above, run a separate
-- SELECT against that exact quoted schema/table to retrieve identifiers and
-- timestamps. Do not use SELECT * if the ledger may contain unreviewed fields.
-- Example shapes only. Run only the query whose exact relation/columns were
-- confirmed by the catalog output above. Neither ledger is assumed to exist.
-- Proposed EduLedger ledger from MIGRATION_ARCHITECTURE.md (not implemented):
-- SELECT id, checksum_sha256, applied_at, duration_ms, transactional
-- FROM public.eduledger_schema_migrations
-- ORDER BY applied_at, id;
-- Common Prisma ledger shape (Prisma Migrate is not configured in this app):
-- SELECT migration_name, started_at, finished_at, rolled_back_at, applied_steps_count
-- FROM public."_prisma_migrations"
-- ORDER BY started_at, migration_name;

-- 15. Database/schema privileges. Role names/attributes are metadata; no role
-- password hashes are selected.
SELECT d.datname AS database_name,
       r.rolname AS role_name,
       has_database_privilege(r.oid, d.oid, 'CONNECT') AS can_connect,
       has_database_privilege(r.oid, d.oid, 'CREATE') AS can_create,
       has_database_privilege(r.oid, d.oid, 'TEMP') AS can_temp
FROM pg_database d
CROSS JOIN pg_roles r
WHERE d.datname = current_database()
ORDER BY r.rolname;

SELECT n.nspname AS schema_name,
       r.rolname AS role_name,
       has_schema_privilege(r.oid, n.oid, 'USAGE') AS can_use,
       has_schema_privilege(r.oid, n.oid, 'CREATE') AS can_create
FROM pg_namespace n
CROSS JOIN pg_roles r
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, r.rolname;

ROLLBACK;
