# Code review: conduct

> Part of the `code-review-and-quality` skill. Read it when handling disagreement, dead code, dependency additions, or review speed.

## Dead Code Hygiene

After any refactoring or implementation change, check for orphaned code:

1. Identify code that is now unreachable or unused
2. List it explicitly
3. **Ask before deleting:** "Should I remove these now-unused elements: [list]?"

Don't leave dead code lying around — it confuses future readers and agents. But don't silently delete things you're not sure about. When in doubt, ask.

```
DEAD CODE IDENTIFIED:
- formatLegacyDate() in src/utils/date.ts — replaced by formatDate()
- OldTaskCard component in src/components/ — replaced by TaskCard
- LEGACY_API_URL constant in src/config.ts — no remaining references
→ Safe to remove these?
```

## Review Speed

Slow reviews block entire teams. The cost of context-switching to review is less than the waiting cost imposed on others.

- **Respond within one business day** — this is the maximum, not the target
- **Ideal cadence:** Respond shortly after a review request arrives, unless deep in focused coding. A typical change should complete multiple review rounds in a single day
- **Prioritize fast individual responses** over quick final approval. Quick feedback reduces frustration even if multiple rounds are needed
- **Large changes:** Ask the author to split them rather than reviewing one massive changeset

## Handling Disagreements

When resolving review disputes, apply this hierarchy:

1. **Technical facts and data** override opinions and preferences
2. **Style guides** are the absolute authority on style matters
3. **Software design** must be evaluated on engineering principles, not personal preference
4. **Codebase consistency** is acceptable if it doesn't degrade overall health

**Don't accept "I'll clean it up later."** Experience shows deferred cleanup rarely happens. Require cleanup before submission unless it's a genuine emergency. If surrounding issues can't be addressed in this change, require filing a bug with self-assignment.

## Honesty in Review

When reviewing code — whether written by you, another agent, or a human:

- **Don't rubber-stamp.** "LGTM" without evidence of review helps no one.
- **Don't soften real issues.** "This might be a minor concern" when it's a bug that will hit production is dishonest.
- **Quantify problems when possible.** "This N+1 query will add ~50ms per item in the list" is better than "this could be slow."
- **Push back on approaches with clear problems.** Sycophancy is a failure mode in reviews. If the implementation has issues, say so directly and propose alternatives.
- **Accept override gracefully.** If the author has full context and disagrees, defer to their judgment. Comment on code, not people — reframe personal critiques to focus on the code itself.

## Dependency Discipline

Part of code review is dependency review:

**Before adding any dependency:**
1. Does the existing stack solve this? (Often it does.)
2. How large is the dependency? (Check bundle impact.)
3. Is it actively maintained? (Check last commit, open issues.)
4. Does it have known vulnerabilities? (`npm audit`)
5. What's the license? (Must be compatible with the project.)

**Rule:** Prefer standard library and existing utilities over new dependencies. Every dependency is a liability.

**Upgrading an existing dependency** is a code change like any other, and the riskiest upgrades are the ones merged in bulk with a message like "bump deps." Review them with the same discipline:

1. **Read the changelog, not just the version number.** Semver is a promise the maintainer may not have kept — a "patch" can carry a behavioral change. For a major bump, read the migration notes and find what breaks.
2. **One dependency per change.** Upgrade and merge them individually (or in small related groups). When a bulk bump breaks the build, you've lost which package did it; a single-package change makes the cause obvious and the revert clean.
3. **Let the tests decide.** The upgrade is verified by a green suite before *and* after, not by "it installed." If coverage around the dependency's behavior is thin, that gap is the real finding — add a test first.
4. **Mind the transitive graph.** Most installed packages are ones nobody chose directly. Review the lockfile diff, not just `package.json`; a single direct bump can pull in dozens of indirect changes.
5. **Keep the lockfile honest.** Commit it, review its diff, and never hand-edit it. The lockfile is the thing that actually pins what ships.

For triaging `npm audit` findings and supply-chain risk (typosquatting, compromised maintainers), follow the `security-and-hardening` skill — this section covers the upgrade *workflow*, that one covers the security verdict.
