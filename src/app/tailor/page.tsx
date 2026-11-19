import type { Metadata } from "next";
import { getAuthenticatedUserIdForPage, loadProfile } from "@/lib/profile-store";
import { getOptionalUser } from "@/lib/auth";
import { getAllUsers } from "@/lib/db";
import { JobTailorView } from "@/components/job-tailor-view";

export const metadata: Metadata = {
  title: "Job Tailoring Agent · Resume Pipeline",
};

export const dynamic = "force-dynamic";

export default async function TailorPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const uid = await getAuthenticatedUserIdForPage();
  const currentUser = await getOptionalUser();
  const isAdmin = currentUser?.role === "admin";
  const { userId } = (await searchParams) ?? {};

  const allUsers = await getAllUsers();
  // All registered non-admin candidates
  const candidates = allUsers
    .filter((u) => u.id !== "usr_root" && u.email !== "admin@resumepipeline.com")
    .map((u) => ({ id: u.id, name: u.name, email: u.email }));

  let activeUserId = uid;
  let activeCandidateName: string | undefined = undefined;

  if (userId && userId !== uid) {
    const selected = candidates.find((c) => c.id === userId);
    if (selected) {
      activeUserId = selected.id;
      activeCandidateName = selected.name || selected.email;
    }
  }

  const profile = await loadProfile(activeUserId);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <JobTailorView
        profile={profile}
        isAdmin={isAdmin || candidates.length > 0}
        candidates={candidates}
        activeCandidateId={activeUserId !== uid ? activeUserId : undefined}
        activeCandidateName={activeCandidateName}
        currentUserId={uid}
      />
    </div>
  );
}
