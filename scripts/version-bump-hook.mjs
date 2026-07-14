// scripts\version-bump-hook.mjs
// fallow-ignore-file unused-file -- invoked by the Claude Code Stop hook (.claude/settings.json), not imported from any entry point
// Stop hook: auto-bumps package.json's version when Claude finishes a turn that touched
// app/server/shared/i18n/nuxt.config.ts — so VersionBadge never shows a stale version.
// Runs once per Stop event, not per edit. Also usable manually:
//   node scripts/version-bump-hook.mjs [major|minor|patch]   (defaults to patch)
//
// Skips when:
//   - the working-tree version already differs from HEAD's (already bumped this turn,
//     whether by this hook or a manual bump — never double-bumps)
//   - none of the relevant paths have uncommitted changes (e.g. only docs/tests touched)
//
// The Stop hook itself always invokes this with no argument (patch) — deciding "is this
// a new feature" isn't something a hook can judge reliably. For a minor/major bump, run
// this manually beforehand (or edit package.json directly); the hook then sees the
// version already diverged from HEAD and no-ops.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = join(fileURLToPath(import.meta.url), '..', '..')
const pkgPath = join(rootDir, 'package.json')
const relevantPaths = ['app', 'server', 'shared', 'i18n', 'nuxt.config.ts']

const bumpType = process.argv[2] ?? 'patch'
if (!['major', 'minor', 'patch'].includes(bumpType)) {
  console.error(`Unknown bump type "${bumpType}" — expected major, minor, or patch.`)
  process.exit(1)
}

function git(args) {
  try {
    return execFileSync('git', args, { cwd: rootDir, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

if (!git(['rev-parse', '--is-inside-work-tree'])) process.exit(0)

const headPkgRaw = git(['show', 'HEAD:package.json'])
if (!headPkgRaw) process.exit(0)

let headVersion
try {
  headVersion = JSON.parse(headPkgRaw).version
} catch {
  process.exit(0)
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
if (pkg.version !== headVersion) process.exit(0)

const status = git(['status', '--porcelain', '--', ...relevantPaths])
if (!status) process.exit(0)

const [major, minor, patch] = headVersion.split('.').map(Number)
pkg.version = bumpType === 'major'
  ? `${major + 1}.0.0`
  : bumpType === 'minor'
    ? `${major}.${minor + 1}.0`
    : `${major}.${minor}.${patch + 1}`
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

console.log(JSON.stringify({
  systemMessage: `Auto-bumped package.json version: ${headVersion} -> ${pkg.version} (${bumpType})`,
}))
