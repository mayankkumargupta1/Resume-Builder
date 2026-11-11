import type { Metadata } from "next";
import { getAuthenticatedUserIdForPage, loadProfile } from "@/lib/profile-store";
import { ProfileEditor } from "@/components/profile/profile-editor";

export const metadata: Metadata = {
  title: "Master Profile & Projects · Resume Pipeline",
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const uid = await getAuthenticatedUserIdForPage();
  const profile = await loadProfile(uid);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <ProfileEditor initial={profile} />
    </div>
  );
}
