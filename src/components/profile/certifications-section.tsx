"use client";

import { useTrackSave } from "@/components/save-tracker";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAutosave } from "@/hooks/use-autosave";
import type { CertificationItem, ProfileData } from "@/lib/profile";
import { displayLink } from "@/lib/resume-content";

import {
  createCertification,
  removeCertification,
  reorderCertifications,
  restoreCertification,
  saveCertification,
} from "./actions";
import { EntryList } from "./entry-list";
import type { UpdateProfile } from "./skills-section";

/** The fields of an open certification, autosaved as you type. */
function CertificationForm({
  entry,
  onChange,
  autoFocus,
}: {
  entry: CertificationItem;
  onChange: (entry: CertificationItem) => void;
  autoFocus: boolean;
}) {
  const track = useTrackSave();
  const { flush } = useAutosave(entry, (value) => track(saveCertification(value)));
  const set = (change: Partial<CertificationItem>) => onChange({ ...entry, ...change });

  return (
    <div className="grid grid-cols-2 gap-[18px]" onBlur={flush}>
      <Input
        className="col-span-2 sm:col-span-1"
        label="Certificate Name"
        placeholder="e.g. Django Web Framework, AWS Solutions Architect"
        value={entry.name}
        onChange={(event) => set({ name: event.target.value })}
        autoFocus={autoFocus}
      />
      <Input
        className="col-span-2 sm:col-span-1"
        label="Issuing Organization"
        placeholder="e.g. Meta, IBM, Coursera, HackerRank"
        value={entry.issuer}
        onChange={(event) => set({ issuer: event.target.value })}
      />
      <Input
        className="col-span-2 sm:col-span-1"
        label="Issue Date"
        placeholder="e.g. August 2024 or Aug 18, 2024"
        value={entry.issueDate}
        onChange={(event) => set({ issueDate: event.target.value })}
      />
      <Input
        className="col-span-2 sm:col-span-1"
        label={
          <>
            Credential URL <span className="font-normal text-muted">(optional)</span>
          </>
        }
        placeholder="https://coursera.org/verify/..."
        hint="Verification or certificate link. Clickable on the generated resume PDF."
        value={entry.link}
        onChange={(event) => set({ link: event.target.value })}
      />
      <Checkbox
        className="col-span-2"
        label="Show on resumes"
        hint="Off keeps the certification in your profile, but hides it from resumes."
        checked={entry.onResumes}
        onChange={(event) => set({ onResumes: event.target.checked })}
      />
    </div>
  );
}

/**
 * Certifications Section: professional certificates, credentials, and courses.
 * Displayed on resumes with title, issuing authority, date, and verification links.
 */
export function CertificationsSection({
  profile,
  update,
}: {
  profile: ProfileData;
  update: UpdateProfile;
}) {
  const items = profile.certifications || profile.publications || [];

  return (
    <EntryList
      items={items}
      setItems={(change) =>
        update((current) => {
          const updated = change(current.certifications || current.publications || []);
          return {
            ...current,
            certifications: updated,
            publications: updated,
          };
        })
      }
      addLabel="Add a certification"
      ordering={{ mode: "manual", save: (ids) => reorderCertifications({ ids }) }}
      summary={(entry) => ({
        title: entry.name || (entry as any).citation || "New certification",
        subtitle:
          [entry.issuer, entry.issueDate].filter(Boolean).join(" · ") ||
          displayLink(entry.link || "") ||
          "No issuer specified",
        meta: entry.onResumes ? undefined : "Not on resumes",
      })}
      create={() => createCertification({})}
      remove={(entry) => removeCertification({ id: entry.id })}
      restore={(entry) => restoreCertification(entry)}
      renderForm={(entry, { onChange, autoFocus }) => (
        <CertificationForm entry={entry} onChange={onChange} autoFocus={autoFocus} />
      )}
    />
  );
}
