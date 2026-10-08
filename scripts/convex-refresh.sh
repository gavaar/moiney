#!/usr/bin/env bash
set -euo pipefail

# Run from the project root even when invoked directly from another directory.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

backup_dir=$(mktemp -d "${TMPDIR:-/tmp}/moiney-convex-refresh.XXXXXX")
trap 'rm -f "$backup_dir/production.zip"; rmdir "$backup_dir"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
backup="$backup_dir/production.zip"

echo "Exporting production data and uploaded files..."
bunx convex export --prod --include-file-storage --path "$backup"

echo "Replacing data in the currently selected deployment. Check the target in Convex's confirmation prompt."
# No --prod or --yes: use the current selection and retain overwrite confirmation.
bunx convex import --replace "$backup"
