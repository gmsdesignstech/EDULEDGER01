# Owner database evidence request

Please provide the following **metadata only**, from an authorized owner/DBA. Do not send passwords, secret tokens, complete connection strings, private keys, student/parent/teacher records, payment details, or data exports.

## Requested evidence

1. **Schema-only PostgreSQL export** from the database confirmed to serve the production application, if available. Use a schema-only export with ownership/ACL output omitted where appropriate. Review function/view/default definitions locally and redact any embedded secrets before sharing. Do not include table data.
2. **Migration tracking table information:** table/schema name, DDL, checksums if present, and whether the table is known to be authoritative. Provide applied identifiers and timestamps only if recorded.
3. **PostgreSQL version** and server-side compatibility/version information.
4. **Extension inventory:** extension name and version.
5. **Object inventory:** tables, columns, types, nullability/defaults, PK/FK/unique/check constraints, indexes, views, sequences, triggers, functions, and enum labels.
6. **Security inventory:** RLS enabled/forced flags, policy definitions, table/column/schema/database grants, and role capability metadata. Do not provide password hashes or secret credentials.
7. **Application DB role configuration:** role name and non-secret attributes/privileges used by the deployed application. Do not provide the role password or connection URI.
8. **Provider project metadata:** for Supabase, provide the project URL/ref, project name, region, PostgreSQL version, and endpoint/database/role labels; for Neon, provide project name/ID, region, PostgreSQL version, endpoint/database/role labels, and pooling status. Do not include database credentials, API keys, access tokens, or connection strings.
9. **Vercel deployment/environment metadata:** project name, deployment commit, target environment, and environment variable **names and scopes only**. Do not provide values, screenshots containing values, or secret fingerprints.
10. **Provider confirmation:** identify the database provider actually used by the production application and confirm the evidence above came from that application’s target, not a similarly named project.

## Safe identity binding

Send target identity separately from schema output: owner-confirmed Vercel project/deployment commit → provider project ID/name → database name and non-secret role name. Redact hostnames/IP addresses if policy requires, but retain enough owner-side correlation to prove the schema export came from the production application database. Never include a full database URL.

## How to prepare the schema export

An authorized owner/DBA can use their approved database tooling to create a schema-only export. Keep the output in the owner-controlled environment, review it for embedded secrets, then provide an approved redacted copy. Do not run a command that includes a literal password or connection string in shell history, process arguments, chat, or this repository. No export was requested from a live system by this audit, and no database was contacted.

The companion SQL file contains read-only PostgreSQL catalog queries for environments where a schema export is unavailable. Inspect results before sharing: function bodies, defaults, view definitions, policy expressions, and object names can contain sensitive literals or internal metadata.
