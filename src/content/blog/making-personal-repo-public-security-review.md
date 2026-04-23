---
title: "Making a personal repo public: a 30-minute AI-assisted security review"
description: "What a handoff-driven review actually found on my DailyBriefing repo — and the day-one discipline that decided the outcome before the review started."
pubDate: 2026-04-23
pillar: ai
tags: [ai, infrastructure, security-review]
featured: false
draft: false
project: dailybriefing
---

The week my personal site launched, I had a dead link. The blog had a post about DailyBriefing — the GitHub Actions automation that emails me my day every weekday at 7 AM — but the DailyBriefing repo itself was private. The "see the full code" link on the post went nowhere useful.

I wanted the repo public. Before flipping that switch, I needed to be confident the repo didn't contain a credential that had been checked in and forgotten, a hardcoded secret that had worked its way into a commit, or an internal reference that shouldn't leak. Private-to-public is a one-way door — you can flip it back, but anything in the repo during the public window is already in the hands of anyone who cloned it.

The review took 30 minutes. Most of that was me reading the report at the end.

Here's how it worked, what got found, what didn't get found, and — most importantly — the parts that generalize to any repo you're about to make public.

---

## The 30-minute workflow

I split the work across two AI surfaces.

**One surface drafted the handoff.** A handoff file is a self-contained brief for another agent: what to do, what not to do, where the files live. I wrote the structure in the same session where my planning context already lived — the project background, the working rules, the voice guidelines. The handoff ended up around 350 lines. State verification first, then a security sweep on HEAD plus full history, then a PII sweep, then workflow review, then `.gitignore` and repo-content audit, then the report format. Hard guardrails up top: do not flip visibility, do not rewrite history, do not force-push.

**A second surface executed the handoff against the live repo.** It ran inside my editor, with `gh` CLI authenticated. It cloned the repo to a path outside my notes workspace so the two didn't mingle, ran `gitleaks` across all commits, manually grepped for credential patterns I'd listed, checked for files that should never have existed (`.env`, `credentials.json`, `token.json`, `service_account*.json`, `*.pem`), audited the workflow YAML for secret-handling hygiene, swept for PII, and produced a written report.

**I reviewed the report and flipped the switch.** The verdict was **Green** — two low-severity findings, both fixed in a PR on a separate `public-readiness` branch. I reviewed the diff, merged, ran the workflow once to verify nothing broke, and flipped the repo visibility.

The handoff-first pattern is the key. AI agents drift. A 30-minute unsupervised session on a repo you care about is a bad idea. A 30-minute session on a precise brief, with hard guardrails and a written report at the end, is a different thing entirely.

---

## What got found

Two findings, both low severity, both fixed on the readiness branch before the repo went public.

**Hardcoded Gist ID.** The script pulled my task list from a private GitHub Gist; somewhere during a recent edit, the Gist ID had ended up inlined into the URL in `briefing.py` instead of being read from the environment variable already loaded a few hundred lines earlier. The Gist is behind a token, so the ID alone doesn't grant access. But it's unnecessary information leakage — the kind of thing that could correlate to other data if someone had it. Replaced with `{GIST_ID}` sourced from the env var. Ten-character fix.

**Internal-workspace reference in the README.** The old README had a line pointing readers to "the full technical documentation" in a specific internal notes workspace — a directory on my Mac that has no business being referenced from a public repo. Not a secret leak, but a mental-model leak: a reader could tell I kept infrastructure docs in a separate internal repo they didn't have access to, which is exactly the kind of breadcrumb a serious recon effort follows. The README was rewritten for a public audience: what it does, how to set it up, where the deep walkthrough lives.

Everything else came up clean. Zero secrets at HEAD. Zero secrets in full history. No sensitive files ever existed in any commit.

---

## What didn't get found — and why

The more interesting finding is the absence of findings. Most repos that have been on a personal machine for six months do not come up this clean. Mine did, because of four choices made on day one — none of them heroic, all of them worth naming.

**OAuth2 from the start, not Gmail App Passwords.** Gmail App Passwords are a sixteen-character static password you SMTP against a Gmail account. They're the three-minute path to a working mail script. They're also a static credential sitting in a secret store waiting to leak. OAuth2 with the Gmail API gives you scoped permissions, revocable tokens, and no long-lived password in a variable. The setup cost is an hour longer; the security-review cost is zero instead of *"did an App Password ever get pasted into a test file?"*

