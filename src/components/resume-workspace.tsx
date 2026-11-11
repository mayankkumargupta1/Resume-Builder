"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DocumentPreview } from "@/components/documents/document-preview";
import { ResumeDocument } from "@/components/documents/resume-document";
import { UnitFrame } from "@/components/documents/unit-frame";
import { PageHeader } from "@/components/page-header";
import { toast, toastResult } from "@/components/toast";
import { Button, buttonClassName } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaperSize } from "@/lib/enums";
import type { ProfileData } from "@/lib/profile";
import { saveFile } from "@/lib/save-file";
import { pagesInWords } from "@/lib/settings";
import { parseThemeFile, themeFile, themeFileName } from "@/lib/theme-file";
import { PAPER_SIZES, type ThemeData } from "@/lib/themes";
import { deleteTheme, duplicateTheme, importTheme, saveTheme, setBaseTheme } from "@/components/themes/actions";
import { draftFrom, ThemeBuilder, type ThemeDraft } from "@/components/themes/theme-builder";
import { ThemePicker } from "@/components/themes/theme-picker";
import { Printer, Sparkles, SlidersHorizontal, ArrowLeft, RefreshCw, Check, Globe } from "lucide-react";

export type ResumeWorkspaceProps = {
  profile: ProfileData;
  themes: ThemeData[];
  baseThemeId: string;
  paper: PaperSize;
  includeReferences?: boolean;
  maxPages?: number | null;
  language?: string | null;
  tailoredUnits?: { id: string; text: string }[] | null;
  tailoredTarget?: { title: string; company: string } | null;
  onUpdateProfile?: (updated: ProfileData) => void;
  onNavigateToProfile?: () => void;
  onNavigateToTailor?: () => void;
};

type Panel = "themes" | "customize";

