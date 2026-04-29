# /run — Autonomous Implementation Loop

Run autonomous implementation loop for MVP or all features.

## Usage

```
/run          — bootstrap + implement all MVP features
/run mvp      — same as /run
/run all      — implement ALL features (MVP + v1.0)
```

## MVP Features (P0 + P1 + P2)

```
P0: Auth Module → Email Account Management
P1: Warmup Engine → Inbox Score
P2: Campaign Engine → YooKassa Billing
P3: Unified Inbox → AI Reply Agent
```

## Loop Protocol

For each pending feature in priority order:

```
1. /start (if not yet scaffolded)
2. /go [feature]
   a. /feature [feature] → PLAN + VALIDATE
   b. IMPLEMENT (parallel agents)
   c. /feature review → brutal-honesty-review
3. git push origin main
4. /next [feature-id] → mark done
5. Continue to next feature
```

## Stop Conditions

- All target features marked "done" in roadmap
- User interrupts with Ctrl+C
- Unrecoverable error (ask user before proceeding)

## Tagging

- After all P0+P1 done: `git tag v0.1.0-mvp`
- After all features done: `git tag v1.0.0`

## Notes

- `/run` is designed for unattended operation
- Each feature is committed and pushed before moving to the next
- Validation failures halt the loop and ask for user input
- Use `/go [feature]` for manual single-feature execution
