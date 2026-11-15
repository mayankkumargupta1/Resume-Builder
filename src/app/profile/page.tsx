import type { Metadata } from "next";
import { getAuthenticatedUserIdForPage, loadProfile } from "@/lib/profile-store";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { sectionFromParam } from "@/components/profile/sections";

export const metadata: Metadata = {
  title: "Master Profile & Projects · Resume Pipeline",
};

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const uid = await getAuthenticatedUserIdForPage();
  const profile = await loadProfile(uid);
  const { section } = (await searchParams) ?? {};
  const initialSection = sectionFromParam(section);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <ProfileEditor initial={profile} initialSection={initialSection} />
    </div>
  );
}
