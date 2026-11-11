import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getUserProfile,
  saveUserProfile,
  getUserThemes,
  saveUserCustomTheme,
  deleteUserCustomTheme,
  getUserSettings,
  saveUserSettings,
  getUserFromSession,
} from "./db";
import { SESSION_COOKIE_NAME } from "./auth";
import { DEFAULT_PROFILE_DATA } from "./default-profile-data";
import type { ProfileData } from "./profile";
import { BUILT_IN_THEMES, type ThemeData } from "./themes";
import { ActionError } from "./action";

export { DEFAULT_PROFILE_DATA };

export interface AppSettings {
  baseThemeId: string;
  paper: "A4" | "LETTER";
  includeReferences: boolean;
  pageLimit: "1" | "2" | "none";
  language: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  baseThemeId: "editorial",
  paper: "LETTER",
  includeReferences: false,
  pageLimit: "none",
  language: null,
};

export async function getActiveUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      const user = getUserFromSession(token);
      if (user) return user.id;
    }
  } catch {
    // In background or build contexts where cookies() is unavailable
  }
  return null;
}

export async function requireActiveUserId(): Promise<string> {
  const uid = await getActiveUserId();
  if (!uid) {
    throw new ActionError("Authentication required. Please sign in to access this workspace.");
  }
  return uid;
}

export async function getAuthenticatedUserIdForPage(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    redirect("/login");
  }
  const user = getUserFromSession(token);
  if (!user) {
    redirect("/login");
  }
  return user.id;
}

export async function loadProfile(userId?: string): Promise<ProfileData> {
  const uid = userId || (await requireActiveUserId());
  return getUserProfile(uid);
}

export async function saveProfile(profile: ProfileData, userId?: string): Promise<void> {
  const uid = userId || (await requireActiveUserId());
  saveUserProfile(uid, profile);
}

export async function loadThemes(userId?: string): Promise<ThemeData[]> {
  const uid = userId || (await requireActiveUserId());
  return getUserThemes(uid);
}

export async function saveCustomThemes(themes: ThemeData[], userId?: string): Promise<void> {
  const uid = userId || (await requireActiveUserId());
  const custom = themes.filter((t) => !t.builtIn);
  for (const theme of custom) {
    saveUserCustomTheme(uid, theme);
  }
}

export async function loadSettings(userId?: string): Promise<AppSettings> {
  const uid = userId || (await requireActiveUserId());
  return getUserSettings(uid);
}

export async function saveSettings(settings: AppSettings, userId?: string): Promise<void> {
  const uid = userId || (await requireActiveUserId());
  saveUserSettings(uid, settings);
}
