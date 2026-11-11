import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResumeDocument } from "@/components/documents/resume-document";
import {
  getAuthenticatedUserIdForPage,
  loadProfile,
  loadSettings,
  loadThemes,
} from "@/lib/profile-store";
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
  const draft = getTailoredDraftById(uid, id);
  if (!draft) {
    notFound();
  }

  const profile = await loadProfile(uid);
  const settings = await loadSettings(uid);
  const themes = await loadThemes(uid);
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
