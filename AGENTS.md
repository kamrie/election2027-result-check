<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.


## Result Check project rules
- App: Next.js App Router, TypeScript, Tailwind. Database: MySQL (XAMPP) with the mysql2 package through lib/db.ts. No Prisma, no Express.
- Always use ? placeholders in SQL. Never put user input into SQL text. Never log passwords, tokens or API keys. Secrets live only in .env.local and are never committed.
- Design: green and white (#008751, dark green #005C37), off-white page background, sharp corners (no rounded classes), shadows at the bottom only, Montserrat font, no dark mode, sentence case.
- Parties come from the MySQL "parties" table (active = 1, ordered by abbreviation). Do not hardcode party lists in components.
- Status tags use components/StatusTag.tsx.
- Public pages: Home, Find your polling unit, Unit page, Dashboard. Logged-in only: Submit result. Admin only: /admin, checked on the server. Public pages never show names, emails or phone numbers of submitters.
- Diff in comparison tables is always (our score minus IReV score), with a leading + for positive numbers.
- A unit's party scores must equal valid votes; valid plus rejected must not exceed accredited.
- Auto-reading result sheet photos (planned): the reader's numbers are only suggestions. The person must review and confirm before submitting. Store both the suggested and the confirmed values. Manual typing always stays available.
- Polling unit codes use the format State/LGA/Ward/Unit, for example 01/02/03/004. Accept dashes or slashes.
- Current status: the front end is finished using sample data in lib/fake-locations.ts, lib/fake-dashboard.ts and lib/fake-admin.ts. Backend is built step by step: parties from the database first, then polling unit import and live search, then the extraction prototype, then sign-up and login, route protection, submit API with photo upload, status logic, admin actions.
- Only change what the task asks for. Explain each file you change in a short summary.
<!-- END:nextjs-agent-rules -->
