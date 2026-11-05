---
name: performance-optimization
description: Optimizes InfiniteSpace performance, measuring before and after. Use when a canvas with many cards pans, drags, or loads slowly, when selectors or components re-render too often, when the build reports a large chunk, or when storage reads and writes (localStorage, IndexedDB) cost too much. The app has no server or database, so the backend and N+1 query material in this skill does not apply.
---

# Performance Optimization

> **Project override (InfiniteSpace):** run no git command (commit, diff, bisect, branch, stash) unless the user explicitly asks. Where this skill says to commit or use git, mark the step as ready for the user to do and carry on.

## Overview

Measure before optimizing. Performance work without measurement is guessing — and guessing leads to premature optimization that adds complexity without improving what matters. Profile first, identify the actual bottleneck, fix it, measure again. Optimize only what measurements prove matters.

## When to Use

- Performance requirements exist in the spec (load time budgets, response time SLAs)
- Users or monitoring report slow behavior
- Core Web Vitals scores are below thresholds
- You suspect a change introduced a regression
- Building features that handle large datasets or high traffic

**When NOT to use:** Don't optimize before you have evidence of a problem. Premature optimization adds complexity that costs more than the performance it gains.

## Core Web Vitals Targets

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| **INP** (Interaction to Next Paint) | ≤ 200ms | ≤ 500ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.25 | > 0.25 |

## Reference material

Read the matching file when the task needs that depth; the sections above are enough for routine work.

| File | Read it when | Contents |
| --- | --- | --- |
| `references/optimization-workflow.md` | You start any measured optimization (this is the core procedure) | The Optimization Workflow: Step 1: Measure; Where to Start Measuring; Step 2: Identify the Bottleneck; Step 3: Fix the Bottleneck; Step 4: Verify (Keep or Revert); Step 5: Guard Against Regression |

## See Also

For detailed performance checklists, optimization commands, and anti-pattern reference, see `../../references/performance-checklist.md`.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll optimize later" | Performance debt compounds. Fix obvious anti-patterns now, defer micro-optimizations. |
| "It's fast on my machine" | Your machine isn't the user's. Profile on representative hardware and networks. |
| "This optimization is obvious" | If you didn't measure, you don't know. Profile first. |
| "Users won't notice 100ms" | Research shows 100ms delays impact conversion rates. Users notice more than you think. |
| "The framework handles performance" | Frameworks prevent some issues but can't fix N+1 queries or oversized bundles. |
| "The query is slow, add an index" | Read the plan first. The index may already exist and be unusable, and every index taxes writes forever. |
| "Just cache it" | Caching an already-cheap call buys nothing and adds a staleness bug. Cache what is expensive *and* re-read far more than written. |
| "Raise the pool size, we're running out of connections" | A pool bigger than the database can serve moves the queue somewhere less visible. Find what holds connections. |
| "It didn't help much, but it doesn't hurt" | Neutral changes are a revert. You pay maintenance on them forever and got nothing back. |
| "We already wrote it, may as well keep it" | Sunk cost. The measurement doesn't care how long the change took to write. |
| "The improvement is obvious, no need to re-measure" | Then re-measuring is cheap and proves it. Unmeasured wins are how neutral complexity lands. |

## Red Flags

- Optimization without profiling data to justify it
- N+1 query patterns in data fetching
- An index added without a query plan before and after to justify it
- A cache key that omits an input the response depends on (tenant, locale, viewer)
- A cache with no stated staleness window and no invalidation strategy
- Connection pool size raised in response to exhaustion, without finding what holds connections
- List endpoints without pagination
- Images without dimensions, lazy loading, or responsive sizes
- Bundle size growing without review
- No performance monitoring in production
- `React.memo` and `useMemo` everywhere (overusing is as bad as underusing)
- Optimizations kept without a re-measurement that justifies them
- Several optimizations bundled into one measurement, so no single change can be attributed
- A "win" that required a test to be changed, skipped, or deleted
- The same failed optimization attempted more than once because nobody recorded the first attempt

## Verification

After any performance-related change:

- [ ] Before and after measurements exist (specific numbers)
- [ ] The result was re-measured the same way as the baseline (same command, same conditions)
- [ ] The improvement exceeds run-to-run variance, not just the mean
- [ ] Changes that didn't beat the baseline were reverted, not kept as neutral
- [ ] Attempts are logged, kept and reverted alike, so a dead idea isn't re-run
- [ ] The specific bottleneck is identified and addressed
- [ ] Core Web Vitals are within "Good" thresholds
- [ ] Bundle size hasn't increased significantly
- [ ] No N+1 queries in new data fetching code
- [ ] Any new index is justified by a query plan before and after, and its write cost was considered
- [ ] Any new cache states what it keys on and how it goes stale
- [ ] The measured user-facing metric has a synthetic budget or field monitor that can detect regression
- [ ] Existing tests still pass (optimization didn't break behavior)
