# Result Check deployment checklist

Deploy the production Next.js Node server behind HTTPS. Restore the existing MySQL database into a private staging instance first, then use the checks below before exposing a public domain.

## Environment variables

Set these in the server's secret store or process environment. Keep `.env.local`, database dumps and `data/` outside Git.

| Variable | Value |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME` | Private database hostname, port and restored database name. The default port is 3306. |
| `DB_USER`, `DB_PASSWORD` | Application-only database account with the read and write privileges the routes need. Run migrations using a separate account. |
| `DB_SSL_CA` | PEM CA certificate for a TLS-enabled database. Use the hostname on its certificate. Literal escaped newlines and multiline PEM both work. |
| `AUTH_SECRET` | Random secret of at least 32 bytes, shared by production app instances. Rotating it invalidates existing sessions. |
| `AUTH_ORIGIN` | Exact public HTTPS origin, including a non-default port if used. Set it explicitly behind a reverse proxy. |
| `AUTH_FORWARDED_ORIGIN` | Optional trusted HTTPS origin for development forwarding. Leave unset in production. |
| `CLOUDINARY_URL` | Server-only Cloudinary credentials for storing EC8A photos. |
| `PHOTO_PHASH_THRESHOLD` | Optional perceptual-hash distance threshold. The default is 6. |

## Database backup and migration

1. Back up the full existing schema and data using the dump tool that matches your MySQL or MariaDB server. Store the dump in a restricted, encrypted backup location. For XAMPP on PowerShell, run the command below with a real backup path outside the project. The client prompts for the password.
   ```powershell
   & C:\xampp\mysql\bin\mysqldump.exe --single-transaction --routines --triggers --host=localhost --port=3306 --user=BACKUP_USER --password --result-file=C:\private-backups\result-check.sql election_result_check
   ```
2. Restore into a separate staging database and compare record counts with the source. The local directory has 176,846 polling units, 8,809 wards, 774 LGAs and 37 states/FCT. Keep the current dump as the rollback point. Rehearse restore before release.
3. Apply the supplemental SQL files in order with a migration account. The existing full schema must already be restored.
   - `database/auth-rate-limits.sql`
   - `database/submission-photo-hashes.sql`
   - `database/submission-removals.sql`
4. If older photos still need fingerprints, run the backfill with the configured Cloudinary account using [the photo hash instructions](database/submission-photo-hashes.md). The script reports failed downloads for follow-up.
5. Import only when the target polling-unit directory is empty or an import has been separately reviewed. Use the corrected CSV and run a dry run first. Re-check the dataset against INEC before launch.
   ```powershell
   npm.cmd run import:units -- --file data/result_check_polling_units_fixed.csv --dry-run
   ```
   Use the same command without `--dry-run` after verifying the target database and counts. The CLI scripts load the database settings from `.env.local`. Use a private network or a verified tunnel for remote CLI work.

The removal audit table records the reviewer, reason and prior status. A removal keeps the submission, hashes, scores and photos. For a disputed removal, review the audit and evidence before any administrative database correction.

## HTTPS, hosting and image storage

- Build and run with `npm ci`, `npm run build` and `npm run start` on a Node.js host supported by Next.js and Sharp. Use a reverse proxy that preserves response streaming. [Next.js self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting)
- Point the chosen domain at the HTTPS proxy, issue a valid certificate, redirect HTTP to HTTPS and configure the exact `AUTH_ORIGIN`. Verify a real browser receives a Secure, HttpOnly, SameSite=Lax session cookie and can log out. Keep the database port private.
- The submit endpoint accepts up to six JPEG or PNG files of 5,000,000 bytes each and at most 30,065,536 bytes including multipart data. Set the proxy body limit above that cap and test maximum-size submissions. The current endpoint needs a host that accepts the full payload. Vercel's documented 20 MiB opt-in beta remains below the application's maximum. [Vercel request limits](https://vercel.com/changelog/vercel-functions-now-support-request-bodies-up-to-20mib)
- Cloudinary stores the photos, while MySQL stores their URLs and hashes. Check quotas for retained images and delivery. Keep access to review links restricted. An uploaded image URL can be opened by anyone who obtains it under the current storage configuration. Confirm retention, access and backup expectations before production.
- Browser OCR fetches engine and language assets on the first scan. Confirm they load through the production network and that manual entry works when OCR is unavailable.

## Staging smoke and load checks

Use labeled test accounts, a separate staging database and a staging storage environment. Verify login, signup, logout, restricted routes, search, manual submission, OCR, all verification statuses, correction conflicts, duplicate evidence, Admin CSV, and PNG download. Test native image sharing on supported phones. Confirm public pages and JSON contain no submitter or admin contact details.

Start with a read-only load run at 1, 5 and 15 concurrent clients across Home, Dashboard, unit lookups and search. Record p50 and p95 response times, errors, database pool usage and memory. Then test a small authenticated upload batch with near-limit test images and verify 429 and 413 responses at their boundaries. Dashboard reads verification in batches, so measure it with realistic submission volume before signing off. Roll out only after reviewing these measurements, the restore test and production credentials.
