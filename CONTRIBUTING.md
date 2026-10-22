# Contributing to Letterboxd Pro Analytics

Thank you for your interest in contributing to **Letterboxd Pro Analytics**!

This project is built with a commitment to strict software engineering standards, zero-knowledge privacy, and honest statistics. Please review these guidelines before submitting a pull request.

---

## 1. Development Principles

1. **Production-Ready Only:** No placeholder UI, stubs, TODOs, or commented-out dead code.
2. **Honest Numbers:** Never extrapolate or hide partial sample sizes. Always display coverage metrics and explicitly disclose date-unknown films.
3. **Zero Data Leakage:** User export files and personal film data must never be transmitted off the device. Web Workers handle parsing, and external network traffic is restricted solely to public TMDb movie queries.
4. **Calendar Date Arithmetic:** Never run dates through `Date.prototype.toISOString()` or UTC timezone conversions. Always use pure calendar date utilities (`YYYY-MM-DD`).

---

## 2. Tech Stack & Dependencies

- **Framework:** React 19 + TypeScript (strict mode) + Vite
- **Styling:** Tailwind CSS v4 with dark slate design tokens
- **Animations:** Motion (`motion/react`) honoring `prefers-reduced-motion`
- **Charts:** Recharts + Visx / D3 modules (lazy loaded per section)
- **State & Storage:** Zustand + LZ-String + IndexedDB (`idb-keyval`)
- **Worker & Decompression:** fflate (zip-bomb protected) + PapaParse + Comlink

### Supply Chain Hygiene
- All dependencies must be pinned to exact stable versions published at least 14 days prior.
- Never introduce dependencies with active CVEs. Run `npm audit` prior to opening a PR.

---

## 3. Workflow & Conventional Commits

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
- `feat(scope): ...` for new features
- `fix(scope): ...` for bug fixes
- `test(scope): ...` for adding or improving tests
- `docs(scope): ...` for documentation
- `refactor(scope): ...` for refactoring without behavior changes

Keep commits atomic: one logical change per commit.

---

## 4. Verification Suite

Before submitting a pull request, ensure all gates pass:

```bash
# Typecheck
npm run typecheck

# Linting
npm run lint

# Automated Vitest test suite
npm run test

# Production build
npm run build

# Dependency security audit
npm audit
```

---

## 5. Submitting Pull Requests

1. Fork the repository and create your branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Commit your changes following conventional commit syntax.
3. Push to your branch and open a Pull Request against `main`.
4. Provide a clear description of your changes, referencing any relevant issues.
