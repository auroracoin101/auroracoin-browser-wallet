# Auroracoin Git Primer 101

A short, practical guide to contributing to the Auroracoin Browser Wallet.
It covers the workflow that keeps PRs small, reviewable, and easy to merge.

---

## 1. Fork the *canonical* repository

Always fork from the official repo, not from any other copy you may find:

> **Canonical:** https://github.com/auroracoin101/auroracoin-browser-wallet

GitHub keeps a permanent record of which repo a fork came from, and pull
requests default to targeting that upstream. If you fork a fork (or a
standalone copy), your PRs will default to the wrong repository and wrong
base branch, and maintainers will see a confusing history.

**Gotcha:** before creating a PR, always check the top of the "Open a pull
request" page: the **base repository** must be
`auroracoin101/auroracoin-browser-wallet` and the **base branch** must be
`main` — not `master`, and not anyone else's repo. If it's wrong, use the
dropdowns to fix it before clicking "Create".

## 2. Clone your fork, and set the canonical repo as `upstream`

```bash
git clone https://github.com/YOUR-USERNAME/auroracoin-browser-wallet.git
cd auroracoin-browser-wallet
git remote add upstream https://github.com/auroracoin101/auroracoin-browser-wallet.git
```

Keep `upstream` synced so you always start from the latest code:

```bash
git fetch upstream
```

## 3. One branch = one purpose

This is the single most important practice: **each branch should address one
thing**. A branch named after its purpose makes review and merging far
easier:

| Branch name | Purpose |
|---|---|
| `fix/wif-import` | Fix the T-prefix WIF import |
| `feat/theme-cycle` | Add theme cycling |
| `docs/faq` | Documentation updates |

Suggested prefixes: `feat/` (new feature), `fix/` (bug fix),
`docs/` (documentation), `chore/` (maintenance).

Start every branch from a fresh `main`:

```bash
git checkout main
git merge --ff-only upstream/main   # sync local main with the canonical repo
git checkout -b fix/whatever        # then branch
```

### Why single-minded branches matter

- They can be reviewed and merged independently, in any order
- If one feature has a problem, it doesn't hold up the others
- A small PR (ideally under a few hundred changed lines) gets merged quickly;
  a giant "several unrelated changes" PR sits unreviewed
- If something goes wrong after release, the culprit commit is easy to find
  and, if needed, revert on its own

If you find yourself fixing a typo while working on a feature, put the typo
fix on its own tiny branch — don't mix it in.

## 4. Commit with clear messages

The first line should complete the sentence *"this commit will…"*:

```
Add BIP38 sweep to tools menu
Fix T-prefix WIF import rejection
Move wallet storage from sync to local
```

Subject line in the imperative, under ~50 characters; body (optional) explains
*why*, not *what*.

## 5. Line endings

The repo has a `.gitattributes` that normalizes line endings (LF). Don't fight
it — just don't commit files with editor-added CRLF. If you're on Windows and
see every file flagged as modified after a pull, run:

```bash
git add --renormalize .
git status   # should be clean
```

## 6. Open the PR

Push your branch and open a pull request:

```bash
git push -u origin fix/whatever
```

Then on GitHub, from your fork, click "Contribute → Open pull request" —
**and verify the base repository and branch (Step 1's gotcha) before
creating.** Or use the explicit compare URL, which sets them for you:

```
https://github.com/auroracoin101/auroracoin-browser-wallet/compare/main...YOUR-USERNAME:fix/whatever?expand=1
```

In the PR description: what it does, why it's needed, and how you tested it.
Link any related issue with `Fixes #12` so it auto-closes on merge.

## 7. Keep your branch current — and expect merge commits

If `main` moves while your PR is open, GitHub may show conflicts. Sync and
merge the latest `main` into your branch:

```bash
git fetch upstream
git merge upstream/main
# resolve any conflicts, test, then:
git push
```

A merge commit in your feature branch is normal and fine. (Note: GitHub's
"Rebase and merge" button cannot process branches containing merge commits —
that's a button limitation, not a repo problem.)

## 8. Test before you push

Before opening a PR, load the extension (`chrome://extensions` →
"Load unpacked" → point at the repo folder) and exercise what you changed.
A PR that says "tested: loaded wallet, sent a small tx, confirmed balance
updated" gets merged much faster than one that doesn't.

## Quick reference

```bash
# start
git fetch upstream
git checkout main && git merge --ff-only upstream/main
git checkout -b fix/one-thing

# finish
git push -u origin fix/one-thing
# open PR with base = auroracoin101/auroracoin-browser-wallet, branch = main
```

Happy hacking — and thank you for contributing! 🚀
