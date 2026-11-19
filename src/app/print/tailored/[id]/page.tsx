import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResumeDocument } from "@/components/documents/resume-document";
import {
  getAuthenticatedUserIdForPage,
  loadProfile,
  loadSettings,
  loadThemes,
} from "@/lib/profile-store";
import { getOptionalUser } from "@/lib/auth";
import { getTailoredDraftById } from "@/lib/db";
import { BUILT_IN_THEMES, printCss } from "@/lib/themes";
import { PaperSize } from "@/lib/enums";

export const metadata: Metadata = {
  title: "Print Tailored Resume · Resume Pipeline",
  robots: { index: false },
};

export default async function PrintTailoredResumePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const uid = await getAuthenticatedUserIdForPage();
  const user = await getOptionalUser();
  const isAdmin = user?.role === "admin";
  const draft = await getTailoredDraftById(uid, id, isAdmin);
  if (!draft) {
    notFound();
  }

  // Load the draft candidate's authentic profile, settings, and themes
  const profile = await loadProfile(draft.user_id);
  const settings = await loadSettings(draft.user_id);
  const themes = await loadThemes(draft.user_id);
  const theme = themes.find((t) => t.id === settings.baseThemeId) ?? BUILT_IN_THEMES[0];
  const paper = settings.paper === "A4" ? PaperSize.A4 : PaperSize.LETTER;

  return (
    <div className="flex justify-center bg-white min-h-screen p-8 print:p-0">
      <style>{printCss(theme, paper)}</style>
      <ResumeDocument
        theme={theme}
        profile={profile}
        paper={paper}
        includeReferences={settings.includeReferences}
        language={settings.language}
        units={draft.units}
      />
    </div>
  );
}
