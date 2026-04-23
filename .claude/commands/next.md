---
description: Show feature roadmap status and determine the next feature to implement.
  Reads .claude/feature-roadmap.json and reports sprint progress.
  $ARGUMENTS: feature-id (to mark as done) | "update" (sync status from code) | empty (show status)
---

# /next $ARGUMENTS

## Purpose

Single source of truth for "what should I work on next?" — reads the feature roadmap,
shows current sprint status, and identifies the highest-priority next feature.

## Default Mode (no arguments): Show Status

1. Read `.claude/feature-roadmap.json`
2. Group features by status
3. Display:

```
📋 Inkflow — Feature Roadmap

🏃 In Progress:
  - [F2] subscriber-management (started: YYYY-MM-DD)

✅ Done:
  - [F1] publishing

⏭️ Next (MVP):
  - [F2] subscriber-management ← CURRENT
  - [F3] paid-subscriptions
  - [F4] seo-native-posts
  - [F5] analytics
  - [F6] substack-import

📌 Planned (v1.0):
  - [F7] ai-writing-assistant
  - [F8] cross-publication-recommendations
  - [F9] multi-stream-monetization

📊 Progress: 1/6 MVP features done (17%)
💡 Next action: /go subscriber-management
```

## Mark Done Mode (`/next [feature-id]`):

1. Find feature by ID or name in `.claude/feature-roadmap.json`
2. Update status: `in_progress` → `done`
3. Set `completed_at` timestamp
4. Find next `next` feature to work on
5. Report:
```
✅ [F1] publishing marked as done
⏭️ Next up: [F2] subscriber-management
   Run: /go subscriber-management
```

## Update Mode (`/next update`):

1. Scan `docs/features/` for completed SPARC plans + review reports
2. Check git log for recent feature commits
3. Sync roadmap status based on findings
4. Save updated `.claude/feature-roadmap.json`
5. Show diff of status changes

## Priority Algorithm

When determining "next" feature:
1. First: features with status `in_progress` (resume interrupted work)
2. Second: features with status `next` in order by `priority` field
3. Third: if MVP scope complete, suggest first `planned` feature
4. Never: skip `blocked` features silently — always report them

## Feature Roadmap Format

`.claude/feature-roadmap.json` schema:
```json
{
  "project": "inkflow",
  "scope": "mvp",
  "features": [
    {
      "id": "F1",
      "name": "publishing",
      "title": "Publishing — Rich text editor, autosave, schedule, send",
      "status": "next|in_progress|done|blocked",
      "priority": 1,
      "phase": "mvp|v1.0|v2.0",
      "stories": ["US-01", "US-02", "US-03"],
      "files": [],
      "started_at": null,
      "completed_at": null
    }
  ]
}
```
