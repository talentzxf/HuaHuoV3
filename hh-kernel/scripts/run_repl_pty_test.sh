#!/usr/bin/env bash
set -euo pipefail

# Build first
cargo build -p kernel-cli

# Run the PTY-based test
python3 ./scripts/repl_pty_test.py

echo "REPL PTY test finished with exit code $?"