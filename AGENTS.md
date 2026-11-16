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

### Handoff to Youssef Hany

When the user asks Youssef Hany to review or take a task, use GitHub login `YoussefHanyy`. On a pull request targeting `development`:

1. Put the exact task, acceptance criteria, changed requirements, and checks under **Handoff to Youssef** in the pull request body.
2. Add the `agent-handoff` label, request review from `YoussefHanyy`, and comment with `@YoussefHanyy` plus a short, actionable summary pointing to the pull request body.
3. Give the user the pull request link and report whether Youssef has reviewed it. A GitHub notification starts his Codex agent only if he configures an event task in his account.

If the user explicitly directs an immediate merge, follow that direction and make clear that Youssef's review is after the merge.

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
