import type { Metadata } from "next";
import { getAuthenticatedUserIdForPage, loadProfile } from "@/lib/profile-store";
import { JobTailorView } from "@/components/job-tailor-view";

export const metadata: Metadata = {
  title: "Job Tailoring Agent · Resume Pipeline",
};

export const dynamic = "force-dynamic";

export default async function TailorPage() {
  const uid = await getAuthenticatedUserIdForPage();
  const profile = await loadProfile(uid);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <JobTailorView profile={profile} />
    </div>
  );
}
