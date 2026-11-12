import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import { getAllUsers } from "@/lib/db";
import { AdminUserManagementView } from "@/components/admin/admin-user-management-view";
import { AdminLoginForm } from "@/components/admin/admin-login-form";

export const metadata: Metadata = {
  title: "Admin Portal · Resume Pipeline",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getOptionalUser();

  // If not authenticated as an admin, prompt for admin credentials
  if (!user || user.role !== "admin") {
    return (
      <div className="flex flex-1 items-center justify-center bg-paper px-4 py-12">
        <AdminLoginForm />
      </div>
    );
  }

  const allUsers = await getAllUsers();

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-paper">
      <AdminUserManagementView users={allUsers} currentUserId={user.id} />
    </div>
  );
}
