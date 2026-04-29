# /plan [name] — Lightweight Implementation Plan

Create a focused implementation plan for a simple task (no full SPARC needed).

## Usage

```
/plan fix-warmup-rampup
/plan add-inbox-score-alert
/plan refactor-campaign-service
```

## When to Use vs /feature

| Use /plan | Use /feature |
|-----------|-------------|
| Bug fix | New user story |
| Minor enhancement | New module/service |
| Refactoring task | External integration |
| Config/migration | Requires new DB tables |
| < 1 day of work | > 1 day of work |

## Plan Template

Create `docs/plans/<slug>.md`:

```markdown
# Plan: <name>
**Created:** <date> | **Status:** pending

## Goal
One sentence describing what this achieves.

## Context
- Relevant SPARC docs: [link]
- Related algorithms: [Pseudocode.md section]
- Edge cases: [Refinement.md section]

## Steps
1. [ ] Step 1 (est. 30min)
2. [ ] Step 2 (est. 1hr)
3. [ ] Step 3 (est. 30min)

## Test Plan
- Unit test: what to test
- Integration test: what endpoint/flow to verify

## Done Criteria
- [ ] Tests pass
- [ ] No TypeScript errors
- [ ] Security rules followed
```

## Commands

- `/plan list` — list all plans with status
- `/plan done <slug>` — mark plan as completed
- `/plan [name]` — create new plan
