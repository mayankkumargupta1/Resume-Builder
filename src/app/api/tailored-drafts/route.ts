import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth";
import { getUserTailoredDrafts, getTailoredDraftById, updateTailoredDraft, deleteTailoredDraft } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const user = await getOptionalUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please sign in to view drafts." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const draft = getTailoredDraftById(user.id, id);
      if (!draft) {
        return NextResponse.json({ success: false, error: "Draft not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, draft });
    }

    const drafts = getUserTailoredDrafts(user.id);
    return NextResponse.json({ success: true, drafts });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getOptionalUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please sign in to update drafts." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { id, status, notes, title, company } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: "Draft ID required" }, { status: 400 });
    }

    const ok = updateTailoredDraft(user.id, id, { status, notes, title, company });
    if (!ok) {
      return NextResponse.json({ success: false, error: "Failed to update draft or draft not found." }, { status: 404 });
    }

    const updated = getTailoredDraftById(user.id, id);
    return NextResponse.json({ success: true, draft: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getOptionalUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please sign in to delete drafts." },
        { status: 401 }
      );
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Draft ID required" }, { status: 400 });
    }
    const ok = deleteTailoredDraft(user.id, id);
    return NextResponse.json({ success: ok });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