const LANGUAGES = [
  { code: null, label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "nl", label: "Nederlands" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
];

export function ResumeWorkspace({
  profile,
  themes: initialThemes,
  baseThemeId,
  paper: initialPaper,
  includeReferences = false,
  maxPages = null,
  language: initialLanguage = null,
  tailoredUnits = null,
  tailoredTarget = null,
  onUpdateProfile,
  onNavigateToProfile,
  onNavigateToTailor,
}: ResumeWorkspaceProps) {
  const [themes, setThemes] = useState(initialThemes);
  const [baseId, setBaseId] = useState(baseThemeId);
  const [paper, setPaper] = useState<PaperSize>(initialPaper);
  const [language, setLanguage] = useState<string | null>(initialLanguage);
  const [panel, setPanel] = useState<Panel>("themes");
  const [draft, setDraft] = useState<ThemeDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ThemeData | null>(null);
  const [showTailored, setShowTailored] = useState(Boolean(tailoredUnits && tailoredUnits.length > 0));

  // In-document editing state
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [flashingUnitIds, setFlashingUnitIds] = useState<Set<string>>(new Set());
  const [activeTailoredUnits, setActiveTailoredUnits] = useState<{ id: string; text: string }[] | null>(tailoredUnits);
  const [activeTailoredTarget, setActiveTailoredTarget] = useState<{ title: string; company: string } | null>(tailoredTarget);

  useEffect(() => {
    setActiveTailoredUnits(tailoredUnits);
    setShowTailored(Boolean(tailoredUnits && tailoredUnits.length > 0));
  }, [tailoredUnits]);

  useEffect(() => {
    if (tailoredTarget) {
      setActiveTailoredTarget(tailoredTarget);
    }
  }, [tailoredTarget]);

  const savedId = useRef(baseThemeId);
  const pickedId = useRef(baseThemeId);

  const base = themes.find((entry) => entry.id === baseId) ?? themes[0];
  const theme: ThemeData = draft ? { ...draft, id: draft.id ?? "draft", builtIn: false } : base;

  const empty =
    !profile.basics.name.trim() &&
    profile.experience.length === 0 &&
    profile.projects.length === 0 &&
    profile.education.length === 0 &&
    profile.skills.length === 0;

  const panelArea = useRef<HTMLElement>(null);
  const movedPanel = useRef(false);

  useEffect(() => {
    if (!movedPanel.current) return;
    movedPanel.current = false;
    const frame = requestAnimationFrame(() =>
      panelArea.current?.querySelector<HTMLElement>(panel === "customize" ? "input" : "[data-in-use]")?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [panel]);

  const openPanel = (next: Panel, moveFocus = false) => {
    movedPanel.current = moveFocus;
    setDraft(next === "customize" ? (draft ?? draftFrom(base)) : null);
    setPanel(next);
  };

  const selectTheme = async (id: string) => {
    if (id === baseId) return;
    setBaseId(id);
    pickedId.current = id;
    const result = toastResult(await setBaseTheme({ id }));
    if (result.ok) savedId.current = id;
    else if (pickedId.current === id) setBaseId(savedId.current);
  };

  const addTheme = (added: ThemeData) => {
    setThemes((current) => [...current, added]);
    setBaseId(added.id);
    savedId.current = pickedId.current = added.id;
  };

  const duplicate = async () => {
    const result = toastResult(await duplicateTheme({ id: base.id }));
    if (result.ok) addTheme(result.data);
  };

  const exportFile = () =>
    saveFile(new Blob([JSON.stringify(themeFile(base), null, 2)], { type: "application/json" }), themeFileName(base));

  const importFile = async (file: File) => {
    if (file.size > 100_000) return toast("That file is too big to be a valid theme file.");
    try {
      const text = await file.text();
      const result = toastResult(await importTheme({ text }));
      if (result.ok) addTheme(result.data);
    } catch {
      toast("Could not read theme file.");
    }
  };

  const remove = async (t: ThemeData) => {
    const result = toastResult(await deleteTheme({ id: t.id }));
    if (!result.ok) return;
    setThemes((current) => current.filter((entry) => entry.id !== t.id));
    setBaseId("editorial");
    savedId.current = pickedId.current = "editorial";
  };

  const saveDraft = async () => {
    if (!draft) return;
    setSaving(true);
    const result = toastResult(await saveTheme(draft));
    setSaving(false);
    if (!result.ok) return;
    const saved = result.data;
    setThemes((current) =>
      current.some((entry) => entry.id === saved.id)
        ? current.map((entry) => (entry.id === saved.id ? saved : entry))
        : [...current, saved],
    );
    setBaseId(saved.id);
    savedId.current = pickedId.current = saved.id;
    openPanel("themes", true);
  };

  // Trigger flash animation for unit
  const triggerFlash = (id: string) => {
    setFlashingUnitIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setFlashingUnitIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 1600);
  };

  // Save in-place unit edit directly to profile or active tailored units
  const handleSaveUnit = async (unitId: string, newText: string) => {
    const isTailoredActive = showTailored && Boolean(activeTailoredUnits);

    if (isTailoredActive && activeTailoredUnits) {
      // Update tailored units override
      const updated = activeTailoredUnits.some((u) => u.id === unitId)
        ? activeTailoredUnits.map((u) => (u.id === unitId ? { ...u, text: newText } : u))
        : [...activeTailoredUnits, { id: unitId, text: newText }];
      setActiveTailoredUnits(updated);
      setEditingUnitId(null);
      triggerFlash(unitId);
      toast("Saved tailored update.");
      return;
    }

    // Save directly to profile
    let updatedProfile = { ...profile };

    if (unitId === "summary") {
      updatedProfile = {
        ...updatedProfile,
        basics: { ...updatedProfile.basics, summary: newText },
      };
    } else if (unitId.startsWith("project:")) {
      const projId = unitId.replace("project:", "");
      updatedProfile = {
        ...updatedProfile,
        projects: updatedProfile.projects.map((p) =>
          p.id === projId ? { ...p, bullets: newText } : p
        ),
      };
    } else if (unitId.startsWith("experience:")) {
      const expId = unitId.replace("experience:", "");
      updatedProfile = {
        ...updatedProfile,
        experience: updatedProfile.experience.map((e) =>
          e.id === expId ? { ...e, bullets: newText } : e
        ),
      };
    } else if (unitId.startsWith("education:")) {
      const eduId = unitId.replace("education:", "");
      updatedProfile = {
        ...updatedProfile,
        education: updatedProfile.education.map((edu) =>
          edu.id === eduId ? { ...edu, notes: newText } : edu
        ),
      };
    }

    onUpdateProfile?.(updatedProfile);

    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedProfile),
      });
      toast("Saved changes to base profile.");
    } catch {
      toast("Failed to persist changes to disk.");
    }

    setEditingUnitId(null);
    triggerFlash(unitId);
  };

  // Convert activeTailoredUnits into units map for ResumeDocument
  const units = showTailored && activeTailoredUnits ? activeTailoredUnits : undefined;

  // Custom unit renderer supporting in-place editing
  const renderUnit = ({
    id,
    className,
    head,
    children,
  }: {
    id: string;
    className?: string;
    head?: React.ReactNode;
    children: React.ReactNode;
  }) => {
    // Get initial text for this unit
    let initialText = "";
    const isBullet = id.startsWith("project:") || id.startsWith("experience:");

    if (units) {
      initialText = units.find((u) => u.id === id)?.text ?? "";
    }

    if (!initialText) {
      if (id === "summary") initialText = profile.basics.summary;
      else if (id.startsWith("project:")) {
        const p = profile.projects.find((item) => item.id === id.replace("project:", ""));
        initialText = p?.bullets ?? "";
      } else if (id.startsWith("experience:")) {
        const e = profile.experience.find((item) => item.id === id.replace("experience:", ""));
        initialText = e?.bullets ?? "";
      } else if (id.startsWith("education:")) {
        const edu = profile.education.find((item) => item.id === id.replace("education:", ""));
        initialText = edu?.notes ?? "";
      }
    }

    return (
      <UnitFrame
        key={id}
        id={id}
        className={className}
        head={head}
        initialText={initialText}
        isBullet={isBullet}
        editing={editingUnitId === id}
        flashing={flashingUnitIds.has(id)}
        onEdit={() => setEditingUnitId(id)}
        onCancel={() => setEditingUnitId(null)}
        onSave={(text) => handleSaveUnit(id, text)}
      >
        {children}
      </UnitFrame>
    );
  };

  const currentTarget = tailoredTarget ?? activeTailoredTarget;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title={currentTarget && showTailored ? `Tailored: ${currentTarget.title}` : "Base resume"}
        description={
          currentTarget && showTailored
            ? `Specially curated for ${currentTarget.company || "Target Company"}. Hover any section or bullet to edit in place.`
            : "Built straight from your profile. Every project and role is displayed. Hover any section to edit in place."
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {currentTarget && (
              <div className="flex items-center gap-2 rounded-control border border-line-card bg-card px-3 py-1 text-control">
                <Sparkles className="size-3.5 text-accent" />
                <span className="text-xs font-semibold text-ink">
                  {showTailored ? `Tailored (${currentTarget.company})` : "Master Profile"}
                </span>
                <button
                  type="button"
                  onClick={() => setShowTailored(!showTailored)}
                  className="ml-1 text-xs text-accent hover:underline font-medium cursor-pointer"
                >
                  {showTailored ? "Switch to Base Profile" : "Switch to Tailored"}
                </button>
              </div>
            )}

            {/* Language Selector */}
            <div className="flex items-center gap-1 rounded-control border border-line-card bg-card px-2 py-1">
              <Globe className="size-3 text-muted" />
              <select
                aria-label="Resume Language"
                value={language ?? ""}
                onChange={(e) => setLanguage(e.target.value || null)}
                className="bg-transparent text-xs text-ink focus:outline-none cursor-pointer"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.label} value={l.code ?? ""}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Paper Size */}
            <div className="flex gap-1 rounded-control border border-line-card bg-card p-0.5">
              {(["LETTER", "A4"] as PaperSize[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPaper(p)}
                  className={`rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    paper === p ? "bg-primary text-on-primary font-semibold" : "text-muted hover:text-ink"
                  }`}
                >
                  {p === "LETTER" ? "Letter" : "A4"}
                </button>
              ))}
            </div>

            {onNavigateToProfile ? (
              <Button variant="secondary" onClick={onNavigateToProfile}>
                Edit profile & projects
              </Button>
            ) : (
              <Link href="/profile" className={buttonClassName("secondary")}>
                Edit profile & projects
              </Link>
            )}

            <Button
              variant="primary"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="size-3.5" />
              Download / Print PDF
            </Button>
          </div>
        }
      />

      <div className="@container flex flex-1 flex-wrap border-t border-line overflow-hidden">
        <DocumentPreview
          label={theme.name}
          meta={(pages) => `${PAPER_SIZES[paper].label} · ${pages} ${pages === 1 ? "page" : "pages"}`}
          notice={(pages) =>
            empty ? (
              <p role="note" className="rounded-card bg-card px-4 py-2.5 text-meta text-muted">
                Your resume fills in from your profile. Add your name, projects, and experience, and it takes shape here.{" "}
                {onNavigateToProfile ? (
                  <button onClick={onNavigateToProfile} className="text-ink underline underline-offset-2">
                    Go to your profile
                  </button>
                ) : (
                  <Link href="/profile" className="text-ink underline underline-offset-2">
                    Go to your profile
                  </Link>
                )}
              </p>
            ) : (
              maxPages !== null &&
              pages > maxPages && (
                <p role="note" className="rounded-card bg-warning-surface px-4 py-2.5 text-meta text-warning">
                  Your base resume runs over {pagesInWords(maxPages)}. Tailored resumes are trimmed to fit.
                </p>
              )
            )
          }
        >
          <ResumeDocument
            theme={theme}
            profile={profile}
            paper={paper}
            includeReferences={includeReferences}
            language={language}
            units={units}
            renderUnit={renderUnit}
          />
        </DocumentPreview>

        <aside
          ref={panelArea}
          aria-label="Theme"
          className="flex flex-[1_0_340px] max-w-[420px] flex-col border-t border-line bg-paper px-7 pt-7 pb-12 overflow-y-auto @min-[780px]:border-t-0 @min-[780px]:border-l"
        >
          <Tabs value={panel} onValueChange={(value) => openPanel(value as Panel)} className="flex flex-col gap-6">
            <TabsList variant="segmented">
              <TabsTrigger value="themes">Themes</TabsTrigger>
              <TabsTrigger value="customize">Customize</TabsTrigger>
            </TabsList>
            <TabsContent value="themes">
              <ThemePicker
                themes={themes}
                activeId={theme.id}
                userName={profile.basics.name.trim() || "Your name"}
                onSelect={selectTheme}
                onCustomize={() => openPanel("customize", true)}
                actions={{
                  duplicate: () => void duplicate(),
                  exportFile,
                  remove: () => setDeleting(base),
                  importFile: (file) => void importFile(file),
                }}
              />
            </TabsContent>
            <TabsContent value="customize">
              {draft && (
                <ThemeBuilder
                  draft={draft}
                  onChange={setDraft}
                  onSave={saveDraft}
                  onCancel={() => openPanel("themes", true)}
                  saving={saving}
                />
              )}
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete “${deleting?.name ?? ""}”?`}
        description="Editorial becomes your base theme. This can't be undone, but you can export the theme first."
        confirmLabel="Delete theme"
        onConfirm={() => deleting && void remove(deleting)}
      />
    </div>
  );
}
