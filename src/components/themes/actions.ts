"use server";

import { z } from "zod";
import { action } from "@/lib/action";
import { loadThemes, saveCustomThemes, loadSettings, saveSettings } from "@/lib/profile-store";
import { ThemeData, BUILT_IN_THEMES } from "@/lib/themes";
import { parseThemeFile } from "@/lib/theme-file";
import {
  DateStyle,
  Density,
  HeaderStyle,
  HeadingStyle,
  PhotoPosition,
  PhotoShape,
  SidebarStyle,
  ThemeAlign,
  ThemeFont,
  ThemeLayout,
} from "@/lib/enums";

const themeSchema = z.object({
  id: z.string().nullable().optional(),
  name: z.string().min(1).max(60),
  headFont: z.nativeEnum(ThemeFont),
  bodyFont: z.nativeEnum(ThemeFont),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  layout: z.nativeEnum(ThemeLayout),
  align: z.nativeEnum(ThemeAlign),
  headingStyle: z.nativeEnum(HeadingStyle),
  density: z.nativeEnum(Density),
  headerStyle: z.nativeEnum(HeaderStyle),
  sidebarStyle: z.nativeEnum(SidebarStyle),
  dateStyle: z.nativeEnum(DateStyle),
  photoShape: z.nativeEnum(PhotoShape),
  photoPosition: z.nativeEnum(PhotoPosition),
});

export const setBaseTheme = action(z.object({ id: z.string() }), async ({ id }) => {
  const settings = await loadSettings();
  settings.baseThemeId = id;
  await saveSettings(settings);
  return null;
});

export const saveTheme = action(themeSchema, async (draft) => {
  const themes = await loadThemes();
  const id = draft.id || `custom-${Date.now()}`;
  const theme: ThemeData = {
    ...draft,
    id,
    builtIn: false,
  };
  const existingIndex = themes.findIndex((t) => t.id === id);
  if (existingIndex >= 0) {
    themes[existingIndex] = theme;
  } else {
    themes.push(theme);
  }
  await saveCustomThemes(themes);
  const settings = await loadSettings();
  settings.baseThemeId = id;
  await saveSettings(settings);
  return theme;
});

export const duplicateTheme = action(z.object({ id: z.string() }), async ({ id }) => {
  const themes = await loadThemes();
  const original = themes.find((t) => t.id === id) || BUILT_IN_THEMES[0];
  const newTheme: ThemeData = {
    ...original,
    id: `custom-${Date.now()}`,
    name: `${original.name} (Copy)`,
    builtIn: false,
  };
  themes.push(newTheme);
  await saveCustomThemes(themes);
  const settings = await loadSettings();
  settings.baseThemeId = newTheme.id;
  await saveSettings(settings);
  return newTheme;
});

export const deleteTheme = action(z.object({ id: z.string() }), async ({ id }) => {
  const allThemes = await loadThemes();
  const themes = allThemes.filter((t) => t.id !== id);
  await saveCustomThemes(themes);
  const settings = await loadSettings();
  if (settings.baseThemeId === id) {
    settings.baseThemeId = "editorial";
    await saveSettings(settings);
  }
  return null;
});

export const importTheme = action(z.object({ text: z.string() }), async ({ text }) => {
  const parsed = parseThemeFile(text);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const themes = await loadThemes();
  const id = `custom-${Date.now()}`;
  const imported: ThemeData = {
    ...(parsed.theme as unknown as ThemeData),
    id,
    builtIn: false,
  };
  themes.push(imported);
  await saveCustomThemes(themes);
  const settings = await loadSettings();
  settings.baseThemeId = id;
  await saveSettings(settings);
  return imported;
});
