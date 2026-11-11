import type { Metadata } from "next";
import { ResumeDocument } from "@/components/documents/resume-document";
import { getAuthenticatedUserIdForPage, loadProfile, loadSettings, loadThemes } from "@/lib/profile-store";
import { BUILT_IN_THEMES, printCss } from "@/lib/themes";
import { PaperSize } from "@/lib/enums";

export const metadata: Metadata = {
  title: "Print Base Resume · Resume Pipeline",
  robots: { index: false },
};

export default async function PrintBaseResumePage() {
  const uid = await getAuthenticatedUserIdForPage();
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
      />
    </div>
  );
}
