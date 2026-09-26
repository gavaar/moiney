#!/usr/bin/env bash
set -euo pipefail

git fetch origin \
  +refs/heads/main:refs/remotes/origin/main \
  +refs/heads/test:refs/remotes/origin/test

if [[ "$(git rev-parse refs/remotes/origin/test)" != "$GITHUB_SHA" ]]; then
  echo "test has moved since this build; not promoting an older release" >&2
  exit 1
fi

if ! git merge-base --is-ancestor refs/remotes/origin/main "$GITHUB_SHA"; then
  echo "main is not an ancestor of the released test commit; refusing to rewrite history" >&2
  exit 1
fi

# The server rejects the non-force push if main advances incompatibly after the fetch.
git push origin "$GITHUB_SHA:refs/heads/main"
