#!/usr/bin/env bash
set -euo pipefail

# Count lines of Rust code in the repository.
# Excludes common build and metadata dirs (.git, target, .claude)

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$repo_root"

# Find .rs files excluding some dirs
IFS=$'\n' read -r -d '' -a files < <(find . -type f -name '*.rs' \
    -not -path './target/*' \
    -not -path './.git/*' \
    -not -path './.claude/*' \
    -not -path './.venv/*' \
    -not -path './node_modules/*' -print0 && printf '\0')

if [ ${#files[@]} -eq 0 ]; then
  echo "No .rs files found."
  exit 0
fi

total=0
for f in "${files[@]}"; do
  # wc -l is robust; guard against weird file names
  lines=$(wc -l < "$f" || echo 0)
  total=$((total + lines))
done

printf "Found %d Rust source files\n" "${#files[@]}"
printf "Total lines of Rust code: %d\n" "$total"

# Optional: show per-crate breakdown (top-level directories with most lines)
printf "\nTop directories by Rust-line count:\n"
for dir in $(dirname "${files[@]}" | sort | uniq); do
  # sum lines for files in this dir
  dir_lines=0
  for f in "${files[@]}"; do
    case "$f" in
      "$dir"/*)
        l=$(wc -l < "$f" || echo 0)
        dir_lines=$((dir_lines + l))
        ;;
    esac
  done
  printf "%8d  %s\n" "$dir_lines" "$dir"
done | sort -rn | head -n 10
