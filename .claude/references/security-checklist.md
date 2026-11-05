# Security Checklist

Quick reference for web application security. Use alongside the `security-and-hardening` skill.

## Table of Contents

- [Threat Modeling (Start Here)](#threat-modeling-start-here)
- [Pre-Commit Checks](#pre-commit-checks)
- [Authentication](#authentication)
- [Authorization](#authorization)
- [Input Validation](#input-validation)
- [Security Headers](#security-headers)
- [CORS Configuration](#cors-configuration)
- [Data Protection](#data-protection)
- [Dependency Security](#dependency-security)
- [AI / LLM Security](#ai--llm-security)
- [Error Handling](#error-handling)
- [OWASP Top 10 Quick Reference](#owasp-top-10-quick-reference)
- [OWASP Top 10 for LLMs Quick Reference](#owasp-top-10-for-llms-quick-reference)

## Threat Modeling (Start Here)

Before reaching for controls, spend five minutes thinking like an attacker:

- [ ] Trust boundaries mapped (requests, uploads, webhooks, third-party APIs, LLM output, and local values written by processes you don't control)
- [ ] Assets named (credentials, PII, payment data, admin actions, money movement)
- [ ] STRIDE run per boundary (Spoofing, Tampering, Repudiation, Info disclosure, DoS, Elevation)
- [ ] Abuse cases written next to use cases ("how would I misuse this?")

## Pre-Commit Checks

- [ ] No secrets in code (`git diff --cached | grep -i "password\|secret\|api_key\|token"`)
- [ ] `.gitignore` covers: `.env`, `.env.local`, `*.pem`, `*.key`
- [ ] `.env.example` uses placeholder values (not real secrets)

## Authentication

- [ ] Passwords hashed with bcrypt (≥12 rounds), scrypt, or argon2
- [ ] Session cookies: `httpOnly`, `secure`, `sameSite: 'lax'`
- [ ] Session expiration configured (reasonable max-age)
- [ ] Rate limiting on login endpoint (≤10 attempts per 15 minutes)
- [ ] Password reset tokens: time-limited (≤1 hour), single-use
- [ ] Account lockout after repeated failures (optional, with notification)
- [ ] MFA supported for sensitive operations (optional but recommended)

## Authorization

- [ ] Every protected endpoint checks authentication
- [ ] Every resource access checks ownership/role (prevents IDOR)
- [ ] Admin endpoints require admin role verification
- [ ] API keys scoped to minimum necessary permissions
- [ ] JWT tokens validated (signature, expiration, issuer)

## Input Validation

- [ ] All user input validated at system boundaries (API routes, form handlers)
- [ ] Validation uses allowlists (not denylists)
- [ ] String lengths constrained (min/max)
- [ ] Numeric ranges validated
- [ ] Email, URL, and date formats validated with proper libraries
- [ ] File uploads: type restricted, size limited, content verified
- [ ] SQL queries parameterized (no string concatenation)
- [ ] HTML output encoded (use framework auto-escaping)
- [ ] URLs validated before redirect (prevent open redirect)
- [ ] Server-side URL fetches allowlisted; private/reserved IPs blocked (prevent SSRF)
- [ ] Destructive path operations (delete/move/overwrite): symlinks resolved, allowlisted root, minimum depth, ownership evidence read before the call

### Destructive Path Operations

Containment for a target named by data. Resolve first, then decide — and treat the
result as a candidate, not as authorization:

```typescript
import { realpath, readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join, sep } from 'node:path';

const ALLOWED_ROOTS = ['/var/lib/myapp/sessions']; // an allowlist, not a pattern
const MIN_DEPTH = 1;                               // so a root is never the target

async function resolveDeletable(candidate: string, expectedOwner: string) {
  const target = await realpath(resolve(candidate)); // symlinks resolved BEFORE the check
  const inRoot = ALLOWED_ROOTS.some((root) => {
    const rel = relative(root, target);
    // `rel === '..'` / `'../'` only — a plain `startsWith('..')` would also
    // reject a legitimate child named `..cache`.
    if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return false;
    return rel.split(sep).length >= MIN_DEPTH;
  });
  if (!inRoot) throw new Error(`refusing: outside allowed roots (${target})`);

  const owner = await readFile(join(target, '.owner'), 'utf8').catch(() => null);
  if (owner?.trim() !== expectedOwner) throw new Error(`refusing: unproven owner (${target})`);
  return target;
}
```

What this does not do, and must be said where the snippet is copied from:

- **The marker is self-attestation.** Anything that can write inside the root can write
  `.owner`. `expectedOwner` has to come from authenticated state, and the marker needs
  integrity protection (restrictive ownership, or a MAC) before it is authorization
  rather than a consistency check against a misderived target.
- **Returning a path leaves a check/use race.** Where an untrusted process can swap an
  ancestor between the check and the call, operate on a descriptor with no-follow,
  beneath-the-root semantics, or guarantee the hierarchy is immutable for the duration.

## Security Headers

```
Content-Security-Policy: default-src 'self'; script-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0  (disabled, rely on CSP)
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

Continued in [`security-checklist-2.md`](security-checklist-2.md).
