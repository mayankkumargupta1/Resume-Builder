import { z } from "zod";

export type ActionResult<T> =
  | { ok: true; data: T; toast?: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: Partial<Record<string, string[]>>;
    };

export class ActionError extends Error {
  override name = "ActionError";
}

export type ActionContext = {
  toast: (message: string) => void;
};

export function action<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.output<S>, context: ActionContext) => Promise<T>,
): (input: z.input<S>) => Promise<ActionResult<T>> {
  return async (input) => {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Some details aren't valid. Check the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    let toastMessage: string | undefined;
    try {
      const data = await handler(parsed.data, {
        toast: (msg: string) => {
          toastMessage = msg;
        },
      });
      return toastMessage !== undefined ? { ok: true, data, toast: toastMessage } : { ok: true, data };
    } catch (error: any) {
      if (error instanceof ActionError) return { ok: false, error: error.message };
      console.error("Action error:", error);
      return { ok: false, error: error?.message || "Something went wrong. Please try again." };
    }
  };
}
