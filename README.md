# HAUS Creator OS

A full-stack Next.js operating system for HAUS creator recruitment, pipeline tracking, outreach templates, notes, scoring, task automation, and data portability.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- shadcn/ui source components
- Prisma ORM 7 with Postgres
- Vercel-ready deployment

## Environment Variables

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
```

For local development, copy `.env.example` to `.env.local` and set `DATABASE_URL`.

## Local Setup

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

If you want a quick local Postgres without Docker:

```bash
npx prisma dev --detach --name haus-creator-os
```

Copy the printed Postgres URL into `.env.local`, then run the migration and seed commands above.

## Useful Commands

```bash
npm run lint
npm run build
npm run db:push
npm run db:deploy
npm run db:seed
```

## Vercel Deployment

1. Create/import the project in Vercel.
2. Add a Postgres provider from Vercel Marketplace, such as Prisma Postgres or another Marketplace Postgres integration. Vercel injects connection variables like `DATABASE_URL` into the project.
3. Pull env vars locally if needed:

```bash
vercel link
vercel env pull .env.local
```

4. Apply the schema to production:

```bash
npm run db:deploy
```

5. Seed starter HAUS data if this is a new single-user instance:

```bash
npm run db:seed
```

6. Deploy:

```bash
vercel --prod
```

Notes:

- Vercel’s current Postgres guidance is Marketplace-based; the older first-party Vercel Postgres product has been replaced by Marketplace storage integrations.
- The app has no auth in v1 by design. Add auth before sharing the deployment URL broadly.

## Folder Structure

```txt
src/app/(app)                 App routes and desktop shell sections
src/app/api                   JSON, CSV, import/export, and mutation endpoints
src/components/app            Shell, command palette, providers, quick add
src/components/creators       Creator list and detail workspace
src/components/pipeline       Drag-and-drop Kanban pipeline
src/components/tasks          Task management UI
src/components/templates      Editable outreach and brief library
src/components/settings       Notes, memory, settings, import/export
src/components/ui             shadcn/ui components
src/lib                       Prisma, validation, automation, domain helpers
prisma/schema.prisma          Database schema
prisma/migrations             Production migration SQL
prisma/seed.ts                HAUS starter data and templates
```

## Implemented Features

- Dashboard with today/overdue tasks, stats, and recent creators
- Quick Add Creator modal
- Creator search, filters, detail pages, notes, scorecard, interactions, tasks, briefs, templates, and performance fields
- Drag-and-drop pipeline with stage automations
- Template library seeded with HAUS outreach, brief, offer, rights, and nurture templates
- Global command palette with keyboard shortcut
- Notes / Memory autosave
- JSON export/import
- CSV export for creators and tasks
- Light/dark/system theme support
# haus-creator-os
