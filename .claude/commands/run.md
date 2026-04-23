---
description: Autonomous project build loop. Bootstraps project and implements features
  one by one until MVP (default) or all features are done.
  $ARGUMENTS: "mvp" (default) | "all" — scope of features to implement
---

# /run $ARGUMENTS

## Purpose

End-to-end autonomous project build: bootstrap → implement features in loop → done.
Combines `/start`, `/next`, and `/go` into a single continuous pipeline.

> **AUTONOMOUS EXECUTION — BLOCKING RULES:**
> - MUST execute features ONE AT A TIME through the full /go pipeline
> - MUST create 1 plan per feature, 1 validation per feature, 1 commit per feature
> - NEVER batch features into parallel waves without individual plans
> - NEVER skip the /next -> /go pipeline by launching raw implementation agents
> - CRITICAL: If a feature fails 3 times, skip it and log — NEVER retry indefinitely
> - MUST push state after each feature completion (independent commits)

## Step 0: Parse Scope

```
IF $ARGUMENTS is empty OR $ARGUMENTS == "mvp":
    scope = "mvp"
    → Implement only features with status `next` or `in_progress` in feature-roadmap.json
    → Stop when no more `next` features remain (skip `planned`)
    
IF $ARGUMENTS == "all":
    scope = "all"
    → Implement ALL features regardless of status
    → Stop only when every feature is `done`
```

## Step 1: Bootstrap Project

1. Check if project is already bootstrapped:
   - IF `apps/api/src/app.ts` exists AND `docker-compose.yml` exists → skip to Step 2
   - ELSE → run `/start`
2. Verify bootstrap succeeded:
   - Project structure exists
   - Docker services running: `docker compose ps`
   - Health check: `curl -s http://localhost:3000/api/health`
3. Commit and push: `git push origin HEAD`

## Step 2: Feature Implementation Loop

```
LOOP:
    1. Run `/next` to get current sprint status and next feature
    
    2. IF scope == "mvp":
         - Get next feature with status `next` or `in_progress`
         - IF no such feature exists → EXIT LOOP (MVP complete)
       IF scope == "all":
         - Get next feature that is NOT `done`
         - IF all features are `done` → EXIT LOOP (all complete)
    
    3. Run `/go <feature-name>` to implement the feature
       - /go automatically selects /plan or /feature
       - /go handles commits and pushes
    
    4. Verify implementation:
       - Run project tests: `npm run test` — ensure no regressions
       - IF tests fail → fix before continuing
    
    5. Update progress:
       - Feature marked as `done` in roadmap (handled by /go)
       - Log progress to stdout
    
    6. CONTINUE LOOP
```

## Step 3: Finalize

After loop completes:

1. Run full test suite: `npm run test && npm run test:integration`
2. Update README.md with current state
3. Final commit: `git add -A && git commit -m "milestone: <scope> complete"`
4. Push and tag:
   ```bash
   git push origin HEAD
   # if scope == "mvp":
   git tag v0.1.0-mvp && git push origin v0.1.0-mvp
   # if scope == "all":
   git tag v1.0.0 && git push origin v1.0.0
   ```
5. Generate summary report:

```
🏁 /run <scope> — COMPLETE

📊 Summary:
   Features implemented: <count>/<total>
   Total commits: <count>
   Total files: <count>
   Test results: <passed>/<total>

📋 Features completed:
   ✅ publishing              (via /feature)
   ✅ subscriber-management   (via /feature)
   ✅ paid-subscriptions      (via /feature)
   ✅ seo-native-posts        (via /plan)
   ✅ analytics               (via /feature)
   ✅ substack-import         (via /feature)
   ...

🏷️ Tagged: v0.1.0-mvp | v1.0.0

IF scope == "mvp" AND planned features remain:
   ⏭️ Remaining planned features (v1.0): ai-writing-assistant, cross-publication-recommendations, monetization
   To continue: /run all
```

## Error Recovery

- Each feature is committed independently → partial progress is saved
- If a feature fails repeatedly (3 attempts), skip it and mark as `blocked`
- If `/start` fails, stop and report — project bootstrap is critical
- On any failure: always push current state to remote first

## Parallelization

- `/go` handles per-feature parallelization internally
- Features are implemented sequentially (one at a time) to avoid conflicts
- Within each feature, /go maximizes internal parallelism

## Feature Order (from .claude/feature-roadmap.json)

MVP features (status: `next`):
1. publishing — F1 (Rich text editor, autosave, send)
2. subscriber-management — F2 (Email signup, list management)
3. paid-subscriptions — F3 (Stripe Checkout, 0% commission)
4. seo-native-posts — F4 (Next.js SSR, auto meta/OG)
5. analytics — F5 (Open rate, click rate)
6. substack-import — F6 (ZIP upload, CSV parse)

v1.0 features (status: `planned`):
7. ai-writing-assistant — F7 (Claude API, 10/hr rate limit)
8. cross-publication-recommendations — F8
9. multi-stream-monetization — F9
