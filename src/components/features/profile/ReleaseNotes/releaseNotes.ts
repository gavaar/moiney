const repositoryApi = "https://api.github.com/repos/gavaar/moiney";
const sessionNotes = new Map<string, string>();

async function github(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${repositoryApi}/${path}`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal,
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub request failed (${response.status})`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("Invalid release notes response");
  return value.trim() ? value : null;
}

async function fetchReleaseNotes(version: string): Promise<string | null> {
  const tag = encodeURIComponent(version);
  const release = await github(`releases/tags/${tag}`);
  if (release !== null) {
    if (typeof release !== "object" || !("body" in release)) throw new Error("Invalid release response");
    const body = text(release.body);
    if (body) return body;
  }
  // GitHub displays the tagged commit's message when the release has no body.
  const commit = await github(`commits/${tag}`);
  if (commit === null) return null;
  if (typeof commit !== "object" || !("commit" in commit) ||
      typeof commit.commit !== "object" || commit.commit === null || !("message" in commit.commit)) {
    throw new Error("Invalid commit response");
  }
  return text(commit.commit.message);
}

export async function loadReleaseNotes(version: string): Promise<string | null> {
  const cached = sessionNotes.get(version);
  if (cached !== undefined) return cached;
  const notes = await fetchReleaseNotes(version);
  if (notes !== null) sessionNotes.set(version, notes);
  return notes;
}
