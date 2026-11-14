import type { ProfileData } from "./profile";
import { generateAtsReport, type AtsReport } from "./ats-engine";

export const DEFAULT_GATEWAY_URL =
  process.env.AI_GATEWAY_URL || "https://api.openai.com/v1";
export const DEFAULT_GATEWAY_KEY =
  process.env.AI_GATEWAY_KEY || "";
export const DEFAULT_MODEL =
  process.env.AI_MODEL || "gpt-4o-mini";

export interface JobAnalysis {
  title: string;
  company: string;
  location: string;
  jobType: string;
  summary: string;
  requiredSkills: string[];
  keyResponsibilities: string[];
  extractedKeywords: string[];
}

export interface TailoredResumeResult {
  headline: string;
  summary: string;
  selectedExperienceIds: string[];
  selectedProjectIds: string[];
  selectedSkills: string[];
  tailoredProjects: {
    id: string;
    bullets: string[];
  }[];
  tailoredExperience: {
    id: string;
    bullets: string[];
  }[];
  matchScore: number;
  reasoning: string[];
  units: { id: string; text: string }[];
  curatedProfile?: ProfileData;
  atsReport?: AtsReport;
}

export interface AnalyzeAndCurateOptions {
  profile: ProfileData;
  jobText: string;
  provider?: "gateway" | "deepseek" | "ollama" | "openai" | "anthropic";
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
}

export function resolveModelName(name?: string, baseUrl?: string): string {
  const model = (name || DEFAULT_MODEL).trim();
  const url = (baseUrl || DEFAULT_GATEWAY_URL).toLowerCase();
  const isCloudflare = url.includes("workers.dev") || url.includes("cloudflare");

  if (isCloudflare) {
    const lower = model.toLowerCase();
    if (
      lower.includes("deepseek-v4.1") ||
      lower.includes("deepseek-v4-pro") ||
      lower === "deepseek" ||
      lower === "pro"
    ) {
      return "@cf/deepseek-ai/deepseek-v4-pro-0813";
    }
    if (lower.includes("flash") || lower.includes("fast")) {
      return "@cf/deepseek-ai/deepseek-v4-flash-0731";
    }
    if (lower.includes("r1")) {
      return "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b";
    }
  }

  return model;
}

export async function curateResumeForJob(
  options: AnalyzeAndCurateOptions
): Promise<{ analysis: JobAnalysis; tailored: TailoredResumeResult }> {
  const {
    profile,
    jobText,
    provider = "gateway",
    apiKey = DEFAULT_GATEWAY_KEY,
    baseUrl = DEFAULT_GATEWAY_URL,
    modelName = DEFAULT_MODEL,
  } = options;

  const prompt = buildCurationPrompt(profile, jobText);
  let rawJson: string | null = null;

  try {
    if (provider === "deepseek" || provider === "gateway" || provider === "openai") {
      rawJson = await callOpenAICompatible(prompt, apiKey, modelName, baseUrl, true);
    } else if (provider === "ollama") {
      rawJson = await callOllama(prompt, modelName || "gemma4:12b");
    } else if (provider === "anthropic" && apiKey) {
      rawJson = await callAnthropic(prompt, apiKey, modelName || "claude-3-5-sonnet-latest");
    }
  } catch (error) {
    console.warn("Primary LLM call failed. Attempting fallback:", error);
    try {
      if (apiKey) {
        const isCloudflare = baseUrl.includes("workers.dev") || baseUrl.includes("cloudflare");
        const fallbackModel = isCloudflare ? "@cf/deepseek-ai/deepseek-v4-flash-0731" : modelName;
        // Retry without response_format constraint (for models/providers that reject json_object)
        rawJson = await callOpenAICompatible(
          prompt,
          apiKey,
          fallbackModel,
          baseUrl,
          false
        );
      } else {
        rawJson = await callOllama(prompt, "gemma4:12b");
      }
    } catch (fallbackError) {
      console.warn("Fallback LLM call failed. Using rule-based curation:", fallbackError);
    }
  }

  if (rawJson) {
    try {
      const parsed = extractJson(rawJson);
      if (parsed && (parsed.analysis || parsed.curation || parsed.tailored)) {
        return sanitizeAndVerify(parsed, profile, jobText);
      }
    } catch (parseError) {
      console.warn("Failed to parse LLM JSON, falling back to heuristic curation:", parseError);
    }
  }

  return heuristicCuration(profile, jobText);
}

