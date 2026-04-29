# Insights Capture Protocol — Поток

## Error-First Lookup (CRITICAL — do this BEFORE debugging)

When you encounter ANY error, ALWAYS do this before starting to debug:

```bash
if [ -f "myinsights/1nsights.md" ]; then
  grep -i "ERROR_STRING_OR_CODE" myinsights/1nsights.md
fi
```

**Pattern:**
1. User reports a problem or an error occurs
2. Extract the key error string (error code, exception name, or unique message fragment)
3. `grep` the error string against `myinsights/1nsights.md`
4. **If match found** → read ONLY the linked detail file → suggest documented solution FIRST
5. **If no match** → debug normally → after resolution, suggest capturing with `/myinsights`

## When to Suggest Capturing an Insight

Proactively suggest `/myinsights` when ANY of these occur:

1. **Error → Fix cycle**: A non-trivial bug was debugged and resolved
   - Especially: imapflow IMAP connection issues on Яндекс/Mail.ru
   - Especially: BullMQ job stuck in delayed state unexpectedly
   - Especially: AES-256-GCM key mismatch between API and worker

2. **Configuration surprise**: A config setting behaved unexpectedly
   - Docker networking between api/worker containers
   - Nodemailer SMTP port/TLS settings for Яндекс vs Mail.ru
   - Redis eviction policy affecting refresh token blacklist

3. **Dependency issue**: A library/package caused problems

4. **38-ФЗ compliance edge case**: Unsubscribe token verification failure

5. **YooKassa quirk**: Webhook delivery order or retry behavior

## How to Suggest

After resolving a tricky issue, say:
```
💡 This looks like a valuable insight. Want me to capture it?
   Run `/myinsights [brief title]` or say "да, запиши"
```

## Lifecycle Awareness

- `🟢 Active` — trusted solution, apply directly
- `🟡 Workaround` — temporary fix, flag to user
- `🔴 Obsolete` — suggest archiving
