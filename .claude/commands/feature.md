# /feature [name] — Full SPARC Feature Lifecycle

Run the 4-phase feature development lifecycle for a named feature.

## Usage

```
/feature warmup-engine
/feature campaign-engine
/feature ai-reply-agent
/feature yookassa-billing
```

## Phase 1: PLAN

Read `.claude/skills/sparc-prd-mini/SKILL.md` and execute with:
- Output directory: `docs/features/<name>/sparc/`
- Architecture constraints: Distributed Monolith, Docker Compose, VPS, Fastify v5, Next.js 15, Prisma 5
- Mode: MANUAL (checkpoint after each sub-phase)

Documents to generate (10):
1. PRD.md
2. Solution_Strategy.md
3. Specification.md
4. Pseudocode.md
5. Architecture.md
6. Refinement.md
7. Completion.md
8. Research_Findings.md
9. Final_Summary.md
10. validation-report.md (Phase 2)

Commit: `docs(<name>): SPARC documentation for <name>`

## Phase 2: VALIDATE

Read `.claude/skills/requirements-validator/SKILL.md` and run swarm:
- 5 parallel validator agents
- Exit criteria: average ≥70/100, no BLOCKED items
- Max 3 iterations
- Save report to `docs/features/<name>/sparc/validation-report.md`

Commit: `docs(<name>): validation report for <name>`

## Phase 3: IMPLEMENT

Read SPARC docs → implement from Pseudocode.md algorithms:
- Use Task tool for parallel work on independent modules
- Follow `.claude/rules/coding-style.md`
- Follow `.claude/rules/security.md`
- Commit after each logical unit

## Phase 4: REVIEW

Read `.claude/skills/brutal-honesty-review/SKILL.md` and run swarm:
- Fix all CRITICAL and MAJOR issues before marking complete
- Save report to `docs/features/<name>/review-report.md`

Commit: `docs(<name>): review report for <name>`

## Update Roadmap

After completion:
- Update `.claude/feature-roadmap.json` status to "done"
- Commit: `docs(roadmap): mark <name> as done`
