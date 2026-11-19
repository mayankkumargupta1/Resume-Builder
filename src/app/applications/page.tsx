import type { Metadata } from "next";
import {
  getAuthenticatedUserIdForPage,
  loadProfile,
  loadThemes,
  loadSettings,
} from "@/lib/profile-store";
import { getOptionalUser } from "@/lib/auth";
import { getUserTailoredDrafts, getAllTailoredDrafts, getAllUsers } from "@/lib/db";
import { ApplicationsTrackerView } from "@/components/applications-tracker-view";
import { PaperSize } from "@/lib/enums";

export const metadata: Metadata = {
  title: "Tailored Resumes · Resume Pipeline",
};

export const dynamic = "force-dynamic";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; candidateId?: string }>;
}) {
  const uid = await getAuthenticatedUserIdForPage();
  const currentUser = await getOptionalUser();
  const isAdmin = currentUser?.role === "admin";
  const resolvedParams = await searchParams;

  const allUsers = await getAllUsers();
  const candidates = allUsers
    .filter((u) => u.id !== "usr_root" && u.email !== "admin@resumepipeline.com")
    .map((u) => ({ id: u.id, name: u.name || u.email.split("@")[0], email: u.email }));

  const drafts = await getAllTailoredDrafts(resolvedParams?.candidateId);

  // Determine which user's profile and themes to load for the preview
  const selectedDraftId = resolvedParams?.id || drafts[0]?.id;
  const selectedDraft = drafts.find((d) => d.id === selectedDraftId);
  const profileUserId = selectedDraft ? selectedDraft.user_id : uid;

  const profile = await loadProfile(profileUserId);
  const themes = await loadThemes(profileUserId);
  const settings = await loadSettings(profileUserId);

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
        isAdmin={isAdmin}
        candidates={candidates}
        selectedCandidateId={resolvedParams?.candidateId || "all"}
      />
    </div>
  );
}
