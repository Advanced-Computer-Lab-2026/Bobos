# AGENTS.md

Rules for contributing to this repository.

## Branching

- `main` — production-ready code only. Never push directly.
- `development` — integration branch for ongoing work. Feature branches merge here first.
- Feature branches: `feature/short-description`
- Bug fixes: `fix/short-description`
- Hotfixes (urgent prod fixes): `hotfix/short-description`

## Workflow

1. Create a branch off `development` (or `main` for hotfixes).
2. Make your changes in small, focused commits.
3. Push your branch and open a Pull Request.
4. Target the PR to `development` (not `main`), unless it's a hotfix.
5. Request at least 1 review before merging.
6. Squash-merge once approved and CI passes.
7. Delete the branch after merging.

## Commit messages

Use short, clear, present-tense messages:
```
fix: correct login validation bug
feat: add user profile page
docs: update setup instructions
refactor: simplify auth middleware
```

## Pull requests

- Keep PRs small and focused on one change.
- Write a clear description: what changed and why.
- Link related issues (e.g. `Closes #12`).
- Make sure all status checks pass before requesting review.
- Resolve all review comments before merging.

## Code style

- Follow the existing formatting/linting rules in the repo.
- Run the linter/formatter before committing.
- No commented-out code or debug prints in merged PRs.

## Releases

- Only `main` is deployed.
- Merges to `main` happen only from `development`, via a reviewed PR.
- Tag releases on `main` after merging.

## Rules of thumb

- Never force-push to `main` or `development`.
- Never commit secrets, API keys, or `.env` files.
- If unsure, open a draft PR early and ask for feedback.
