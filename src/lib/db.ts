import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createEmptyProfile } from "./default-profile-data";
import type { ProfileData } from "./profile";
import { BUILT_IN_THEMES, type ThemeData } from "./themes";
import type { AppSettings } from "./profile-store";

type Queryable = Pick<Pool, "query">;

const globalForDb = globalThis as unknown as {
  __pgPool?: Pool;
  __pgInitPromise?: Promise<void> | null;
  __pgInitialized?: boolean;
};

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  const pool = connectionString
    ? new Pool({
        connectionString,
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      })
    : new Pool({
        host: process.env.POSTGRES_HOST || process.env.PGHOST || "localhost",
        port: Number(process.env.POSTGRES_PORT || process.env.PGPORT || 5432),
        user: process.env.POSTGRES_USER || process.env.PGUSER || "resume_builder",
        password: process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || "",
        database: process.env.POSTGRES_DB || process.env.PGDATABASE || "resume_builder",
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      });

  pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL pool error:", err);
  });

  return pool;
}

function getPool(): Pool {
  if (!globalForDb.__pgPool) {
    globalForDb.__pgPool = createPool();
  }
  return globalForDb.__pgPool;
}

const TRANSIENT_PG_CODES = new Set(["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "57P03", "57P01"]);

function isTransientError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  return Boolean(code && TRANSIENT_PG_CODES.has(code));
}

async function runSchemaAndSeed(): Promise<void> {
  const pool = getPool();
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let client: PoolClient | null = null;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      // Serialize concurrent cold-start schema initialization across workers/processes
      await client.query("SELECT pg_advisory_xact_lock(918273645)");

      const schemaPath = path.join(process.cwd(), "schema.sql");
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, "utf-8");
        await client.query(schema);
      }

      // Idempotent column migrations for pre-existing schemas
      await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'");
      await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT FALSE");
      await client.query("ALTER TABLE tailored_drafts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'generated'");
      await client.query("ALTER TABLE tailored_drafts ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT ''");
      await client.query(
        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS certifications_json JSONB NOT NULL DEFAULT '[]'::jsonb"
      );

      await ensureAdminUserWithClient(client);
      await client.query("COMMIT");
      return;
    } catch (err) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // ignore rollback error
        }
      }
      if (attempt < maxAttempts && isTransientError(err)) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
        continue;
      }
      throw err;
    } finally {
      client?.release();
    }
  }
}

export async function ensureDbInitialized(): Promise<void> {
  if (globalForDb.__pgInitialized) return;
  if (!globalForDb.__pgInitPromise) {
    globalForDb.__pgInitPromise = runSchemaAndSeed()
      .then(() => {
        globalForDb.__pgInitialized = true;
      })
      .catch((err) => {
        globalForDb.__pgInitPromise = null;
        throw err;
      });
  }
  await globalForDb.__pgInitPromise;
}

async function query<T extends QueryResultRow = any>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
  await ensureDbInitialized();
  return getPool().query<T>(text, params);
}

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureDbInitialized();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback error
    }
    throw err;
  } finally {
    client.release();
  }
}

// ─── Serialization & Row Mapping Helpers ──────────────────────────────────────
function stripNullBytes(value: string): string {
  return value.includes("\u0000") ? value.replace(/\u0000/g, "") : value;
}

function toJsonParam(value: unknown): string {
  return stripNullBytes(JSON.stringify(value));
}

function parseJsonCol<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return value ? String(value) : "";
}

