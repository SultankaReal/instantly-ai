---
name: feature-navigator
description: >
  Feature roadmap navigator for Inkflow. Reads .claude/feature-roadmap.json to determine
  implementation order, dependencies, and sprint context. Used by /next and /go to decide
  what to work on next. Load when navigating the feature roadmap or planning sprints.
version: "1.0"
maturity: production
---

# Feature Navigator — Inkflow

## Roadmap Source

Single source of truth: `.claude/feature-roadmap.json`

Statuses: `next` → `in_progress` → `done` | `blocked`
Phases: `mvp` (F1-F6), `v1.0` (F7-F9), `v2.0` (future)

## Feature Dependency Map

```
F1: publishing
  └── required by: F3 (paid-subscriptions uses post access control)
                   F5 (analytics needs sent posts)
                   F7 (AI assistant needs editor)

F2: subscriber-management
  └── required by: F1 (send requires subscribers)
                   F3 (paid subscriptions ARE subscribers)
                   F5 (analytics includes subscriber growth)

F3: paid-subscriptions
  └── requires: F1 (posts exist), F2 (subscribers exist)
  └── required by: F9 (monetization is extension of F3)

F4: seo-native-posts
  └── requires: F1 (posts must exist to have SEO)
  └── independent of: F2, F3

F5: analytics
  └── requires: F1 (sent posts), F2 (subscribers)
  └── independent of: F3 (basic analytics don't need payments)

F6: substack-import
  └── requires: F2 (subscriber model must exist)
  └── independent of: F1, F3, F4, F5

F7: ai-writing-assistant (v1.0)
  └── requires: F1 (editor must exist)
  └── independent of: F2, F3

F8: cross-publication-recommendations (v1.0)
  └── requires: F1, F2 (publications and subscribers)

F9: multi-stream-monetization (v1.0)
  └── requires: F3 (Stripe already integrated)
```

## Recommended Implementation Order

MVP sprint sequence (optimizes for early value + dependency satisfaction):

1. **F2** subscriber-management — foundational, no dependencies
2. **F1** publishing — requires subscriber model (F2)
3. **F6** substack-import — early migration tool for Substack users
4. **F4** seo-native-posts — can be done alongside F1
5. **F3** paid-subscriptions — requires F1 + F2
6. **F5** analytics — last MVP feature, requires F1 + F2

v1.0 sequence:
7. **F7** ai-writing-assistant — requires F1
8. **F8** cross-publication-recommendations — requires F1 + F2
9. **F9** multi-stream-monetization — requires F3

## Complexity Assessment

| Feature | Score | Pipeline |
|---------|-------|----------|
| F1: publishing | +5 (new DB entities + queue + email + SEO) | /feature |
| F2: subscriber-management | +4 (DB + confirm flow + email) | /feature |
| F3: paid-subscriptions | +6 (Stripe + webhooks + access control) | /feature |
| F4: seo-native-posts | +2 (Next.js metadata + sitemap) | /feature |
| F5: analytics | +3 (webhooks + DB aggregation) | /feature |
| F6: substack-import | +3 (ZIP parse + CSV + upsert) | /feature |
| F7: ai-writing-assistant | +3 (Claude API + rate limiting) | /feature |
| F8: recommendations | +4 (cross-publication query) | /feature |
| F9: monetization | +3 (Stripe extension) | /feature |

## Critical Path to Revenue

**Minimum viable revenue path:** F2 → F1 → F3
(subscribers → publishing → paid subscriptions)

This is the fastest path to having paying users and testing the 0% commission value prop.
