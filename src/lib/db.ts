import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { DEFAULT_PROFILE_DATA, createEmptyProfile } from "./default-profile-data";
import type { ProfileData } from "./profile";
import { BUILT_IN_THEMES, type ThemeData } from "./themes";
import type { AppSettings } from "./profile-store";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "resume_pipeline.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Initialize Schema
const schemaPath = path.join(process.cwd(), "schema.sql");
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, "utf-8");
  db.exec(schema);
}

// Ensure role column exists in users table (migration)
try {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';");
} catch {
  // column already exists
}

// Ensure is_disabled column exists in users table (migration)
try {
  db.exec("ALTER TABLE users ADD COLUMN is_disabled INTEGER NOT NULL DEFAULT 0;");
} catch {
  // column already exists
}

// Ensure status column exists in tailored_drafts table (migration)
try {
  db.exec("ALTER TABLE tailored_drafts ADD COLUMN status TEXT NOT NULL DEFAULT 'generated';");
} catch {
  // column already exists
}

// Ensure notes column exists in tailored_drafts table (migration)
try {
  db.exec("ALTER TABLE tailored_drafts ADD COLUMN notes TEXT NOT NULL DEFAULT '';");
} catch {
  // column already exists
}

// Ensure certifications_json column exists in profiles table (migration)
try {
  db.exec("ALTER TABLE profiles ADD COLUMN certifications_json TEXT NOT NULL DEFAULT '[]';");
} catch {
  // column already exists
}

// ─── Password Hashing & Crypto ────────────────────────────────────────────────
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

// ─── Users & Sessions ─────────────────────────────────────────────────────────
export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: "admin" | "user";
  is_disabled: number;
  created_at: string;
  updated_at: string;
}

export function createUser(
  email: string,
  password: string,
  name: string,
  role: "admin" | "user" = "user"
): UserRecord {
  const id = `usr_${crypto.randomBytes(8).toString("hex")}`;
  const passwordHash = hashPassword(password);
  
  const stmt = db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, is_disabled)
    VALUES (?, ?, ?, ?, ?, 0)
  `);
  stmt.run(id, email.toLowerCase().trim(), passwordHash, name.trim(), role);

  // Initialize a completely blank profile for real users (NO dummy data)
  saveUserProfile(id, createEmptyProfile(name, email));

  // Initialize default workspace settings
  saveUserSettings(id, {
    baseThemeId: "editorial",
    paper: "LETTER",
    includeReferences: false,
    pageLimit: "none",
    language: null,
  });

  return getUserById(id)!;
}

export function getUserByEmail(email: string): UserRecord | null {
  const stmt = db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE");
  return (stmt.get(email.toLowerCase().trim()) as UserRecord) || null;
}

export function getUserById(id: string): UserRecord | null {
  const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
  return (stmt.get(id) as UserRecord) || null;
}

export function getAllUsers(): (UserRecord & { projectsCount: number })[] {
  const stmt = db.prepare("SELECT * FROM users ORDER BY created_at DESC");
  const users = stmt.all() as UserRecord[];
  return users.map((u) => {
    const prof = getUserProfile(u.id);
    return {
      ...u,
      projectsCount: prof.projects.length,
    };
  });
}

export function deleteUser(userId: string): boolean {
  const user = getUserById(userId);
  // Protect root admin from deletion (there is only one root admin)
  if (!user || user.id === "usr_root" || user.role === "admin") return false;
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  return true;
}

export function setUserDisabled(userId: string, disabled: boolean): boolean {
  const user = getUserById(userId);
  // Root admin cannot be disabled
  if (!user || user.id === "usr_root" || user.role === "admin") return false;
  db.prepare("UPDATE users SET is_disabled = ? WHERE id = ?").run(disabled ? 1 : 0, userId);
  if (disabled) {
    // Terminate all active sessions for this user immediately
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  }
  return true;
}

export function createSession(userId: string): string {
  const id = `ses_${crypto.randomBytes(8).toString("hex")}`;
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  const stmt = db.prepare(`
    INSERT INTO sessions (id, user_id, token, expires_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, userId, token, expiresAt);
  return token;
}

export function getUserFromSession(token: string): UserRecord | null {
  if (!token) return null;
  const stmt = db.prepare(`
    SELECT u.* FROM users u
    JOIN sessions s ON u.id = s.user_id
    WHERE s.token = ? AND (u.is_disabled IS NULL OR u.is_disabled = 0) AND datetime(s.expires_at) > datetime('now')
  `);
  return (stmt.get(token) as UserRecord) || null;
}

