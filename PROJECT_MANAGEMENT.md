# Project Management

How work gets tracked on this repo.

## TL;DR

I (Chris) don't open the GitHub web UI for issues. I talk to Claude Code; Claude
files, lists, triages, and closes GitHub issues on my behalf using `gh`.

## Workflow

- **New idea** — describe it to Claude. Claude drafts a title + 2-3 sentence body,
  shows it for confirmation, then files it via `gh issue create`.
- **Status check** — "what's open?" → Claude runs `gh issue list` and summarizes.
- **Picking work** — Claude pulls from `now`, opens a branch, links the PR with
  `Closes #N` so the issue closes on merge.
- **Triage** — periodically ask Claude to surface stale `idea`s; re-label or
  close.

## Labels

| Group | Labels |
|---|---|
| Type | `bug`, `enhancement`, `idea`, `chore` |
| Area | `fetch`, `gallery`, `ci` |
| Status | `now`, `next`, `later` |

GitHub's default labels (`documentation`, `duplicate`, `good first issue`,
`help wanted`, `invalid`, `question`, `wontfix`) are left in place but not
actively used.

## Conventions

- **Confirm before filing.** Claude shows the draft, I approve, then it files.
- **No milestones.** `now / next / later` is enough for a solo project.
- **Issues close via PRs** with `Closes #N` in the PR body.
- **One area label per issue** when possible. Type and status labels are
  required.
