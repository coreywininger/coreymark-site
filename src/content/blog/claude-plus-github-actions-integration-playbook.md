---
title: "Claude + GitHub Actions: an integration playbook"
description: "How to stand up a scheduled, AI-assisted job on infrastructure that costs nothing at rest — and the pitfalls that don't show up in the quickstarts."
pubDate: 2026-04-22
pillar: ai
tags: [ai, infrastructure, playbook]
featured: false
draft: false
project: dailybriefing
---

> **Update — May 2026:** The DailyBriefing repo was redesigned to remove all Google OAuth dependencies. The pattern described in this post is still accurate for multi-user apps or any case where OAuth is genuinely the right tool. If you're building a single-user personal automation, the follow-up post — [DailyBriefing v2: Removing Google OAuth](/blog/dailybriefing-v2-removing-oauth/) — covers what replaced it and why.

Most guides for "send yourself a daily email" stop at the part where everything works on a demo account with a hardcoded API key. The interesting part — the part that decides whether the system still runs six months from now on infrastructure you trust — starts right after that.

This post is that part.

This is a playbook for wiring up a scheduled, AI-assisted job on free-tier infrastructure that talks to Google services, generates content with Claude, and sends a styled HTML email on a cron. The reference implementation is my DailyBriefing system: a weekday 7 AM Eastern briefing that pulls weather, calendar, tasks, and email highlights into a single message. It runs entirely on GitHub Actions — no server, no local machine dependency, no babysitting — and costs zero dollars at rest.

A narrative version of the build — *what it felt like to do this alongside AI* — is a planned companion piece. This one is the operator's reference. If you want the replicable recipe with the pitfalls that cost me real time called out where they actually appear, keep reading.

---

## The shape of the system

Before the steps, the mental model.

A GitHub Actions workflow runs on a cron schedule. It installs Python dependencies, authenticates to Google using a stored OAuth2 refresh token, calls the APIs it needs, renders an HTML email, and sends it through Gmail. Secrets live in GitHub; they never live in code. The workflow also supports on-demand runs through `workflow_dispatch`, which matters more than it sounds — you cannot debug a cron you cannot fire manually.

Nothing in that description is novel. What makes the integration interesting is how many small decisions hide inside it, and which ones will bite you later if you pick the wrong path now. The steps below walk the whole path in order.

---

## Step 1 — Google Cloud project and consent screen

Create a Google Cloud project with the specific APIs your script will touch. For DailyBriefing, that's the Google Calendar API and the Gmail API. Create the project, enable both APIs from the API Library, then configure the OAuth consent screen.

Pick **External** for user type and leave the app in **Testing** mode. Testing mode is the right answer when you — and only you — are the user. The alternative, getting the app verified for production use, is a real multi-week process that serves no purpose when the audience is one inbox.

Two gotchas live on this screen.

**Ineligible accounts when adding test users.** When you add yourself as a test user, Google will sometimes throw an "ineligible account" error *even though* the account appears in the list below. This is a UI bug in the match logic — the comparison is case-insensitive but the display is case-sensitive, so a perfectly valid entry looks rejected. If the account is in the list, you're fine. Close the dialog and move on.

**The unverified-app warning.** The first time you run the OAuth flow, Google will show a red "Google hasn't verified this app" screen. You have to click Advanced → "Go to [app name] (unsafe)" to continue. This is expected behavior for apps in Testing mode. It will not appear again after the initial grant.

The scopes you grant on the consent screen are the API permissions your script will eventually receive. For this pattern, three are enough:

- `calendar.readonly` — read events from any calendar the user has access to
- `gmail.send` — send messages
- `gmail.readonly` — scan recent email for the highlights section

Scope classification matters for your future self. Google sorts scopes into non-sensitive, sensitive, and restricted tiers. In Testing mode you can use any of them freely. The moment you try to move an app out of Testing, restricted scopes — `gmail.readonly` is one — require the heaviest verification review. Many patterns that look like they need `gmail.readonly` don't actually need it. If you can avoid it, do. It's the scope that buys you the most friction if your use case ever grows past a single user.

---

## Step 2 — OAuth2 credentials and refresh token

Under Credentials → Create Credentials → OAuth Client ID, choose **Desktop application** as the type. Download the client JSON. This file holds the client ID and client secret. Both values will eventually become GitHub Secrets; neither ever needs to be checked in.

From the client credentials you generate a **refresh token** — the long-lived piece of state that lets your script authenticate without a human in the loop. The standard path is to run `google-auth-oauthlib` locally one time, using `InstalledAppFlow.run_local_server()`. It opens a browser, you grant consent, and the library hands you back a refresh token that you save.

