import { z } from "zod";

/** Absence is unknown; false explicitly rejects the bounded source branch. */
export const rawSourceStateContextSchema = z.strictObject({
  sharedState: z.record(z.string().min(1), z.boolean()).optional(),
  hitStates: z.record(z.string().min(1), z.record(z.string().min(1), z.boolean())).optional(),
});
export type RawSourceStateContext = z.infer<typeof rawSourceStateContextSchema>;