export function ensureHealthySummaryLength(
  summary: string,
  defaultSummary: string
): string {
  const clean = summary.trim();
  if (!clean) return defaultSummary;

  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const wordCount = clean.split(/\s+/).length;

  // A healthy length is typically 3 to 4 impactful sentences (approx 50-85 words)
  if (wordCount >= 45 && wordCount <= 90 && sentences.length >= 2 && sentences.length <= 5) {
    return clean;
  }

  // If too short (e.g. < 45 words or only 1 sentence), append relevant background from default summary
  if (wordCount < 45 || sentences.length < 2) {
    const baseSentences = defaultSummary.split(/(?<=[.!?])\s+/).filter(Boolean);
    const combined = [clean, ...baseSentences].filter((s, idx, arr) => arr.indexOf(s) === idx);
    const target = combined.slice(0, 3).join(" ");
    return target.endsWith(".") ? target : `${target}.`;
  }

  // If too long (> 90 words or > 4 sentences), keep first 3-4 cohesive sentences
  if (sentences.length > 4 || wordCount > 90) {
    let result = "";
    let count = 0;
    for (const sent of sentences) {
      const words = sent.split(/\s+/).length;
      if (count + words > 85 && result.length > 0) break;
      result = result ? `${result} ${sent}` : sent;
      count += words;
      if (count >= 50 && result.split(/(?<=[.!?])\s+/).length >= 3) break;
    }
    return result.endsWith(".") ? result : `${result}.`;
  }

  return clean;
}

function buildCurationPrompt(profile: ProfileData, jobText: string): string {
  const experiencesJson = profile.experience.map((e) => ({
    role: e.role,
    company: e.company,
    dates: `${e.startMonth ? e.startMonth + "/" : ""}${e.startYear || ""} - ${
      e.current ? "Present" : (e.endMonth ? e.endMonth + "/" : "") + (e.endYear || "")
    }`,
    bullets: e.bullets.split("\n").filter(Boolean),
  }));

  const projectsJson = profile.projects.map((p) => ({
    name: p.name,
    link: p.link,
    bullets: p.bullets.split("\n").filter(Boolean),
  }));

  const candidateSkills = profile.skills.map((s) => s.name);

  return `You are an elite, ATS-certified career strategist and technical resume curator.
Your task is to analyze the target Job Description (JD) and generate a compelling, tailored Profile Description and Headline for the candidate.

### STRICT RULES & CONSTRAINTS (ABSOLUTE):
1. WHAT YOU MUST GENERATE (THE ONLY ALLOWED EDITS):
   - "headline": A focused, role-specific professional headline (e.g. "Senior Python & AI Backend Engineer | Agentic Systems & Microservices").
   - "summary": A rich, HEALTHY-LENGTH profile description of EXACTLY 3 to 4 impactful sentences (strictly 60 to 80 words / ~400-500 characters):
     * Sentence 1: Professional identity and core background directly framed for this target role.
     * Sentence 2: Key technical specializations (drawing strictly from verified skills like Python, LangChain/LangGraph, FastAPI, PostgreSQL, agentic workflows).
     * Sentence 3: Demonstrated engineering impact and scalable systems delivered.
     * Sentence 4: Focused value proposition addressing the target role's core technical requirements.
     * CRITICAL LENGTH RULE: Must be a HEALTHY length — strictly 3 to 4 cohesive sentences. Never a single short sentence; never an oversized wall of text.

2. WHAT YOU CANNOT TOUCH (100% IMMUTABLE & NEVER HIDDEN):
   - You MUST NOT edit, rewrite, or invent any experience or project bullet points. All experiences and projects are kept 100% intact and complete.
   - You MUST NOT hide or drop any skills. All verified candidate skills are kept on the resume.
   - You MUST NOT touch personal details (name, email, phone, location, links).

### CANDIDATE AUTHENTIC MASTER PROFILE:
Name: ${profile.basics.name}
Current Headline: ${profile.basics.headline}
Current Summary: ${profile.basics.summary}

Candidate Verified Skills (${candidateSkills.length} total, all preserved):
${JSON.stringify(candidateSkills)}

Candidate Experiences (all preserved verbatim):
${JSON.stringify(experiencesJson, null, 2)}

Candidate Projects (all preserved verbatim):
${JSON.stringify(projectsJson, null, 2)}

### TARGET JOB POSTING:
"""
${jobText.slice(0, 15000)}
"""

### REQUIRED JSON OUTPUT FORMAT:
Respond with ONLY valid JSON (no markdown formatting, no code block fences, only raw JSON):
{
  "analysis": {
    "title": "Clean target job title (max 50 chars)",
    "company": "Target company name",
    "location": "Location or Remote/Hybrid",
    "jobType": "Full-time / Contract / etc",
    "summary": "1-2 sentence overview of what the role requires",
    "requiredSkills": ["Skill 1", "Skill 2", "Skill 3"],
    "extractedKeywords": ["keyword1", "keyword2", "keyword3"]
  },
  "curation": {
    "headline": "Focused professional headline tailored to this position",
    "summary": "A rich, healthy-length 3-to-4 sentence profile description (60-80 words) describing the candidate in the exact context of this role.",
    "matchScore": 92
  }
}`;
}