That refresh token is what makes a scheduled job work. Access tokens expire in an hour; refresh tokens don't expire on a clock — they expire when something revokes them. Three things revoke them:

1. **Extended inactivity** on an app in Testing mode. Google reserves the right to invalidate refresh tokens for test-mode apps that haven't been used in a long time. For a daily cron, this never trips. For a job that runs twice a year, it's the silent killer.
2. **Exceeding the per-client refresh-token limit.** Generate too many refresh tokens against the same OAuth client and Google will invalidate the oldest. This one can sneak up on you during debugging if you're regenerating the token each time something fails.
3. **A scope change.** If you add or remove a scope after the token was issued, that token becomes invalid. You'll have to run the consent flow again.

The practical takeaway is pin your scopes before you generate the token for real, store the token in GitHub Secrets, and leave it alone.

---

## Step 3 — GitHub Secrets, and how to set them safely

Every credential your script needs becomes a GitHub repository secret. For DailyBriefing that's nine of them: client ID, client secret, refresh token, an OpenWeatherMap key, a Gmail address, a family calendar ID, a Gist ID, a personal access token with `gist` scope for reading the task list, and an optional Anthropic API key for the AI-generated greeting. The Gist ID is the outlier — environment-specific rather than literally secret — but Secrets is still the right home: the clean boundary is *constants in code, deployment-specific values out of it*.

A working rule: if a value is either secret or environment-specific, it is a GitHub Secret. Keep constants in code and secrets out of it. That boundary is most of the discipline.

Three specific things to get right here.

**`.gitignore` before the first commit.** If you're using any local file during development that holds credentials — a `.env`, a `client_secret.json`, a `token.pickle` — it goes into `.gitignore` before your first `git add`. Once a secret is in history, removing it is a separate and painful exercise involving rewritten commits and rotated credentials. Do not learn this the hard way.

**App Passwords are a trap for automated systems.** Gmail App Passwords let you SMTP against an account with a static sixteen-character password. They're quick, they work, and they're the wrong answer for any automation you intend to keep running. OAuth2 with the Gmail API gives you scoped permissions, revocable tokens, and no static password sitting in a secret store waiting to leak. Use App Passwords for a fifteen-minute prototype if you must — move to OAuth2 before anything real ships.

**The `gh secret set --body -` trap.** Worth pinning because it's a silent failure. If you pipe a value into `gh secret set` and try to use `--body -` to read from standard input, the `gh` CLI stores the literal string `-` as the secret's value. The pipe is ignored. The fix is to either omit `--body` entirely — which makes `gh` read stdin by default — or pass the value explicitly with `--body "$(command)"`. Any time authentication fails with an "invalid credential" error after setting a secret from the CLI, check the character count of the secret in the GitHub UI before you check anything else.

One bonus pitfall, from wiring Claude into the greeting feature: **the Anthropic API key must be generated after funding the account.** A key created against an unfunded account will silently fail authentication even after you later add credits. If your AI-generated content falls back to a template unexpectedly, regenerate the key in the Anthropic console and update the GitHub Secret.

---

## Step 4 — The workflow itself

The GitHub Actions workflow is small. Its job is to install dependencies, inject secrets as environment variables, and run one Python script.

The cron schedule is the piece that looks simple but isn't:

```yaml
schedule:
  - cron: '0 11 * * 1-5'   # 7 AM Eastern during EDT
```

GitHub Actions cron expressions run in UTC. Always. You cannot set a timezone on a workflow cron. Eastern Daylight Time is UTC−4; Eastern Standard Time is UTC−5. A single cron expression cannot honor both.

Your three options:

1. Maintain two scheduled workflows — one for EDT, one for EST — each of which runs its cron year-round but short-circuits on the first step unless the current date falls inside its zone's window. This is the right answer if a consistent 7 AM local delivery matters to you. It's what I recommend.
2. Run the workflow earlier than you actually want and have the script itself self-gate on local time before doing any real work. Cheap to set up, but the workflow log shows twice as many runs.
3. Pick one zone and accept a one-hour slip twice a year. Easiest to implement. Works if you genuinely don't care about the DST shift.

None of these is elegant. All of them are fine. The two-workflow pattern is the one worth the extra fifteen minutes of setup.

Two more details in the workflow matter more than they look.

**Always add `workflow_dispatch`.** A manual trigger alongside the cron is a one-line addition that saves hours. You will want to test the job outside its schedule. You will want to fire it after fixing a bug without waiting for tomorrow morning. Put the button there on day one.

