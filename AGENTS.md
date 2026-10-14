<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Rule: Always Generate Prisma Migrations for Portainer Deployment

- Whenever modifying `prisma/schema.prisma` (adding/updating models, fields, enums, or relationships), NEVER rely solely on `prisma db push`.
- ALWAYS generate/create a formal SQL migration folder under `prisma/migrations/` (e.g. `prisma/migrations/YYYYMMDDHHMMSS_<migration_name>/migration.sql`) and mark it resolved.
- This ensures automated deployment pipelines and Portainer containers executing `bun prisma migrate deploy` will reliably apply schema migrations to production PostgreSQL databases.
