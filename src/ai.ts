import Groq from "groq-sdk";
import { getApiKey } from "./config.js";

const MODEL = "llama-3.3-70b-versatile";

// truncate huge diffs so we don't blow the context window (or your groq quota)
const MAX_DIFF_LENGTH = 6000;

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "no GROQ_API_KEY found. run `hc config set GROQ_API_KEY=your_key_here` first.\n" +
        "get a free key at https://console.groq.com/keys"
    );
    this.name = "MissingApiKeyError";
  }
}

export interface GenerateOptions {
  honestMessage: string;
  diff: string;
  conventional: boolean;
  count: number;
}

const BASE_SYSTEM_PROMPT = `You are a git commit message generator. The user will give you their honest, casual description of what they did, plus the git diff of their staged changes for context. You will return ONLY a single professional git commit message, no explanation, no preamble, no quotes, just the message. Make it sound like a competent senior engineer wrote it.

Always prefix the message with a Conventional Commits type (feat:, fix:, chore:, refactor:, docs:, style:, test:, perf:, build:, ci:) based on what the diff actually shows, not just the user's wording. Use "feat" for new functionality, "fix" for bug fixes, "refactor" for restructuring without behavior change, "style" for formatting/visual-only changes, "chore" for maintenance/config, "docs" for documentation, "test" for tests.

Keep the whole message (including the prefix) under 72 characters. Use the imperative mood (e.g. "add", "fix", "redesign", not "added" or "fixes").`;

const CONVENTIONAL_STRICT_ADDENDUM = `\n\nFollow the Conventional Commits spec strictly, including an optional scope in parentheses when it adds clarity (e.g. fix(auth): ...).`;

function buildSystemPrompt(conventional: boolean): string {
  return conventional ? BASE_SYSTEM_PROMPT + CONVENTIONAL_STRICT_ADDENDUM : BASE_SYSTEM_PROMPT;
}

function buildUserPrompt(honestMessage: string, diff: string): string {
  const truncatedDiff =
    diff.length > MAX_DIFF_LENGTH
      ? diff.slice(0, MAX_DIFF_LENGTH) + "\n... (diff truncated, you get the idea)"
      : diff;

  let prompt = `Here's what I (honestly) did:\n"${honestMessage}"`;

  if (truncatedDiff.trim().length > 0) {
    prompt += `\n\nHere's the actual diff for context:\n\`\`\`diff\n${truncatedDiff}\n\`\`\``;
  } else {
    prompt += `\n\n(no staged diff available, just work off the description)`;
  }

  return prompt;
}

const CONVENTIONAL_TYPES = [
  "feat",
  "fix",
  "chore",
  "refactor",
  "docs",
  "style",
  "test",
  "perf",
  "build",
  "ci",
];

function cleanMessage(raw: string): string {
  // models love wrapping things in quotes even when you beg them not to
  let message = raw
    .trim()
    .replace(/^["'`]+/, "")
    .replace(/["'`]+$/, "")
    .split("\n")[0]
    .trim();

  // sometimes the model forgets the colon after the conventional commit type
  // (e.g. "refactor stylesheet" instead of "refactor: stylesheet")
  const typeMatch = message.match(/^(\w+)(\([^)]+\))?\s+(?!:)(.+)/);
  if (typeMatch && CONVENTIONAL_TYPES.includes(typeMatch[1].toLowerCase())) {
    const scope = typeMatch[2] ?? "";
    message = `${typeMatch[1]}${scope}: ${typeMatch[3]}`;
  }

  return message;
}

let client: Groq | null = null;

function getClient(): Groq {
  if (client) return client;

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new MissingApiKeyError();
  }

  client = new Groq({ apiKey });
  return client;
}

// the main event: turn "fixed the thing" into something that survives a PR review
export async function generateCommitMessages(options: GenerateOptions): Promise<string[]> {
  const { honestMessage, diff, conventional, count } = options;
  const groq = getClient();

  const systemPrompt = buildSystemPrompt(conventional);
  const userPrompt = buildUserPrompt(honestMessage, diff);

  // groq doesn't have a clean "give me N options" mode, so we just fire
  // N parallel requests with a bit of temperature for variety
  const requests = Array.from({ length: count }, () =>
    groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: count > 1 ? 0.9 : 0.7,
      max_tokens: 100,
    })
  );

  const responses = await Promise.all(requests);

  const messages = responses.map((res) => {
    const content = res.choices[0]?.message?.content ?? "";
    return cleanMessage(content);
  });

  // de-dupe in case the model gives us the same "creative" answer twice
  return Array.from(new Set(messages)).filter(Boolean);
}
