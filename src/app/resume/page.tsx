import type { Metadata } from "next";
import { getAuthenticatedUserIdForPage, loadProfile, loadThemes, loadSettings } from "@/lib/profile-store";
import { ResumeWorkspace } from "@/components/resume-workspace";
import { PaperSize } from "@/lib/enums";

export const metadata: Metadata = {
  title: "Base resume & Themes · Resume Pipeline",
};

export const dynamic = "force-dynamic";

export default async function ResumePage() {
  const uid = await getAuthenticatedUserIdForPage();
  const profile = await loadProfile(uid);
  const themes = await loadThemes(uid);
  const settings = await loadSettings(uid);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ResumeWorkspace
        profile={profile}
        themes={themes}
        baseThemeId={settings.baseThemeId || "editorial"}
        paper={settings.paper === "A4" ? PaperSize.A4 : PaperSize.LETTER}
        includeReferences={settings.includeReferences}
        language={settings.language}
      />
    </div>
  );
}