export function deleteSession(token: string): void {
  const stmt = db.prepare("DELETE FROM sessions WHERE token = ?");
  stmt.run(token);
}

// ─── Profile Persistence Scoped Per User ──────────────────────────────────────
export function getUserProfile(userId: string): ProfileData {
  const stmt = db.prepare("SELECT * FROM profiles WHERE user_id = ?");
  const row = stmt.get(userId) as any;

  if (!row) {
    const empty = createEmptyProfile();
    saveUserProfile(userId, empty);
    return empty;
  }

  try {
    const basics = JSON.parse(row.basics_json || "{}");
    const skills = JSON.parse(row.skills_json || "[]");
    const languages = JSON.parse(row.languages_json || "[]");
    const experience = JSON.parse(row.experience_json || "[]");
    const projects = JSON.parse(row.projects_json || "[]");
    const education = JSON.parse(row.education_json || "[]");
    let certifications = JSON.parse(row.certifications_json || "[]");
    const publications = JSON.parse(row.publications_json || "[]");

    // Migration fallback: if certifications is empty but legacy publications exist, convert them
    if (
      (!Array.isArray(certifications) || certifications.length === 0) &&
      Array.isArray(publications) &&
      publications.length > 0
    ) {
      certifications = publications.map((p: any, idx: number) => {
        if (p.name) return p;
        const cit = (p.citation || "").replace(/\*\*/g, "").trim();
        const parts = cit.split(" — ");
        const name = parts[0] || cit;
        let issuer = parts[1] || "";
        let date = "";
        const dateMatch = issuer.match(/\(([^)]+)\)$/);
        if (dateMatch) {
          date = dateMatch[1];
          issuer = issuer.replace(/\s*\([^)]+\)$/, "").trim();
        }
        return {
          id: p.id || `cert-${idx + 1}`,
          name,
          issuer,
          issueDate: date,
          link: p.link || "",
          onResumes: p.onResumes ?? true,
        };
      });
    }

    const references = JSON.parse(row.references_json || "[]");
    const facts = JSON.parse(row.facts_json || "[]");

    const photo = row.photo_src
      ? { src: row.photo_src, onResumes: Boolean(row.photo_on_resumes) }
      : null;

    const certList = Array.isArray(certifications) ? certifications : [];

    return {
      basics: {
        name: "",
        headline: "",
        email: "",
        phone: "",
        dob: "",
        website: "",
        address: "",
        city: "",
        country: "",
        linkedin: "",
        summary: "",
        showAge: false,
        ...basics,
      },
      photo,
      skills: Array.isArray(skills) ? skills : [],
      languages: Array.isArray(languages) ? languages : [],
      experience: Array.isArray(experience) ? experience : [],
      projects: Array.isArray(projects) ? projects : [],
      education: Array.isArray(education) ? education : [],
      certifications: certList,
      publications: certList,
      references: Array.isArray(references) ? references : [],
      facts: Array.isArray(facts) ? facts : [],
    };
  } catch (err) {
    console.error("Error reading profile row from SQLite:", err);
    return createEmptyProfile();
  }
}

export function saveUserProfile(userId: string, profile: ProfileData): void {
  const certs = profile.certifications || profile.publications || [];
  const stmt = db.prepare(`
    INSERT INTO profiles (
      user_id, basics_json, photo_src, photo_on_resumes,
      skills_json, languages_json, experience_json, projects_json,
      education_json, certifications_json, publications_json, references_json, facts_json,
      updated_at
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      datetime('now')
    )
    ON CONFLICT(user_id) DO UPDATE SET
      basics_json = excluded.basics_json,
      photo_src = excluded.photo_src,
      photo_on_resumes = excluded.photo_on_resumes,
      skills_json = excluded.skills_json,
      languages_json = excluded.languages_json,
      experience_json = excluded.experience_json,
      projects_json = excluded.projects_json,
      education_json = excluded.education_json,
      certifications_json = excluded.certifications_json,
      publications_json = excluded.publications_json,
      references_json = excluded.references_json,
      facts_json = excluded.facts_json,
      updated_at = datetime('now')
  `);

  stmt.run(
    userId,
    JSON.stringify(profile.basics || {}),
    profile.photo?.src || null,
    profile.photo?.onResumes ? 1 : 0,
    JSON.stringify(profile.skills || []),
    JSON.stringify(profile.languages || []),
    JSON.stringify(profile.experience || []),
    JSON.stringify(profile.projects || []),
    JSON.stringify(profile.education || []),
    JSON.stringify(certs),
    JSON.stringify(certs),
    JSON.stringify(profile.references || []),
    JSON.stringify(profile.facts || [])
  );
}