**Secrets become environment variables at the job level.** Reference them in the YAML as `env:` keys mapped to `${{ secrets.MY_KEY }}`, and the Python script reads them with `os.environ`. No secret ever appears in stdout, in logs, or in error traces — GitHub automatically masks any matching value. If your logs are showing `***` in a suspicious place, that's the masker working as intended, not a bug.

---

## The script, in broad strokes

The Python script itself is unremarkable, which is exactly the point. A deliberately boring script running on a deliberately boring schedule is what gives this pattern its reliability.

Structurally:

1. Load secrets from `os.environ` into module-level constants. Fail fast and loud if a required secret is missing.
2. Build a Google credentials object from the refresh token using `google.oauth2.credentials.Credentials`. The refresh flow is automatic after that.
3. Call each API with its client library — Calendar, Gmail — and shape the responses into dictionaries your template code can render.
4. Render the HTML email. For reach across email clients, use table-based layout with inline styles. Flexbox and grid don't render reliably in Outlook. This is not 2024 advice, it's 2026 advice, because Outlook's email renderer still isn't the same engine as Outlook's browser.
5. Send through the Gmail API using `MIMEMultipart("alternative")` with both a `text/plain` and `text/html` part. *Do not* send a bare `text/html` — Gmail will sometimes silently downgrade a bare HTML message to plain text for self-sent mail, and the symptom looks like a styling bug rather than a MIME problem. Bcc yourself during testing so you can see what the recipient actually sees.

One environment-specific note worth pinning.

**Gmail will show a "Be careful with this message" banner on self-sent mail.** This is cosmetic. The email is legitimate. Create a Gmail filter for the briefing subject line with "Never send to Spam" and "Mark as important" and the banner goes away.

---

## The model call itself

The AI piece of this system is small by design: one API call per run, a short prompt, a graceful fallback to a templated greeting if the call fails. Three patterns worth naming.

**Treat the model call as optional.** The briefing is valuable without the AI-generated greeting. Wrap the call in a try/except that swaps in a static fallback on any failure. A scheduled job should never die because a model endpoint had a bad minute.

**Budget tokens like any other resource.** Unattended jobs don't notice runaway prompts or retry loops, and a scheduled task can quietly burn credits for a week before anyone looks. Cap max output tokens in the request, keep the prompt short and structured, and don't retry silently — fail to the fallback.

**The prompt is configuration.** Keep it in the script, version it alongside the code, and log the full prompt-and-response pair for a few runs after any change. Silent drift in model output looks exactly like a bug in your rendering code until you go looking.

---

## What this pattern is good for

The reason this architecture is worth learning is that it generalizes well past one morning email. Any scheduled job that needs to hit one or more of your own Google services, touch a handful of external APIs, and deliver output somewhere — a Slack message, a status page, a CSV upload, a digest to a distribution list — can be built on those same four pillars.

It's a strong fit for personal or low-stakes team automations where you want reliability without the operational overhead of real infrastructure. No server to patch, no VM to restart, no cloud bill to watch. GitHub Actions gives you 2,000 free minutes per month on free accounts for private repos — public repos get unlimited minutes — and a well-written script like this runs in well under a minute per invocation. You can build it and forget it.

It's the wrong pattern for:

- **Anything requiring sub-minute latency.** Cron resolution on GitHub Actions is minutes, and scheduled workflows often run a few minutes late under load.
- **High-frequency polling.** If you'd hit the cron fifty times a day, you're building something that wants a real backend.
- **Anything multi-tenant.** The OAuth model here assumes one user who owns all the credentials.
- **Systems where silent failure is unacceptable.** If the workflow fails, GitHub emails you a terse "workflow failed" notice. For anything load-bearing, you want observability beyond that — at minimum, a check-in ping to a dead-man's-switch service.

Those aren't flaws. They're the trade you're making in exchange for zero operational overhead.

---

## Where the AI earned its keep — and where I stayed in the loop

Credit where it's due: the AI partnership made this faster at every step. The workflow YAML, the Python script, the HTML email template, the MIME structure — I typed almost none of it. What I did was make the decisions, verify the outputs, and catch the two or three places where a plausible-looking answer from the AI was subtly wrong for the specific tool in play.

Every one of the pitfalls in this post is a place where AI produced something that looked right by convention and turned out to be wrong in practice. The scope review in Step 1, the token-revocation conditions in Step 2, the `gh secret set` stdin trap in Step 3, the cron-timezone reality and the `MIMEMultipart` requirement in Step 4 — each of those would have been a silent-failure mode in a less verified build. The defense is human judgment in the loop, with verification built into the rhythm rather than bolted on at the end.

That's the operator's posture on AI for automation work — not skepticism, not surrender, engagement — and it's what keeps a system like this honest over time. A narrative version of the build is a planned companion piece; the replicable recipe is above.
