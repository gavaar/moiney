const RELEASES_URL = "https://api.github.com/repos/gavaar/moiney/releases?per_page=10";

export type LatestMoineyRelease = {
  name: string;
  url: string;
};

type GitHubRelease = {
  name?: unknown;
  html_url?: unknown;
  published_at?: unknown;
  draft?: unknown;
};

let latestReleasePromise: Promise<LatestMoineyRelease | null> | null = null;

function isGitHubRelease(value: unknown): value is GitHubRelease {
  return typeof value === "object" && value !== null;
}

function selectLatestRelease(value: unknown): LatestMoineyRelease | null {
  if (!Array.isArray(value)) return null;

  const releases = value
    .filter(isGitHubRelease)
    .filter(
      (release) =>
        release.draft !== true &&
        typeof release.name === "string" &&
        release.name.length > 0 &&
        typeof release.html_url === "string" &&
        release.html_url.length > 0 &&
        typeof release.published_at === "string" &&
        Number.isFinite(Date.parse(release.published_at)),
    )
    .sort(
      (left, right) =>
        Date.parse(right.published_at as string) - Date.parse(left.published_at as string),
    );

  const release = releases[0];
  if (!release) return null;

  return {
    name: release.name as string,
    url: release.html_url as string,
  };
}

async function requestLatestRelease(): Promise<LatestMoineyRelease | null> {
  try {
    const response = await fetch(RELEASES_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) return null;
    return selectLatestRelease(await response.json());
  } catch {
    return null;
  }
}

export function getLatestMoineyRelease(): Promise<LatestMoineyRelease | null> {
  latestReleasePromise ??= requestLatestRelease();
  return latestReleasePromise;
}
