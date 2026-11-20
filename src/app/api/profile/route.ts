import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth";
import { loadProfile, saveProfile } from "@/lib/profile-store";
import type { ProfileData } from "@/lib/profile";

export async function GET(req: Request) {
  try {
    const user = await getOptionalUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please sign in to view profile." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");
    // Any authenticated user can read candidate profiles for preview and tailoring
    const uid = targetUserId || user.id;

    const profile = await loadProfile(uid);
    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getOptionalUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please sign in to update profile." },
        { status: 401 }
      );
    }
    const updatedProfile: ProfileData = await req.json();
    await saveProfile(updatedProfile, user.id);
    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