// ─── Custom Themes Scoped Per User ───────────────────────────────────────────
export function getUserThemes(userId: string): ThemeData[] {
  const stmt = db.prepare("SELECT theme_json FROM custom_themes WHERE user_id = ?");
  const rows = stmt.all(userId) as { theme_json: string }[];
  const custom = rows.map((r) => JSON.parse(r.theme_json));
  return [...BUILT_IN_THEMES, ...custom];
}

export function saveUserCustomTheme(userId: string, theme: ThemeData): void {
  const stmt = db.prepare(`
    INSERT INTO custom_themes (id, user_id, theme_json, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      theme_json = excluded.theme_json,
      updated_at = datetime('now')
  `);
  stmt.run(theme.id, userId, JSON.stringify(theme));
}

export function deleteUserCustomTheme(userId: string, themeId: string): void {
  const stmt = db.prepare("DELETE FROM custom_themes WHERE id = ? AND user_id = ?");
  stmt.run(themeId, userId);
}

// ─── User Workspace Settings ──────────────────────────────────────────────────
export function getUserSettings(userId: string): AppSettings {
  const stmt = db.prepare("SELECT * FROM user_settings WHERE user_id = ?");
  const row = stmt.get(userId) as any;
  if (!row) {
    return {
      baseThemeId: "editorial",
      paper: "LETTER",
      includeReferences: false,
      pageLimit: "none",
      language: null,
    };
  }
  return {
    baseThemeId: row.base_theme_id || "editorial",
    paper: row.paper === "A4" ? "A4" : "LETTER",
    includeReferences: Boolean(row.include_references),
    pageLimit: row.page_limit || "none",
    language: row.language || null,
  };
}

export function saveUserSettings(userId: string, settings: AppSettings): void {
  const stmt = db.prepare(`
    INSERT INTO user_settings (
      user_id, base_theme_id, paper, language, include_references, page_limit, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      base_theme_id = excluded.base_theme_id,
      paper = excluded.paper,
      language = excluded.language,
      include_references = excluded.include_references,
      page_limit = excluded.page_limit,
      updated_at = datetime('now')
  `);
  stmt.run(
    userId,
    settings.baseThemeId,
    settings.paper,
    settings.language || null,
    settings.includeReferences ? 1 : 0,
    settings.pageLimit
  );
}

// ─── Tailored Drafts & Job Descriptions Storage ──────────────────────────────
export interface TailoredDraftRecord {
  id: string;
  user_id: string;
  title: string;
  company: string;
  job_text: string;
  match_score: number;
  status: string;
  notes: string;
  units: { id: string; text: string }[];
  analysis: any;
  created_at: string;
  updated_at: string;
}