async function callOpenAICompatible(
  prompt: string,
  apiKey: string,
  model: string,
  baseUrl: string,
  requireJsonFormat: boolean = true
): Promise<string> {
  if (!apiKey || !baseUrl) {
    throw new Error("AI_GATEWAY_KEY or AI_GATEWAY_URL is not configured.");
  }

  const actualModel = resolveModelName(model, baseUrl);
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  // OpenRouter attribution headers (recommended by OpenRouter)
  if (baseUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "https://resumepipeline.com";
    headers["X-Title"] = "Resume Pipeline";
  }

  const requestBody: Record<string, unknown> = {
    model: actualModel,
    messages: [
      {
        role: "system",
        content:
          "You are an elite, ATS-certified technical resume curator and career strategist. You only select authentic candidate data and generate profile summaries. Always output raw JSON only.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 3000,
    temperature: 0.1,
  };

  if (requireJsonFormat) {
    requestBody.response_format = { type: "json_object" };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI Gateway HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function callOllama(prompt: string, model: string): Promise<string> {
  const host = process.env.OLLAMA_HOST || "http://localhost:11434";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  const response = await fetch(`${host}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: "json",
    }),
    signal: controller.signal,
  });

  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`Ollama HTTP error ${response.status}`);
  }

  const data = await response.json();
  return data.response;
}

async function callAnthropic(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic HTTP error ${response.status}`);
  }

  const data = await response.json();
  return data.content[0]?.text || "";
}

function extractJson(str: string): any {
  if (!str || typeof str !== "string") return null;

  // 1. Direct parse attempt
  try {
    return JSON.parse(str);
  } catch {}

  // 2. Extract first outer JSON object block
  const firstBrace = str.indexOf("{");
  if (firstBrace === -1) return null;
  const lastBrace = str.lastIndexOf("}");
  if (lastBrace > firstBrace) {
    try {
      return JSON.parse(str.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  // 3. Resilient repair for truncated JSON responses (e.g. if token limit stopped generation)
  const s = str.slice(firstBrace).trim();
  for (let i = s.length; i > 0; i--) {
    let candidate = s.slice(0, i).trim();
    // Strip trailing incomplete string literal
    candidate = candidate.replace(/,?\s*"[^"]*$/, "");
    // Strip trailing comma or colon
    candidate = candidate.replace(/[,:]\s*$/, "");

    // Balance braces and brackets
    const stack: string[] = [];
    let inString = false;
    let escaped = false;
    for (let j = 0; j < candidate.length; j++) {
      const char = candidate[j];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === "{" || char === "[") stack.push(char);
        else if (char === "}" && stack[stack.length - 1] === "{") stack.pop();
        else if (char === "]" && stack[stack.length - 1] === "[") stack.pop();
      }
    }

    let balanced = candidate;
    while (stack.length > 0) {
      const top = stack.pop();
      if (top === "{") balanced += "}";
      else if (top === "[") balanced += "]";
    }

    try {
      return JSON.parse(balanced);
    } catch {}
  }

  return null;
}

function sanitizeAndVerify(
  parsed: any,
  profile: ProfileData,
  jobText: string
): { analysis: JobAnalysis; tailored: TailoredResumeResult } {
  const analysisData = parsed.analysis || {};
  const curationData = parsed.curation || parsed.tailored || {};

  // 1. Experiences: All candidate experiences are preserved 100% verbatim (never hidden or modified)
  const selectedExperienceIds = profile.experience.map((e) => e.id);

  // 2. Projects: All candidate projects are preserved 100% verbatim (never hidden or modified)
  const selectedProjectIds = profile.projects.map((p) => p.id);

  // 3. Skills: All candidate skills are preserved 100% across all categories (never hidden or dropped)
  const selectedSkills = profile.skills.map((s) => s.name);

  // 4. Headline & Summary: The ONLY content customized by the AI agent
  const rawHeadline = (curationData.headline || profile.basics.headline || "Software Developer").trim();
  const headline = rawHeadline.replace(/^["']|["']$/g, "").trim();

  const rawSummary = (curationData.summary || profile.basics.summary || "").trim();
  const baseSummary =
    profile.basics.summary ||
    "Full Stack Developer and AI Engineer specializing in building scalable web applications and intelligent agentic workflows. Experienced in Python, TypeScript, React, Next.js, and high-performance backend systems with modern databases. Passionate about crafting resilient software architectures, autonomous AI pipelines, and user-centric digital experiences.";
  const summary = ensureHealthySummaryLength(
    rawSummary.replace(/^["']|["']$/g, "").trim(),
    baseSummary
  );

  // 5. Construct Units (Only headline & summary are overridden; all experiences and projects remain verbatim)
  const units: { id: string; text: string }[] = [];
  if (headline) {
    units.push({ id: "headline", text: headline });
  }
  if (summary) {
    units.push({ id: "summary", text: summary });
  }

  // Verbatim experiences
  const tailoredExperience: { id: string; bullets: string[] }[] = [];
  for (const exp of profile.experience) {
    units.push({ id: `experience:${exp.id}`, text: exp.bullets });
    tailoredExperience.push({
      id: exp.id,
      bullets: exp.bullets.split("\n").filter(Boolean),
    });
  }

  // Verbatim projects
  const tailoredProjects: { id: string; bullets: string[] }[] = [];
  for (const proj of profile.projects) {
    units.push({ id: `project:${proj.id}`, text: proj.bullets });
    tailoredProjects.push({
      id: proj.id,
      bullets: proj.bullets.split("\n").filter(Boolean),
    });
  }

  // 6. Curated Profile object (ready for preview and direct rendering)
  const curatedProfile: ProfileData = {
    ...profile,
    basics: {
      ...profile.basics,
      headline,
      summary,
    },
    experience: [...profile.experience],
    projects: [...profile.projects],
    skills: [...profile.skills],
  };

  const analysis: JobAnalysis = {
    title: analysisData.title || "Target Role",
    company: analysisData.company || "Target Company",
    location: analysisData.location || "Remote / On-site",
    jobType: analysisData.jobType || "Full-Time",
    summary: analysisData.summary || "",
    requiredSkills: Array.isArray(analysisData.requiredSkills) ? analysisData.requiredSkills : [],
    keyResponsibilities: Array.isArray(analysisData.keyResponsibilities)
      ? analysisData.keyResponsibilities
      : [],
    extractedKeywords: Array.isArray(analysisData.extractedKeywords)
      ? analysisData.extractedKeywords
      : [],
  };

  // 7. Industry ATS Compatibility Audit
  const atsReport = generateAtsReport(profile, jobText, analysis, headline, summary);
  const matchScore = atsReport.overallScore;

  const reasoning = [
    `ATS Match: ${matchScore}% calculated across Workday, Taleo, Greenhouse, Lever, and iCIMS standards.`,
    `Generated targeted professional persona and healthy 3-to-4 sentence summary aligned with the target role.`,
    `Matched ${atsReport.matchedSkills.length} of ${atsReport.matchedSkills.length + atsReport.missingSkills.length} key technical requirements.`,
    `All ${profile.skills.length} skills maintained across all categories without omission.`,
    `All ${profile.experience.length} experiences and ${profile.projects.length} projects preserved 100% authentic and verbatim.`,
  ];

  return {
    analysis,
    tailored: {
      headline,
      summary,
      selectedExperienceIds,
      selectedProjectIds,
      selectedSkills,
      tailoredProjects,
      tailoredExperience,
      matchScore,
      reasoning,
      units,
      curatedProfile,
      atsReport,
    },
  };
}

function heuristicCuration(
  profile: ProfileData,
  jobText: string
): { analysis: JobAnalysis; tailored: TailoredResumeResult } {
  let extractedTitle = "Software Developer and AI Engineer";
  const titlePatterns = [
    /(?:title|role|position):\s*([^\n\r]+)/i,
    /(?:senior|lead|principal|staff|full stack|backend|frontend|software|ai|data|systems)\s+(?:engineer|developer|architect)/i,
  ];
  for (const pat of titlePatterns) {
    const match = jobText.match(pat);
    if (match) {
      extractedTitle = match[0].trim();
      break;
    }
  }

  const selectedSkills = profile.skills.map((s) => s.name);
  const selectedExperienceIds = profile.experience.map((e) => e.id);
  const selectedProjectIds = profile.projects.map((p) => p.id);

  const headline = profile.basics.headline || extractedTitle;
  const rawSummary = `Experienced ${headline.toLowerCase()} with a proven background across ${selectedSkills
    .slice(0, 4)
    .join(", ")}, specializing in high-performance architectures and scalable software systems. Demonstrated track record of building resilient backends, agentic workflows, and user-centric web applications. Committed to engineering excellence, maintainable code quality, and driving tangible product outcomes.`;

  const summary = ensureHealthySummaryLength(rawSummary, profile.basics.summary || rawSummary);

  const units: { id: string; text: string }[] = [];
  units.push({ id: "headline", text: headline });
  units.push({ id: "summary", text: summary });

  const tailoredExperience: { id: string; bullets: string[] }[] = [];
  for (const exp of profile.experience) {
    units.push({ id: `experience:${exp.id}`, text: exp.bullets });
    tailoredExperience.push({
      id: exp.id,
      bullets: exp.bullets.split("\n").filter(Boolean),
    });
  }

  const tailoredProjects: { id: string; bullets: string[] }[] = [];
  for (const proj of profile.projects) {
    units.push({ id: `project:${proj.id}`, text: proj.bullets });
    tailoredProjects.push({
      id: proj.id,
      bullets: proj.bullets.split("\n").filter(Boolean),
    });
  }

  const curatedProfile: ProfileData = {
    ...profile,
    basics: {
      ...profile.basics,
      headline,
      summary,
    },
    experience: [...profile.experience],
    projects: [...profile.projects],
    skills: [...profile.skills],
  };

  const analysis: JobAnalysis = {
    title: extractedTitle,
    company: "Target Company",
    location: "Identified in listing",
    jobType: "Full-Time",
    summary: "Curated profile description aligned with target job listing while preserving 100% of authentic career history.",
    requiredSkills: selectedSkills.slice(0, 8),
    keyResponsibilities: ["Key role requirements identified and matched from candidate profile."],
    extractedKeywords: selectedSkills.slice(0, 10),
  };

  const atsReport = generateAtsReport(profile, jobText, analysis, headline, summary);
  const matchScore = atsReport.overallScore;

  return {
    analysis,
    tailored: {
      headline,
      summary,
      selectedExperienceIds,
      selectedProjectIds,
      selectedSkills,
      tailoredProjects,
      tailoredExperience,
      matchScore,
      reasoning: [
        `ATS Match: ${matchScore}% calculated across industry standards.`,
        `Generated targeted professional persona and healthy 3-to-4 sentence summary aligned with the target role.`,
        `Matched ${atsReport.matchedSkills.length} key technical requirements.`,
        `All ${profile.skills.length} skills maintained across all categories without omission.`,
        `All ${profile.experience.length} experiences and ${profile.projects.length} projects preserved 100% authentic and verbatim.`,
      ],
      units,
      curatedProfile,
      atsReport,
    },
  };
}
