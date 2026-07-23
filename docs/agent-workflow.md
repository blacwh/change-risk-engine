# Continuous AI agent work

This document defines how an AI agent turns roadmap or backlog work into small,
reviewable pull requests. It governs agent work in this repository; it does not
describe or modify GitHub Actions workflows.

## Run contract

A continuous run targets at most four hours of elapsed work, including
inspection, implementation, local verification, pull-request checks, merges,
default-branch synchronization, and the final handoff. Four hours is a ceiling,
not a target that must be consumed.

Use this default allocation:

| Elapsed time | Activity |
| --- | --- |
| 0:00–0:20 | Inspect the repository, confirm authorization, and select packets |
| 0:20–2:40 | Implement and test bounded packets |
| 2:40 | Freeze scope; do not begin another packet |
| 2:40–3:20 | Complete docs, full local verification, and diff review |
| 3:20–3:50 | Open or update the final PR, observe checks, merge, and sync |
| 3:50–4:00 | Verify the default branch and write the handoff |

If a run starts with a defined task, spend less time on selection and preserve
the saved time as verification reserve. External checks still count toward the
run. When they threaten the ceiling, leave a precise PR/check handoff instead of
starting more work or weakening verification.

## Authorization

At intake, record whether the user authorized only local changes or also
commits, pushes, pull requests, and merges. A request for continuous repository
work that explicitly grants those actions remains valid for the run; do not ask
again for each branch. Platform-enforced approval prompts may still appear.

Authorization for ordinary roadmap work does not include release tags,
publishing packages, changing repository settings or secrets, bypassing branch
protection, merging failed checks, or expanding into another repository. Those
actions require explicit scope.

Do not delegate work to additional agents unless the user or current run brief
allows delegation. One agent remains responsible for integration, verification,
and the final handoff.

## Work packet

A work packet is the unit of selection, implementation, verification, and
merge. It must have:

- one user-visible or architecture-visible outcome;
- explicit acceptance criteria;
- named affected contracts and documents;
- a verification plan known before implementation;
- one branch, one coherent commit series, and one pull request;
- a useful state if later packets are deferred.

A normal packet may combine one to three tightly related backlog items. Split a
packet when it crosses more than one high-risk boundary, such as a versioned
schema, scoring semantics, public API compatibility, target-code execution,
security permissions, or release packaging. Split it as well when the full
local gate and PR cycle cannot reasonably finish in the remaining time.

A four-hour run should normally merge one to three packets and no more than one
high-risk packet. Never optimize for pull-request count. After each merge,
re-evaluate the clock, clean state, remaining acceptance criteria, and next
packet. Do not start another packet after 2:40 elapsed or with less than 70
minutes remaining.

## Packet workflow

1. **Intake:** Read `AGENTS.md` and the required product, architecture, roadmap,
   backlog, ADR, security, and feature documentation. Inspect the worktree,
   branch, remotes, and recent history without discarding user changes.
2. **Define:** Write a short packet note in the working plan: outcome,
   acceptance criteria, affected contracts, risks, docs, verification, and
   explicit non-goals.
3. **Branch:** Synchronize the default branch, then create a narrowly named
   branch. Never mix unrelated pre-existing changes into it.
4. **Implement:** Prefer the smallest complete vertical change. Preserve
   determinism, evidence, bounds, validation, and the no-target-execution
   boundary. Add tests with the implementation.
5. **Review:** Inspect the complete diff, generated artifacts, new files,
   dependency changes, error handling, and documentation claims. Run
   `git diff --check`.
6. **Verify:** Run the applicable matrix below. Fix failures on the same branch;
   never lower or skip a gate to meet the timebox.
7. **Document:** Update the source-of-truth docs in the same packet. Mark a
   roadmap or backlog item complete only when its acceptance criteria and
   verification are complete.
8. **Publish:** When authorized, commit, push, and open a PR whose summary lists
   scope, tests, security or compatibility effects, limitations, and follow-up
   work.
9. **Merge checkpoint:** Observe required checks. Merge only a green,
   mergeable PR with no unresolved blocking review. Synchronize the local
   default branch and confirm it matches the remote.
10. **Continue or hand off:** Start another ready packet only if it fits the
    remaining budget. Otherwise record the next smallest ready packet without
    beginning it.

If the backlog has no ready item, stop at intake and obtain a product choice.
Do not turn an unprioritized roadmap direction into implementation work.

## Verification matrix

Every packet runs `git diff --check` and reviews `git status --short`. Use the
strongest applicable row; commands are cumulative where multiple rows apply.

| Change | Required local verification |
| --- | --- |
| Markdown-only documentation | Inspect rendered structure, headings, relative links, commands, and claims; run `git diff --check` |
| TypeScript, tests, configuration, or workspace metadata | `npm run quality` |
| CLI behavior or distributable contents | `npm run quality`, `npm run package:cli`, `npm run verify:package` |
| GitHub Action source or bundled dependencies | `npm run package:action`, `npm run quality`, `npm run verify:action`; confirm `action-dist/index.js` is committed |
| Schemas, scoring, graph behavior, adapters, or security boundaries | `npm run quality` plus focused positive, negative, limit, and determinism tests; review the relevant ADR/security/output docs |
| Dependency changes | clean install when feasible, `npm run quality`, package verification for affected distributables, and lockfile review |

For an authorized PR:

- required PR checks must pass before merge;
- after merge, confirm the local default branch is clean and equals the remote;
- observe the default-branch checks when the repository provides them;
- report exact commands and test counts instead of saying only “tests pass.”

Documentation-only work does not require an expensive build unless it changes
commands, package metadata, generated documentation, or technical claims that
need executable confirmation.

## Stop and handoff rules

Stop selecting new work when the scope-freeze time is reached. Stop the run and
leave a handoff when:

- acceptance criteria require a product or security choice not already made;
- unrelated user changes prevent a safe branch or merge;
- a required check repeatedly fails for an external reason;
- credentials, permissions, or branch protection block publication;
- the packet no longer fits the remaining verification and merge reserve.

Do not mark unfinished work complete and do not merge a partial implementation
merely to satisfy the clock. Prefer a clean unmerged branch or draft PR with an
exact handoff.

The final handoff must state:

- packets and PRs completed, with merge commits;
- current branch, clean/dirty state, and default-branch synchronization;
- verification commands, test counts, and CI conclusions;
- docs, schemas, generated files, or security boundaries changed;
- limitations, deferred work, and the next smallest ready packet;
- elapsed time and the reason for any early stop.

## Run brief template

Use this at the start of the next continuous run:

```text
Objective:
Authorization: local only | commit/push/PR/merge
Four-hour ceiling starts:

Packet:
Outcome:
Acceptance criteria:
Affected contracts:
Risks:
Docs:
Verification:
Non-goals:

Scope freeze:
Merge/handoff reserve:
```
