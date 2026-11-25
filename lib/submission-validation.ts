import { z } from "zod";

export const maxPhotos = 6;
export const maxPhotoBytes = 5_000_000;
export const maxVoteCount = 2_147_483_647;
export const photoTypes = ["image/jpeg", "image/png"] as const;

export const pollingUnitCode = z.string().trim()
  .regex(/^\d{2}[-/]\d{2}[-/]\d{2}[-/]\d{3}$/, "Enter a valid polling unit code.")
  .transform((code) => code.replaceAll("/", "-"));

const votes = z.number().int().min(0).max(maxVoteCount);

export const submissionSchema = z.strictObject({
  unitCode: pollingUnitCode,
  accredited: votes,
  valid: votes,
  rejected: votes,
  confirmed: z.literal(true),
  sheetDoesNotAddUp: z.boolean(),
  scores: z.array(z.strictObject({ partyId: votes.positive(), score: votes })).min(1).max(100),
}).superRefine((values, ctx) => {
  const total = values.scores.reduce((sum, item) => sum + item.score, 0);
  if ((total !== values.valid || values.valid + values.rejected > values.accredited) && !values.sheetDoesNotAddUp) {
    ctx.addIssue({ code: "custom", message: "Check the totals or confirm that the sheet does not add up." });
  }
});

export const submissionPhotos = z.array(
  z.file().min(1).max(maxPhotoBytes).mime([...photoTypes]),
).min(1).max(maxPhotos);

export type Submission = z.output<typeof submissionSchema>;
