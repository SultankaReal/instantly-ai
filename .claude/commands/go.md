---
description: Intelligent feature implementation pipeline. Analyzes complexity and selects
  optimal approach (/plan or /feature), then executes autonomously with parallel agents
  and frequent commits.
  $ARGUMENTS: feature name, ID, or brief description (optional — defaults to next from roadmap)
---

# /go $ARGUMENTS

## Purpose

One-command feature implementation that automatically selects the right pipeline
based on feature complexity, then executes it without manual confirmations.

> **PROCESS COMPLIANCE — BLOCKING RULES:**
> - MUST use /plan or /feature commands — NEVER launch raw Agent tools directly
> - MUST follow the skill chain: /next -> /go -> /plan|/feature
> - FORBIDDEN: Bypassing the skill chain by spawning parallel agents without commands
> - FORBIDDEN: Batching multiple features into a single commit wave
> - CRITICAL: Each feature MUST get its own plan, validation, and commit sequence

## Step 1: Determine Target Feature

IF $ARGUMENTS is provided:
  - Parse as feature name, roadmap ID, or description
  - Look up in `.claude/feature-roadmap.json` if it matches an ID
ELSE:
  - Run `/next` logic to find the highest-priority `next` feature
  - If no `next` feature found, pick first `planned` feature
  - Confirm selection before proceeding

## Step 2: Analyze Complexity

Evaluate the feature to determine the right pipeline:

| Signal | Score |
|--------|-------|
| Touches ≤3 files | -2 (simple) |
| Touches 4-10 files | 0 (medium) |
| Touches >10 files | +3 (complex) |
| Has external API integration (Stripe, Postmark, Claude API) | +2 |
| Requires new database entities | +2 |
| Estimated implementation < 30 min | -2 |
| Estimated implementation > 2 hours | +3 |
| Is a hotfix or minor improvement | -3 |
| Has Gherkin scenarios for this feature in docs/test-scenarios.md | +1 |

**Decision matrix:**

| Total Score | Pipeline | Rationale |
|-------------|----------|-----------|
| ≤ -2 | `/plan` | Simple task, lightweight plan is enough |
| -1 to +∞ | `/feature` | Feature with SPARC lifecycle required |

## Step 3: Execute Selected Pipeline

### If `/plan` selected:
1. Run `/plan <feature-name>`
2. After plan is saved, immediately implement it
3. Use `Task` tool to parallelize independent changes
4. Run tests after implementation
5. Commit and push: `git push origin HEAD`

### If `/feature` selected:
1. Run `/feature <feature-name>` in AUTO mode (no confirmations between phases)
   - Phase 1: PLAN (sparc-prd-mini → docs)
   - Phase 2: VALIDATE (requirements-validator → score ≥70)
   - Phase 3: IMPLEMENT (parallel agents from docs)
   - Phase 4: REVIEW (brutal-honesty-review → fix criticals)
2. Where possible, spawn concurrent tasks:
   - Parallel test writing + implementation
   - Parallel frontend (apps/web) + backend (apps/api) if independent
   - Use swarm of agents for large implementations
3. Commit frequently (after each logical change)
4. Push after each phase: `git push origin HEAD`

## Step 4: Post-Implementation

1. Update `.claude/feature-roadmap.json`:
   - Set feature status to `done`
   - Update `files` array with actual files touched
2. Commit roadmap update: `git add .claude/feature-roadmap.json && git commit -m "docs(roadmap): mark <feature> as done"`
3. Push: `git push origin HEAD`
4. Report summary:
```
✅ Feature completed: <feature-name>
   Pipeline used: /plan | /feature
   Complexity score: <N>
   Files changed: <count>
   Commits: <count>
   Tests: <passed>/<total>
   
   Next suggested: /next or /go for the next feature
```

## Parallelization Strategy

- Use `Task` tool for independent subtasks within implementation
- Spawn concurrent agents when feature touches multiple packages/services (api + web + worker)
- Run tests in parallel with implementation of unrelated components
- Never parallelize tasks that have data dependencies

## Git Strategy

- Commit after each logical unit of work (not giant commits)
- Format: `type(scope): description`
- Push to remote after each completed phase to prevent data loss