function mapUserRow(row: any): UserRecord {
  return {
    id: row.id,
    email: row.email,
    password_hash: row.password_hash,
    name: row.name ?? "",
    role: row.role === "admin" ? "admin" : "user",
    is_disabled: Boolean(row.is_disabled),
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function mapTailoredDraftRow(r: any): TailoredDraftRecord {
  return {
    id: r.id,
    user_id: r.user_id,
    title: r.title,
    company: r.company,
    job_text: r.job_text,
    match_score: Number(r.match_score ?? 0),
    status: r.status || "generated",
    notes: r.notes || "",
    units: parseJsonCol<{ id: string; text: string }[]>(r.units_json, []),
    analysis: parseJsonCol<any>(r.analysis_json, {}),
    created_at: toIsoString(r.created_at),
    updated_at: toIsoString(r.updated_at),
  };
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
  is_disabled: boolean;
  created_at: string;
  updated_at: string;
}

export async function createUser(
  email: string,
  password: string,
  name: string,
  role: "admin" | "user" = "user"
): Promise<UserRecord> {
  const id = `usr_${crypto.randomBytes(8).toString("hex")}`;
  const passwordHash = hashPassword(password);
  const normalizedEmail = email.toLowerCase().trim();
  const trimmedName = name.trim();

  return withTransaction(async (client) => {
    const res = await client.query(
      `INSERT INTO users (id, email, password_hash, name, role, is_disabled)
       VALUES ($1, $2, $3, $4, $5, FALSE)
       RETURNING *`,
      [id, normalizedEmail, passwordHash, trimmedName, role]
    );

    // Initialize a completely blank profile for real users (NO dummy data)
    await saveUserProfileWithQueryable(client, id, createEmptyProfile(name, email));

    // Initialize default workspace settings
    await saveUserSettingsWithQueryable(client, id, {
      baseThemeId: "editorial",
      paper: "LETTER",
      includeReferences: false,
      pageLimit: "none",
      language: null,
    });

    return mapUserRow(res.rows[0]);
  });
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const res = await query("SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1", [
    email.toLowerCase().trim(),
  ]);
  return res.rows[0] ? mapUserRow(res.rows[0]) : null;
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const res = await query("SELECT * FROM users WHERE id = $1", [id]);
  return res.rows[0] ? mapUserRow(res.rows[0]) : null;
}

export async function getAllUsers(): Promise<(UserRecord & { projectsCount: number })[]> {
  const res = await query(`
    SELECT
      u.*,
      CASE
        WHEN p.projects_json IS NOT NULL AND jsonb_typeof(p.projects_json) = 'array'
        THEN jsonb_array_length(p.projects_json)
        ELSE 0
      END AS projects_count
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    ORDER BY u.created_at DESC
  `);
  return res.rows.map((row) => ({
    ...mapUserRow(row),
    projectsCount: Number(row.projects_count ?? 0),
  }));
}

export async function deleteUser(userId: string): Promise<boolean> {
  const user = await getUserById(userId);
  // Protect root admin from deletion (there is only one root admin)
  if (!user || user.id === "usr_root" || user.role === "admin") return false;
  const res = await query("DELETE FROM users WHERE id = $1", [userId]);
  return (res.rowCount ?? 0) > 0;
}

export async function setUserDisabled(userId: string, disabled: boolean): Promise<boolean> {
  const user = await getUserById(userId);
  // Root admin cannot be disabled
  if (!user || user.id === "usr_root" || user.role === "admin") return false;
  await withTransaction(async (client) => {
    await client.query("UPDATE users SET is_disabled = $1, updated_at = NOW() WHERE id = $2", [
      disabled,
      userId,
    ]);
    if (disabled) {
      // Terminate all active sessions for this user immediately
      await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    }
  });
  return true;
}

export async function createSession(userId: string): Promise<string> {
  const id = `ses_${crypto.randomBytes(8).toString("hex")}`;
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await query(
    `INSERT INTO sessions (id, user_id, token, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [id, userId, token, expiresAt]
  );
  return token;
}

export async function getUserFromSession(token: string): Promise<UserRecord | null> {
  if (!token) return null;
  const res = await query(
    `SELECT u.* FROM users u
     JOIN sessions s ON u.id = s.user_id
     WHERE s.token = $1
       AND COALESCE(u.is_disabled, FALSE) = FALSE
       AND s.expires_at > NOW()`,
    [token]
  );
  return res.rows[0] ? mapUserRow(res.rows[0]) : null;
}

export async function deleteSession(token: string): Promise<void> {
  await query("DELETE FROM sessions WHERE token = $1", [token]);
}

// ─── Profile Persistence Scoped Per User ──────────────────────────────────────
export async function getUserProfile(userId: string): Promise<ProfileData> {
  const res = await query("SELECT * FROM profiles WHERE user_id = $1", [userId]);
  const row = res.rows[0];

  if (!row) {
    const empty = createEmptyProfile();
    await saveUserProfile(userId, empty);
    return empty;
  }

  try {
    const basics = parseJsonCol<Record<string, unknown>>(row.basics_json, {});
    const skills = parseJsonCol<any[]>(row.skills_json, []);
    const languages = parseJsonCol<any[]>(row.languages_json, []);
    const experience = parseJsonCol<any[]>(row.experience_json, []);
    const projects = parseJsonCol<any[]>(row.projects_json, []);
    const education = parseJsonCol<any[]>(row.education_json, []);
    let certifications = parseJsonCol<any[]>(row.certifications_json, []);
    const publications = parseJsonCol<any[]>(row.publications_json, []);

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

    const references = parseJsonCol<any[]>(row.references_json, []);
    const facts = parseJsonCol<any[]>(row.facts_json, []);

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
    console.error("Error reading profile row from PostgreSQL:", err);
    return createEmptyProfile();
  }
}

async function saveUserProfileWithQueryable(
  q: Queryable,
  userId: string,
  profile: ProfileData
): Promise<void> {
  const certs = profile.certifications || profile.publications || [];
  await q.query(
    `INSERT INTO profiles (
      user_id, basics_json, photo_src, photo_on_resumes,
      skills_json, languages_json, experience_json, projects_json,
      education_json, certifications_json, publications_json, references_json, facts_json,
      updated_at
    ) VALUES (
      $1, $2::jsonb, $3, $4,
      $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb,
      $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      basics_json = EXCLUDED.basics_json,
      photo_src = EXCLUDED.photo_src,
      photo_on_resumes = EXCLUDED.photo_on_resumes,
      skills_json = EXCLUDED.skills_json,
      languages_json = EXCLUDED.languages_json,
      experience_json = EXCLUDED.experience_json,
      projects_json = EXCLUDED.projects_json,
      education_json = EXCLUDED.education_json,
      certifications_json = EXCLUDED.certifications_json,
      publications_json = EXCLUDED.publications_json,
      references_json = EXCLUDED.references_json,
      facts_json = EXCLUDED.facts_json,
      updated_at = NOW()`,
    [
      userId,
      toJsonParam(profile.basics || {}),
      profile.photo?.src || null,
      Boolean(profile.photo?.onResumes),
      toJsonParam(profile.skills || []),
      toJsonParam(profile.languages || []),
      toJsonParam(profile.experience || []),
      toJsonParam(profile.projects || []),
      toJsonParam(profile.education || []),
      toJsonParam(certs),
      toJsonParam(certs),
      toJsonParam(profile.references || []),
      toJsonParam(profile.facts || []),
    ]
  );
}

export async function saveUserProfile(userId: string, profile: ProfileData): Promise<void> {
  await ensureDbInitialized();
  await saveUserProfileWithQueryable(getPool(), userId, profile);
}

// ─── Custom Themes Scoped Per User ───────────────────────────────────────────
export async function getUserThemes(userId: string): Promise<ThemeData[]> {
  const res = await query<{ theme_json: unknown }>(
    "SELECT theme_json FROM custom_themes WHERE user_id = $1",
    [userId]
  );
  const custom = res.rows
    .map((r) => parseJsonCol<ThemeData | null>(r.theme_json, null))
    .filter((t): t is ThemeData => t !== null);
  return [...BUILT_IN_THEMES, ...custom];
}

export async function saveUserCustomTheme(userId: string, theme: ThemeData): Promise<void> {
  await query(
    `INSERT INTO custom_themes (id, user_id, theme_json, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET
       theme_json = EXCLUDED.theme_json,
       updated_at = NOW()
     WHERE custom_themes.user_id = EXCLUDED.user_id`,
    [theme.id, userId, toJsonParam(theme)]
  );
}

export async function deleteUserCustomTheme(userId: string, themeId: string): Promise<void> {
  await query("DELETE FROM custom_themes WHERE id = $1 AND user_id = $2", [themeId, userId]);
}

// ─── User Workspace Settings ──────────────────────────────────────────────────
export async function getUserSettings(userId: string): Promise<AppSettings> {
  const res = await query("SELECT * FROM user_settings WHERE user_id = $1", [userId]);
  const row = res.rows[0];
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

async function saveUserSettingsWithQueryable(
  q: Queryable,
  userId: string,
  settings: AppSettings
): Promise<void> {
  await q.query(
    `INSERT INTO user_settings (
      user_id, base_theme_id, paper, language, include_references, page_limit, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      base_theme_id = EXCLUDED.base_theme_id,
      paper = EXCLUDED.paper,
      language = EXCLUDED.language,
      include_references = EXCLUDED.include_references,
      page_limit = EXCLUDED.page_limit,
      updated_at = NOW()`,
    [
      userId,
      settings.baseThemeId,
      settings.paper,
      settings.language || null,
      Boolean(settings.includeReferences),
      settings.pageLimit,
    ]
  );
}

export async function saveUserSettings(userId: string, settings: AppSettings): Promise<void> {
  await ensureDbInitialized();
  await saveUserSettingsWithQueryable(getPool(), userId, settings);
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

export async function saveTailoredDraft(
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
): Promise<string> {
  const id = `td_${crypto.randomBytes(8).toString("hex")}`;
  await query(
    `INSERT INTO tailored_drafts (
      id, user_id, title, company, job_text, match_score, status, notes, units_json, analysis_json, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, NOW(), NOW())`,
    [
      id,
      userId,
      stripNullBytes(draft.title),
      stripNullBytes(draft.company),
      stripNullBytes(draft.job_text),
      Math.round(Number(draft.match_score || 0)),
      draft.status || "generated",
      stripNullBytes(draft.notes || ""),
      toJsonParam(draft.units || []),
      toJsonParam(draft.analysis || {}),
    ]
  );
  return id;
}

export async function getUserTailoredDrafts(userId: string): Promise<TailoredDraftRecord[]> {
  const res = await query(
    `SELECT * FROM tailored_drafts
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return res.rows.map(mapTailoredDraftRow);
}

export async function getTailoredDraftById(
  userId: string,
  draftId: string
): Promise<TailoredDraftRecord | null> {
  const res = await query(
    `SELECT * FROM tailored_drafts
     WHERE id = $1 AND user_id = $2`,
    [draftId, userId]
  );
  return res.rows[0] ? mapTailoredDraftRow(res.rows[0]) : null;
}

export async function updateTailoredDraft(
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
): Promise<boolean> {
  return withTransaction(async (client) => {
    const existingRes = await client.query(
      `SELECT * FROM tailored_drafts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [draftId, userId]
    );
    const existingRow = existingRes.rows[0];
    if (!existingRow) return false;

    const existing = mapTailoredDraftRow(existingRow);
    const nextStatus = updates.status !== undefined ? updates.status : existing.status;
    const nextNotes = updates.notes !== undefined ? stripNullBytes(updates.notes) : existing.notes;
    const nextTitle = updates.title !== undefined ? stripNullBytes(updates.title) : existing.title;
    const nextCompany =
      updates.company !== undefined ? stripNullBytes(updates.company) : existing.company;
    const nextAnalysis =
      updates.analysis !== undefined ? updates.analysis : existing.analysis || {};
    const nextMatchScore =
      updates.match_score !== undefined
        ? Math.round(Number(updates.match_score))
        : existing.match_score;

    const updateRes = await client.query(
      `UPDATE tailored_drafts
       SET status = $1, notes = $2, title = $3, company = $4, analysis_json = $5::jsonb, match_score = $6, updated_at = NOW()
       WHERE id = $7 AND user_id = $8`,
      [
        nextStatus,
        nextNotes,
        nextTitle,
        nextCompany,
        toJsonParam(nextAnalysis),
        nextMatchScore,
        draftId,
        userId,
      ]
    );
    return (updateRes.rowCount ?? 0) > 0;
  });
}

export async function deleteTailoredDraft(userId: string, draftId: string): Promise<boolean> {
  const res = await query("DELETE FROM tailored_drafts WHERE id = $1 AND user_id = $2", [
    draftId,
    userId,
  ]);
  return (res.rowCount ?? 0) > 0;
}

// ─── Root Admin Account Initialization ───────────────────────────────────────
export function getRootAdminCredentials(): { username: string; passwordHash: string } {
  const username = (
    process.env.ROOT_ADMIN_USERNAME ||
    process.env.ROOT_USERNAME ||
    "admin@resumepipeline.com"
  )
    .toLowerCase()
    .trim();

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

async function ensureAdminUserWithClient(client: Queryable): Promise<UserRecord> {
  const { username, passwordHash } = getRootAdminCredentials();

  const existingRes = await client.query(
    `SELECT * FROM users
     WHERE id = 'usr_root' OR LOWER(email) = LOWER($1)
     ORDER BY CASE WHEN id = 'usr_root' THEN 0 ELSE 1 END
     LIMIT 1`,
    [username]
  );

  let rootRow = existingRes.rows[0];

  if (rootRow) {
    const nextHash = passwordHash || rootRow.password_hash;
    const updateRes = await client.query(
      `UPDATE users
       SET email = $1, password_hash = $2, role = 'admin', name = 'Root Administrator', is_disabled = FALSE, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [username, nextHash, rootRow.id]
    );
    rootRow = updateRes.rows[0];
  } else {
    const initialHash = passwordHash || hashPassword(crypto.randomBytes(24).toString("hex"));
    const insertRes = await client.query(
      `INSERT INTO users (id, email, password_hash, name, role, is_disabled, created_at, updated_at)
       VALUES ('usr_root', $1, $2, 'Root Administrator', 'admin', FALSE, NOW(), NOW())
       RETURNING *`,
      [username, initialHash]
    );
    rootRow = insertRes.rows[0];

    await saveUserProfileWithQueryable(
      client,
      "usr_root",
      createEmptyProfile("Root Administrator", username)
    );
    await saveUserSettingsWithQueryable(client, "usr_root", {
      baseThemeId: "editorial",
      paper: "LETTER",
      includeReferences: false,
      pageLimit: "none",
      language: null,
    });
  }

  // System rule: There is only ONE root admin user; demote any other accidental admins
  await client.query("UPDATE users SET role = 'user' WHERE role = 'admin' AND id != $1", [
    rootRow.id,
  ]);

  return mapUserRow(rootRow);
}

export async function ensureAdminUser(): Promise<UserRecord> {
  return withTransaction((client) => ensureAdminUserWithClient(client));
}