**GitHub Secrets from commit one.** The script has nine credentials. Every one of them has lived in GitHub Secrets since the first run. No local `.env`, no `config.json`, no "I'll move it to secrets later." The rule was simple: if it's secret or environment-specific, it's a Secret, and it never touches the code. That rule alone prevents the single most common private-to-public finding — a `.env` file committed once, added to `.gitignore` later, still sitting in history.

**`.gitignore` ambition ahead of actual risk.** Even before the repo was anywhere near public, the gitignore covered credentials patterns, tokens, virtual environments, editor configs, and OS junk. Not because public-readiness was on the roadmap — because getting in the habit of ignoring categories of files rather than individual files means the habit survives a moment of tired-at-midnight copy-paste.

**Workflow hygiene.** No `echo` on secret variables, no `set -x` on secret-bearing steps, no `upload-artifact` on env dumps. GitHub Actions masks known secret values in logs automatically, but only if they were introduced through `secrets.` cleanly — once you reconstruct or decode one, masking breaks. Keeping the workflow boring — environment variables in, one script executed, exit — means the masking layer is actually protecting you.

None of this is novel. It's the pre-public discipline any serious engineer would recognize. The point is that the AI-assisted review found what the discipline left behind, not what the discipline prevented. The review is the *check*; the discipline is the *substance*.

---

## The reusable checklist

If you want to reproduce this pattern on your own repo, the shape is:

- **State verification** — clean working tree, known branches, no unfamiliar commits.
- **Secret scan at HEAD** — `gitleaks detect --source . --redact` plus manual grep for the credential patterns you actually use (Anthropic, OpenAI, Google, AWS, GitHub tokens, private key headers).
- **Secret scan across full history** — `gitleaks detect --log-opts="--all"`. This is the load-bearing scan. Anything only in history is the stuff history-rewrite conversations are made of.
- **File-existence sweep** — `git log --all --full-history -- '.env' '.env.*' 'credentials.json' 'client_secret*.json' 'token.json' '*.pem' '*.key'`. Files that shouldn't exist are often where the secrets are.
- **Workflow secret-handling** — no hardcoded secrets, no echo of secret vars, no artifact uploads of env dumps, `permissions:` scoped to what's needed.
- **PII sweep** — personal email, calendar IDs, phone, absolute paths to personal machines, family names, internal-workspace references.
- **`.gitignore` audit** — credentials, tokens, venvs, editor configs, OS junk. Add `.env.example` to document required variables without values.
- **Repo-content gap** — README rewritten for public audience, LICENSE present, no OSS-overhead files unless the repo is actually taking contributions.
- **Written verdict** — Green, Yellow (safe with specific follow-ups), or Red (history rewrite required).

The whole thing runs in under half an hour on a small repo.

---

## When your repo isn't this clean

DailyBriefing was Green. That's not the norm.

If a history scan surfaces a real secret, the conversation changes. History rewrite is a different kind of work — `git filter-repo` is the modern tool of choice, BFG is the faster-but-less-precise older one, and both require coordinating with anyone else who has the repo cloned. Any secret you rewrite out of history must also be rotated — the old value is already on whoever's laptop. The branch-protection and force-push story that follows is the actual cleanup, and it takes longer than the review did.

There's a version of this post where I could tell you AI can do that cleanup too. That's not the post. History rewrite on a real repo is a decision you make with your eyes open, with a tested plan, and with explicit authorization. The AI's job in that scenario is to draft the commands you review carefully before running. Not execute them.

---

## The operator's posture, for this kind of work

The 30-minute review worked because the repo was clean before the review started. AI accelerated the orchestration — a tool configured correctly, a written brief executed faithfully, a report readable in five minutes. It did not create the hygiene that made the repo safe to publish. That was boring, day-one discipline.

Verification and substance are separate things. A review that keeps confusing them ships repos that were never actually safe to begin with. A review that keeps them separate — AI for the orchestration, human judgment for the substance — is one you can trust.

This post is the third in a short series on the DailyBriefing build. The [field report on shipping coreymark.com](https://coreymark.com/blog/shipping-a-site-with-ai-field-report) covered what building with AI actually feels like; the [integration playbook](https://coreymark.com/blog/claude-plus-github-actions-integration-playbook) covered the replicable recipe. This one covers the last step: flipping the switch safely.

The DailyBriefing repo is at [github.com/coreywininger/DailyBriefing](https://github.com/coreywininger/DailyBriefing). Sharing as a reference pattern, not accepting contributions.
