"use server";

import { z } from "zod";
import { action } from "@/lib/action";
import { loadProfile, saveProfile } from "@/lib/profile-store";
import type { FactItem } from "@/lib/profile";

export const createFact = action(z.object({ applicationId: z.string().nullable() }), async () => {
  const profile = await loadProfile();
  const newFact: FactItem = {
    id: `fact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: "",
  };
  profile.facts = [...(profile.facts || []), newFact];
  await saveProfile(profile);
  return newFact;
});

export const saveFact = action(z.object({ id: z.string(), text: z.string() }), async ({ id, text }) => {
  const profile = await loadProfile();
  profile.facts = (profile.facts || []).map((f) => (f.id === id ? { ...f, text } : f));
  await saveProfile(profile);
  return null;
});

export const removeFact = action(z.object({ id: z.string() }), async ({ id }) => {
  const profile = await loadProfile();
  profile.facts = (profile.facts || []).filter((f) => f.id !== id);
  await saveProfile(profile);
  return { sort: null };
});

export const restoreFact = action(
  z.object({ id: z.string(), applicationId: z.string().nullable(), text: z.string(), sort: z.number().nullable().optional() }),
  async ({ id, text }) => {
    const profile = await loadProfile();
    profile.facts = [...(profile.facts || []), { id, text }];
    await saveProfile(profile);
    return { id, text };
  }
);
