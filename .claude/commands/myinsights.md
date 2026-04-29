# /myinsights [title] — Capture Development Insight

Capture a development insight to the knowledge base.

## Usage

```
/myinsights yandex-imap-idle-timeout
/myinsights yookassa-webhook-retry-order
/myinsights aes-key-rotation-procedure
/myinsights list           — show all insights
/myinsights archive INS-N  — archive an obsolete insight
/myinsights status INS-N active — update lifecycle status
```

## Capture Protocol

1. Create `myinsights/INS-<NNN>-<slug>.md` with:

```markdown
---
id: INS-NNN
title: <title>
status: 🟢 Active
created: YYYY-MM-DD
hits: 0
---

## Problem
What went wrong or what was surprising.

## Root Cause
Why it happened.

## Solution
Step-by-step fix.

## Error Signatures
- `ECONNRESET`
- `imap idle timeout`

## Prevention
How to avoid this in the future.
```

2. Add entry to `myinsights/1nsights.md` index:

```
| INS-NNN | YYYY-MM-DD | <title> | `signature` | Short description | 🟢 | INS-NNN-slug.md |
```

3. Commit:
```bash
git add myinsights/
git commit -m "docs(insights): add INS-NNN — <title>"
```

## Error-First Lookup

On ANY error: first grep `myinsights/1nsights.md` for the error signature.
Only debug from scratch if no match found.
