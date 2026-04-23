---
description: Create a lightweight implementation plan for a simple feature or task.
  Saves plan to docs/plans/ as a markdown file. For complex features, use /feature instead.
  $ARGUMENTS: feature name or task description | "list" | "done <slug>"
---

# /plan $ARGUMENTS

## Purpose

Lightweight implementation planning for tasks that don't need full SPARC lifecycle.
Creates a structured plan file and immediately implements it.

Use `/plan` for: hotfixes, config changes, small improvements, refactoring.
Use `/feature` for: new features, anything touching >3 files, external integrations.

## Default Mode: Create Plan

### Step 1: Analyze Task

Read relevant docs to understand scope:
- Check `docs/Architecture.md` for affected components
- Check `docs/Pseudocode.md` for relevant algorithms
- Check `docs/Specification.md` for related API endpoints
- Check `myinsights/1nsights.md` for known pitfalls

### Step 2: Create Plan File

Save to `docs/plans/<slug>.md`:

```markdown
# Plan: <task title>

**Date:** YYYY-MM-DD
**Status:** in_progress
**Complexity score:** <N> (use /go scoring rubric)
**Estimated time:** <X> minutes

## Context
[Why this task, what triggered it]

## Approach
[How we'll implement it — 3-5 bullet points]

## Steps
1. [ ] Step 1 — file: `path/to/file.ts`
2. [ ] Step 2 — file: `path/to/file.ts`
3. [ ] Run tests: `npm run test`
4. [ ] Commit: `type(scope): description`

## Edge Cases
- [Known edge case 1]
- [Known edge case 2]

## Definition of Done
- [ ] Tests pass
- [ ] No TypeScript errors
- [ ] Committed and pushed
```

### Step 3: Implement

Immediately execute the plan:
1. Work through steps in order
2. Mark each step complete as you go
3. Use `Task` tool for parallel steps where possible
4. Commit after logical groups

### Step 4: Mark Complete

Update plan file status: `in_progress` → `done`
Commit: `docs(plans): mark <slug> as done`

## List Mode (`/plan list`):

Show all plans in `docs/plans/`:
```
📝 Implementation Plans

In Progress:
  - fix-redis-auth.md (2026-04-23)

Done:
  - seo-metadata-fix.md (2026-04-20)
```

## Done Mode (`/plan done <slug>`):

1. Update `docs/plans/<slug>.md` status to `done`
2. Add `completed_at: YYYY-MM-DD`
3. Commit: `docs(plans): mark <slug> as done`
