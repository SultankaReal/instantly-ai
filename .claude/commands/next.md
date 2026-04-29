# /next — Feature Roadmap Status

Show current feature roadmap status and recommended next step.

## Usage

```
/next              — show full roadmap with status
/next [feature-id] — mark feature as done
/next update       — sync roadmap with git history
```

## Behavior

1. Read `.claude/feature-roadmap.json`
2. Display table: ID | Feature | Priority | Status | Est Hours

```
📋 ПОТОК FEATURE ROADMAP
────────────────────────────────────────────────────────
 ID  | Feature                   | Priority | Status    
────────────────────────────────────────────────────────
 F01 | Auth Module               | P0       | ✅ done   
 F02 | Email Account Management  | P0       | 🔄 active 
 F03 | Warmup Engine             | P1       | ⏳ pending
 F04 | Inbox Score               | P1       | ⏳ pending
 F05 | Campaign Engine           | P2       | ⏳ pending
 F06 | Unified Inbox             | P3       | ⏳ pending
 F07 | YooKassa Billing          | P2       | ⏳ pending
 F08 | AI Reply Agent            | P3       | ⏳ pending
────────────────────────────────────────────────────────

🎯 NEXT: F03 — Warmup Engine (P1, est. 8h)
   Start with: /feature warmup-engine
```

3. When `/next [feature-id]`:
   - Update `.claude/feature-roadmap.json` status to "done"
   - Commit: `docs(roadmap): mark [feature-id] as done`
