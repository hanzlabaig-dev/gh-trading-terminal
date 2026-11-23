#!/usr/bin/env bash
# Renders terminal-dark.svg + terminal-light.svg. Used by action.yml; also handy locally.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="${INPUT_OUTPUT_DIR:-assets}"
args=(--user "${INPUT_USERNAME:?username is required}" --days "${INPUT_DAYS:-90}")
if [[ -n "${INPUT_SHOW:-}" ]]; then args+=(--show "$INPUT_SHOW"); fi
if [[ -n "${INPUT_EXTRA_ARGS:-}" ]]; then read -r -a extra <<< "$INPUT_EXTRA_ARGS"; args+=("${extra[@]}"); fi
node "$here/src/cli.js" "${args[@]}" --theme "${INPUT_THEME:-tradingview}" --out "$out/terminal-dark.svg"
node "$here/src/cli.js" "${args[@]}" --theme "${INPUT_LIGHT_THEME:-light}" --out "$out/terminal-light.svg"