export function saveTailoredDraft(
  userId: string,
  draft: {
    title: string;
    company: string;
    job_text: string;
    match_score: number;
    units: { id: string; text: string }[];
    analysis: any;
    status?: string;
    notes?: string;
  }
): string {
  const id = `td_${crypto.randomBytes(8).toString("hex")}`;
  const stmt = db.prepare(`
    INSERT INTO tailored_drafts (
      id, user_id, title, company, job_text, match_score, status, notes, units_json, analysis_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  stmt.run(
    id,
    userId,
    draft.title,
    draft.company,
    draft.job_text,
    draft.match_score,
    draft.status || "generated",
    draft.notes || "",
    JSON.stringify(draft.units || []),
    JSON.stringify(draft.analysis || {})
  );
  return id;
}

export function getUserTailoredDrafts(userId: string): TailoredDraftRecord[] {
  const stmt = db.prepare(`
    SELECT * FROM tailored_drafts
    WHERE user_id = ?
    ORDER BY created_at DESC
  `);
  const rows = stmt.all(userId) as any[];
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    title: r.title,
    company: r.company,
    job_text: r.job_text,
    match_score: r.match_score,
    status: r.status || "generated",
    notes: r.notes || "",
    units: JSON.parse(r.units_json || "[]"),
    analysis: JSON.parse(r.analysis_json || "{}"),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

export function getTailoredDraftById(userId: string, draftId: string): TailoredDraftRecord | null {
  const stmt = db.prepare(`
    SELECT * FROM tailored_drafts
    WHERE id = ? AND user_id = ?
  `);
  const r = stmt.get(draftId, userId) as any;
  if (!r) return null;
  return {
    id: r.id,
    user_id: r.user_id,
    title: r.title,
    company: r.company,
    job_text: r.job_text,
    match_score: r.match_score,
    status: r.status || "generated",
    notes: r.notes || "",
    units: JSON.parse(r.units_json || "[]"),
    analysis: JSON.parse(r.analysis_json || "{}"),
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

export function updateTailoredDraft(
  userId: string,
  draftId: string,
  updates: {
    status?: string;
    notes?: string;
    title?: string;
    company?: string;
    analysis?: any;
    match_score?: number;
  }
): boolean {
  const existing = getTailoredDraftById(userId, draftId);
  if (!existing) return false;

  const nextStatus = updates.status !== undefined ? updates.status : existing.status;
  const nextNotes = updates.notes !== undefined ? updates.notes : existing.notes;
  const nextTitle = updates.title !== undefined ? updates.title : existing.title;
  const nextCompany = updates.company !== undefined ? updates.company : existing.company;
  const nextAnalysis = updates.analysis !== undefined ? JSON.stringify(updates.analysis) : JSON.stringify(existing.analysis || {});
  const nextMatchScore = updates.match_score !== undefined ? updates.match_score : existing.match_score;

  const stmt = db.prepare(`
    UPDATE tailored_drafts
    SET status = ?, notes = ?, title = ?, company = ?, analysis_json = ?, match_score = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `);
  const info = stmt.run(nextStatus, nextNotes, nextTitle, nextCompany, nextAnalysis, nextMatchScore, draftId, userId);
  return info.changes > 0;
}

export function deleteTailoredDraft(userId: string, draftId: string): boolean {
  const stmt = db.prepare("DELETE FROM tailored_drafts WHERE id = ? AND user_id = ?");
  const info = stmt.run(draftId, userId);
  return info.changes > 0;
}

// ─── Root Admin Account Initialization ───────────────────────────────────────
export function getRootAdminCredentials(): { username: string; passwordHash: string } {
  const username = (
    process.env.ROOT_ADMIN_USERNAME ||
    process.env.ROOT_USERNAME ||
    "admin@resumepipeline.com"
  ).toLowerCase().trim();

  const envHash = (
    process.env.ROOT_ADMIN_PASSWORD_HASH ||
    process.env.ROOT_PASSWORD_HASH ||
    ""
  ).trim();

  const envPassword = (
    process.env.ROOT_ADMIN_PASSWORD ||
    process.env.ROOT_PASSWORD ||
    ""
  ).trim();

  const passwordHash = envHash || (envPassword ? hashPassword(envPassword) : "");
  return { username, passwordHash };
}

export function ensureAdminUser(): UserRecord {
  const { username, passwordHash } = getRootAdminCredentials();

  // Find root user by deterministic id or email
  let root = db
    .prepare("SELECT * FROM users WHERE id = 'usr_root' OR email = ? COLLATE NOCASE")
    .get(username) as UserRecord | undefined;

  if (root) {
    const nextHash = passwordHash || root.password_hash;
    db.prepare(`
      UPDATE users
      SET email = ?, password_hash = ?, role = 'admin', name = 'Root Administrator', is_disabled = 0, updated_at = datetime('now')
      WHERE id = ?
    `).run(username, nextHash, root.id);
    root = getUserById(root.id)!;
  } else {
    const initialHash = passwordHash || hashPassword(crypto.randomBytes(24).toString("hex"));
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, is_disabled, created_at, updated_at)
      VALUES ('usr_root', ?, ?, 'Root Administrator', 'admin', 0, datetime('now'), datetime('now'))
    `).run(username, initialHash);

    saveUserProfile("usr_root", createEmptyProfile("Root Administrator", username));
    saveUserSettings("usr_root", {
      baseThemeId: "editorial",
      paper: "LETTER",
      includeReferences: false,
      pageLimit: "none",
      language: null,
    });
    root = getUserById("usr_root")!;
  }

  // System rule: There is only ONE root admin user; demote any other accidental admins
  db.prepare("UPDATE users SET role = 'user' WHERE role = 'admin' AND id != ?").run(root.id);

  return root;
}

// Automatically ensure single root admin user is provisioned on module load / startup
try {
  ensureAdminUser();
} catch (err) {
  console.error("Error bootstrapping root admin user:", err);
}
