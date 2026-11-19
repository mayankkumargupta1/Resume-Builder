import type { Metadata } from "next";
import {
  getAuthenticatedUserIdForPage,
  loadProfile,
  loadThemes,
  loadSettings,
} from "@/lib/profile-store";
import { getUserTailoredDrafts } from "@/lib/db";
import { ApplicationsTrackerView } from "@/components/applications-tracker-view";
import { PaperSize } from "@/lib/enums";

export const metadata: Metadata = {
  title: "Tailored Resumes · Resume Pipeline",
};

export const dynamic = "force-dynamic";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const uid = await getAuthenticatedUserIdForPage();
  const profile = await loadProfile(uid);
  const themes = await loadThemes(uid);
  const settings = await loadSettings(uid);
  const drafts = await getUserTailoredDrafts(uid);
  const resolvedParams = await searchParams;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ApplicationsTrackerView
        profile={profile}
        initialDrafts={drafts}
        themes={themes}
        baseThemeId={settings.baseThemeId || "editorial"}
        initialPaper={settings.paper === "A4" ? PaperSize.A4 : PaperSize.LETTER}
        includeReferences={settings.includeReferences}
        language={settings.language}
        initialSelectedId={resolvedParams?.id || null}
      />
    </div>
  );
}
