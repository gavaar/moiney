type ReleaseCheck = { repository: string; version: string; commit: string; token: string };

export async function isAppReleasePublished({ repository, version, commit, token }: ReleaseCheck): Promise<boolean> {
  const base = `https://api.github.com/repos/${repository}`;
  const options = { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } };

  const assertCurrentCommit = async () => {
    const response = await fetch(`${base}/commits/main`, options);
    if (!response.ok) throw new Error(`GitHub main commit lookup failed (${response.status})`);
    const main: { sha: string } = await response.json();
    if (main.sha !== commit) throw new Error("Obsolete workflow commit: only the current main commit may deploy the backend and build an APK.");
  };

  const releaseResponse = await fetch(`${base}/releases/tags/${encodeURIComponent(version)}`, options);
  if (releaseResponse.status === 404) {
    await assertCurrentCommit();
    return false;
  }
  if (!releaseResponse.ok) throw new Error(`GitHub release lookup failed (${releaseResponse.status})`);

  const release: { draft: boolean; assets: { name: string }[] } = await releaseResponse.json();
  const commitResponse = await fetch(`${base}/commits/${encodeURIComponent(version)}`, options);
  if (!commitResponse.ok) throw new Error(`GitHub release commit lookup failed (${commitResponse.status})`);

  const taggedCommit: { sha: string } = await commitResponse.json();
  if (taggedCommit.sha !== commit) throw new Error(`Version ${version} already belongs to another commit. Bump app.json before publishing a different APK.`);

  const published = !release.draft && release.assets.some((asset) => asset.name === "moiney.apk");
  if (!published) await assertCurrentCommit();
  return published;
}
