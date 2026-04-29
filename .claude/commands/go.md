# /go [feature] — Auto-select Pipeline and Implement

Auto-detect complexity and run appropriate pipeline for a feature.

## Usage

```
/go auth-module
/go warmup-engine
/go fix-inbox-score
```

## Decision Logic

```
if feature is in feature-roadmap.json AND is a new user story:
  → run /feature [name]  (full 4-phase SPARC lifecycle)
elif feature is a small bug fix or enhancement (< 1 day):
  → run /plan [name]  (lightweight plan → implement)
else:
  → ask user to clarify scope
```

## Execution

1. Check `.claude/feature-roadmap.json` for the feature
2. Estimate complexity from PRD.md user stories
3. Select pipeline (feature vs plan)
4. Execute pipeline end-to-end
5. Update roadmap on completion
6. Push to remote

## MVP Priority Order

When called without arguments (`/go`), pick the highest-priority pending feature:
1. F01 Auth Module (P0)
2. F02 Email Account Management (P0)
3. F03 Warmup Engine (P1)
4. F04 Inbox Score (P1)
5. F07 YooKassa Billing (P2)
6. F05 Campaign Engine (P2)
7. F06 Unified Inbox (P3)
8. F08 AI Reply Agent (P3) — gated by `ai_reply_enabled` flag
