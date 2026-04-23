---
description: Full feature lifecycle — from idea to reviewed implementation.
  Orchestrates SPARC planning, validation, implementation, and review.
  $ARGUMENTS: feature name or brief description
---

# /feature $ARGUMENTS

## Overview

Four-phase feature development lifecycle with quality gates between each phase.
All documentation goes to `docs/features/<feature-name>/sparc/`.

> **SKILL CHAIN — BLOCKING RULES:**
> - MUST execute Phase 0 (pre-flight check) before ANY generation
> - MUST use sparc-prd-mini skill for planning — NEVER generate SPARC docs from memory
> - MUST use requirements-validator for validation — NEVER skip validation phase
> - MUST use brutal-honesty-review for review — NEVER self-review
> - FORBIDDEN: Skipping any phase without explicit user permission
> - CRITICAL: Each phase MUST complete and commit before the next phase starts

## Phase 0: PRE-FLIGHT CHECK

Before starting, verify all required skills exist:

```
Required skills in .claude/skills/:
✅ sparc-prd-mini/SKILL.md        — ABORT if missing (core orchestrator)
⚠️ explore/SKILL.md               — fallback: built-in Socratic questions (degraded)
⚠️ goap-research-ed25519/SKILL.md — fallback: direct web_search (degraded)
⚠️ problem-solver-enhanced/SKILL.md — fallback: First Principles + SCQA only (degraded)
✅ requirements-validator/SKILL.md — ABORT if missing (Phase 2 blocker)
✅ brutal-honesty-review/SKILL.md  — ABORT if missing (Phase 4 blocker)
```

If any ✅ skill is missing → stop and inform user to re-run toolkit generator.
If any ⚠️ skill is missing → warn user about degraded quality, continue.

## Phase 1: PLAN (sparc-prd-mini)

**Goal:** Research, analyze, and create full SPARC documentation for the feature.

```
Read the sparc-prd-mini skill from .claude/skills/sparc-prd-mini/SKILL.md
```

1. Create feature directory: `docs/features/<feature-name>/sparc/`
2. Run sparc-prd-mini Gate to assess task clarity (skip Explore if clear)
3. Apply sparc-prd-mini MANUAL mode to the feature
4. sparc-prd-mini delegates to external skills via view():
   - explore → Socratic questioning → Product Brief
   - goap-research-ed25519 → GOAP A* + OODA → Research Findings
   - problem-solver-enhanced → 9 modules + TRIZ → Solution Strategy
5. Output all SPARC documents into the feature directory:
   - PRD.md, Solution_Strategy.md, Specification.md
   - Pseudocode.md, Architecture.md, Refinement.md
   - Completion.md, Research_Findings.md, Final_Summary.md
   - Note: CLAUDE.md is NOT generated per-feature (project-level CLAUDE.md already exists)
6. Git commit: `docs(feature): SPARC planning for <feature-name>`

**⏸️ Checkpoint:** Show SPARC summary, ask to proceed to validation.

## Phase 2: VALIDATE (requirements-validator, swarm)

**Goal:** Validate SPARC documentation quality using swarm of validation agents.

```
Read the requirements-validator skill from .claude/skills/requirements-validator/SKILL.md
```

Use swarm of agents to validate:

| Agent | Scope | Target |
|-------|-------|--------|
| validator-stories | User Stories from Specification.md | INVEST criteria, score ≥70 |
| validator-acceptance | Acceptance Criteria | SMART criteria, testability |
| validator-architecture | Architecture.md | Consistency with project Architecture |
| validator-pseudocode | Pseudocode.md | Completeness, implementability |
| validator-coherence | All SPARC files | Cross-reference consistency |

**Iterative loop (max 3 iterations):**
1. Run all validators in parallel (Task tool)
2. Aggregate gaps and blocked items
3. Fix gaps in SPARC documents
4. Re-validate
5. Repeat until: no BLOCKED items, average score ≥70

Save validation report: `docs/features/<feature-name>/sparc/validation-report.md`
Git commit: `docs(feature): validation complete for <feature-name>`

**⏸️ Checkpoint:** Show validation results, ask to proceed to implementation.

## Phase 3: IMPLEMENT (swarm + parallel tasks)

**Goal:** Implement the feature using validated SPARC documents as source of truth.

When SPARC plan is ready for implementation:
1. Read ALL documents from `docs/features/<feature-name>/sparc/`
2. Use swarm of agents and specialized skills to deliver:
   - `@planner` — break down into tasks from Pseudocode.md
   - `@architect` — ensure consistency with Architecture.md
   - Implementation agents — parallel Task tool for independent modules
3. Make implementation modular for reuse
4. Save frequent commits to GitHub
5. Spawn concurrent tasks to speed up development

**Implementation rules:**
- Each module gets its own Task for parallel execution
- Reference SPARC docs, don't hallucinate code
- Commit after each logical unit: `feat(<feature-name>): <what>`
- Run tests in parallel with implementation

**⏸️ Checkpoint:** Show implementation summary, ask to proceed to review.

## Phase 4: REVIEW (brutal-honesty-review, swarm)

**Goal:** Rigorous post-implementation review and improvement.

```
Read the brutal-honesty-review skill from .claude/skills/brutal-honesty-review/SKILL.md
```

Use swarm of agents for review:

| Agent | Scope | Focus |
|-------|-------|-------|
| code-quality | Source code | Clean code, patterns, naming |
| architecture | Integration | Consistency with project architecture |
| security | Security surface | Vulnerabilities, input validation |
| performance | Hot paths | Bottlenecks, complexity |
| testing | Test coverage | Edge cases, missing tests |

Process:
1. Run brutal-honesty-review on implementation
2. Fix identified issues (use Task tool for parallel fixes)
3. Save frequent commits: `fix(<feature-name>): <what>`
4. Benchmark after implementation
5. Re-review critical findings until clean

Save review report: `docs/features/<feature-name>/review-report.md`
Git commit: `docs(feature): review complete for <feature-name>`

## Completion

After all 4 phases:
```
✅ Feature: <feature-name>

📁 docs/features/<feature-name>/
├── sparc/                    # SPARC documentation
│   ├── PRD.md
│   ├── Specification.md
│   ├── Architecture.md
│   ├── Pseudocode.md
│   ├── ...
│   └── validation-report.md
└── review-report.md          # Brutal honesty review

📊 Validation: score XX/100
🔍 Review: X issues found → X fixed
💾 Commits: N commits

💡 Consider running /myinsights if you encountered any tricky issues.
```
