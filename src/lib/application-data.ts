import { z } from "zod";

export const unitSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  text: z.string(),
  unverified: z.array(z.string()).optional(),
});

export type Unit = {
  id: string;
  label?: string;
  text: string;
  unverified?: string[];
};

export const SIGN_OFF_UNIT = "sign-off";
