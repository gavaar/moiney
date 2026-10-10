export function parseAppVersion(version: string): number[] | null {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) return null;
  const components = version.split(".").map(Number);
  return components.every(Number.isSafeInteger) ? components : null;
}

export function getUpdateKind(installed: string, latest: string): "none" | "optional" | "mandatory" {
  const current = parseAppVersion(installed);
  const next = parseAppVersion(latest);
  if (!current || !next) return "none";

  for (let index = 0; index < 3; index++) { // we check major, then minor, then patch
    if (next[index] < current[index]) return "none";
    if (next[index] > current[index]) return index === 2 ? "optional" : "mandatory";
  }
  return "none";
}
