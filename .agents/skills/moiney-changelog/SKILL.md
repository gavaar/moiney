---
name: moiney-changelog
description: Draft user-facing Moiney changelog entries from Git changes.
disable-model-invocation: true
---

# Moiney Changelog

## 1. Establish Scope

Use the user's supplied commit range, release, branch comparison, or worktree
scope. For a base branch, compare its merge base with `HEAD`. With no supplied
scope, default to `main...HEAD`: changes on the current branch since its merge
base with local `main`. If `main` is unavailable, ask for a baseline. State the
resolved comparison before drafting.

Keep uncommitted changes outside a release comparison unless explicitly
requested. For worktree scope, inspect staged, unstaged, and untracked files.
Read existing release notes, if present, to preserve their language and format.
Treat a version in `package.json` as a version label, not proof of a release.

## 2. Establish Evidence

Read the commit history, changed-file list, and relevant diffs for the resolved
scope. Trace each candidate entry to an observable change; commit subjects alone
are insufficient evidence. Consult the domain guides linked from `AGENTS.md`
when behavior or terminology is unclear.

Account for every changed area as either a changelog entry or an intentional
omission. Combine commits that deliver one outcome, and resolve reverts against
the net diff. Omit internal refactors, test-only work, documentation, and tooling
unless they change the intended audience's experience or require action.

## 3. Write The Changelog

Lead with what users can now do or what problem is fixed. Use concise, concrete
bullets grouped under nonempty headings such as **Added**, **Improved**,
**Fixed**, and **Breaking changes**. Follow an existing release-note format when
one exists. Use Moiney's established product vocabulary rather than internal
file names or implementation details.

After the main entries, put relevant user-facing technical changes in a
collapsed section using this Markdown/HTML structure:

```markdown
<details>
<summary>Tech changes</summary>

- [Technical change and its user-facing relevance.]

</details>
```

Include meaningful stack upgrades and library replacements here, explaining
their relevance to performance, reliability, compatibility, or supported
platforms. Name libraries and verified versions where useful; describe an
upgrade as "latest" only after verifying that claim. A replacement alone does
not prove a performance gain: distinguish its intended benefit from a measured
result. Keep unrelated developer-only changes omitted, avoid repeating the
main bullets, and omit the collapsible section when no relevant changes exist.

Include required user actions and compatibility limits only when supported by
the diff or an accepted domain contract. Describe performance improvements
without invented measurements. Treat rollout-dependent changes as conditional;
Git history alone does not establish deployment or availability. Keep security
notes free of credentials, personal data, and exploit instructions.

Use a supplied release label, or **Unreleased** when none is established. Include
a release date only when provided or verified. If no user-facing changes remain,
say so instead of manufacturing entries.

## 4. Deliver

Return the copy-ready Markdown, followed by a short scope/evidence note outside
the changelog. Put uncertainties there rather than presenting them as released
features; ask for clarification when uncertainty would change a material claim.

Default to a draft in the response. Edit a changelog file only when the user asks
for a file update; preserve existing entries and avoid duplicates. Version bumps,
commits, tags, deployments, and publishing require separate authorization.
