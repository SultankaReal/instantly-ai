# Git Workflow — Inkflow

## Commit Format

```
type(scope): description

Types: feat | fix | refactor | test | docs | chore | perf | security
Scope: api | web | worker | shared | db | infra | ci

Examples:
  feat(api): add Stripe checkout session endpoint
  fix(worker): handle Postmark bounce event for unknown email
  test(api): add integration tests for subscribe flow
  docs(roadmap): mark publishing feature as done
  chore(db): add confirmation_token_expires_at migration
```

## Branching

- `main` — always deployable (protected)
- `feat/<feature-name>` — feature branches
- `fix/<bug-description>` — bug fixes
- `chore/<task>` — maintenance tasks

## Commit Discipline

- Commit after each **logical unit of work** — not at end of session
- One concern per commit (don't mix feature code with refactoring)
- Each feature commit should pass tests independently
- Push to remote after each completed phase of `/feature` or `/go`

## Automated Commits

The Stop hook auto-commits `myinsights/` changes:
- Format: `docs(insights): update knowledge base`
- Triggers only when myinsights/ directory has changes

The `/go` and `/feature` commands commit roadmap updates:
- Format: `docs(roadmap): mark <feature> as done`

## Tagging

- `v0.1.0-scaffold` — after `/start` completes
- `v0.1.0-mvp` — after `/run mvp` completes  
- `v1.0.0` — after `/run all` completes

## Never Do

- Don't commit `.env`, `.env.local`, secrets
- Don't force-push to `main`
- Don't `--amend` already-pushed commits
- Don't `--skip-verify` pre-commit hooks without explicit user approval
