#!/usr/bin/env bash
# Daily Dose of Claude Code — one-liner installer.
#
# Usage (from anywhere):
#   curl -fsSL https://raw.githubusercontent.com/<you>/daily-dose-of-claude-code/main/install.sh | bash
#
# Or, from a checked-out repo:
#   ./install.sh
#
# What it does:
#   1. Verifies Node.js ≥ 18 and git are available
#   2. Clones (or updates) the repo into ~/daily-dose-of-claude-code
#   3. Runs `npm install` and `npm run build:node`
#   4. Merges Claude Code hooks + MCP registration additively into ~/.claude/settings.json
#   5. Adds a managed section to ~/.claude/CLAUDE.md
#   6. Runs the doctor
#
# Nothing in ~/.claude is ever overwritten — existing files are backed up first.

set -euo pipefail

REPO_URL="${DAILY_DOSE_REPO_URL:-https://github.com/iamdevnitesh/daily-dose-of-claude-code.git}"
INSTALL_DIR="${DAILY_DOSE_INSTALL_DIR:-$HOME/daily-dose-of-claude-code}"

C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_RESET=$'\033[0m'

info()  { printf "%s\n" "${C_DIM}· $*${C_RESET}"; }
ok()    { printf "%s\n" "${C_GREEN}✓ $*${C_RESET}"; }
warn()  { printf "%s\n" "${C_YELLOW}! $*${C_RESET}"; }
fail()  { printf "%s\n" "${C_RED}✗ $*${C_RESET}" >&2; exit 1; }

echo ""
echo "${C_BOLD}🗞  Daily Dose of Claude Code — installer${C_RESET}"
echo ""

command -v git >/dev/null 2>&1 || fail "git is required"
command -v node >/dev/null 2>&1 || fail "Node.js ≥18 is required (https://nodejs.org)"

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "${NODE_MAJOR}" -lt 18 ]; then
  fail "Node.js ≥18 required (found $(node -v))"
fi
ok "Node.js $(node -v)"

if [ -d "${INSTALL_DIR}/.git" ]; then
  info "Updating existing checkout at ${INSTALL_DIR}"
  git -C "${INSTALL_DIR}" fetch --quiet origin
  git -C "${INSTALL_DIR}" pull --ff-only --quiet
elif [ -d "${INSTALL_DIR}" ] && [ -f "${INSTALL_DIR}/package.json" ]; then
  info "Using existing directory ${INSTALL_DIR}"
else
  info "Cloning ${REPO_URL} → ${INSTALL_DIR}"
  git clone --quiet "${REPO_URL}" "${INSTALL_DIR}"
fi
ok "Source at ${INSTALL_DIR}"

cd "${INSTALL_DIR}"

info "Installing npm dependencies…"
npm install --no-audit --no-fund --loglevel=error
ok "Dependencies installed"

info "Building hooks + MCP…"
npm run build:node --silent
ok "Build complete"

info "Wiring Claude Code hooks + MCP (additive merge, ~/.claude untouched files backed up)…"
node bin/daily-dose.mjs install
ok "Install complete"

info "Running doctor…"
node bin/daily-dose.mjs doctor || warn "Doctor reported issues — see above"

echo ""
echo "${C_BOLD}${C_YELLOW}⚠  IMPORTANT — restart Claude Code${C_RESET}"
echo "${C_YELLOW}   Hooks only apply to Claude Code sessions started AFTER install.${C_RESET}"
echo "${C_YELLOW}   Fully quit any running Claude Code sessions and start a new one.${C_RESET}"
echo ""
echo "${C_BOLD}Next steps${C_RESET}"
echo "  1. Quit + relaunch Claude Code (Cmd+Q, then reopen), submit any prompt"
echo "  2. Start the newspaper UI:   ${C_BOLD}cd ${INSTALL_DIR} && npm run dev${C_RESET}   (http://localhost:3000)"
echo "     Or with Docker (UI only): ${C_BOLD}cd ${INSTALL_DIR} && docker compose up -d${C_RESET}"
echo "  3. Not seeing activity?      ${C_BOLD}daily-dose diagnose${C_RESET}   (or ${C_BOLD}node ${INSTALL_DIR}/bin/daily-dose.mjs diagnose${C_RESET})"
echo ""
