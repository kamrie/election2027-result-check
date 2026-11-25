# Duplicate-photo checks

1. Run `database/submission-photo-hashes.sql` in the Result Check MySQL database.
2. With MySQL running and `CLOUDINARY_URL` configured, index existing photos from the project root.
   ```powershell
   node --env-file=.env.local scripts/backfill-submission-photo-hashes.mjs
   ```
3. Restart Next.js if you change `PHOTO_PHASH_THRESHOLD` in `.env.local`. Apply the migration before deploying the new application code.

New uploads are hashed after server-side image validation. SHA-256 detects identical uploaded bytes. The 64-bit perceptual hash is compared by Hamming distance, inclusive. Set `PHOTO_PHASH_THRESHOLD` to an integer from 0 through 16. The default is 6. A threshold of 0 still detects identical perceptual hashes. Changes apply to subsequent checks and do not clear existing flags.

Comparisons are scoped to one polling unit and check every photo, including repeated photos in the same upload. Photos previously stored in Cloudinary are indexed from their original delivery URLs. A failed backfill leaves the submission in place and excludes it from confirmation until all its photos have been indexed. Re-run the command after resolving any failed downloads.

A match flags the upload for review in **Admin > Submissions > Photo flags for review**. The queue shows the 50 most recent flagged photos and is read-only. Matching scores and totals count toward confirmation only for different accounts with fully indexed submissions and no unresolved flags. A different perceptual hash cannot establish that the submissions are independent. Crops, rotations and similar-looking forms can produce missed matches or false positives.
