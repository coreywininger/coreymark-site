---
title: "DailyBriefing v2: Removing Google OAuth"
description: "DailyBriefing used Google OAuth for calendar and email. The tokens kept expiring. Here's what replaced them, and why it's more honest for personal automation."
pubDate: 2026-05-19
pillar: ops
tags: [infrastructure, ai, automation]
featured: false
draft: false
project: dailybriefing
---

A few weeks after I shipped [DailyBriefing](https://coreymark.com/projects/dailybriefing/) — the weekday morning briefing that emails me weather, calendar, and tasks at 7 AM — the emails stopped. The Google OAuth refresh token had been revoked.

I re-ran the token generation flow, updated the GitHub Secret, and it worked again. Three weeks later it happened again.

The original post covers how to set up the OAuth approach. This one is about why I ripped it out.

---

## The problem with OAuth in personal automation

OAuth2 is the right choice for production applications with multiple users. For a single-user personal tool running on a cron, it creates a class of failure mode that doesn't appear in any quickstart guide: refresh tokens that expire on schedules you don't control.

Google's OAuth apps in Testing mode are the specific culprit. When your app is in Testing mode — which is the correct choice for a personal tool you have no intention of submitting for Google's verification review — the refresh token can be revoked for several reasons: exceeding the per-client token limit, extended periods of low activity, and policy changes Google can make at any time. The app was running fine daily, and the tokens still got revoked.

The deeper issue is that "testing mode" implies something temporary. For a personal tool you want running indefinitely, you're building on a foundation that Google designed to be unstable.

---

## What I replaced it with

The original code used Google OAuth2 for three things:

| Use | OAuth scope | Replacement |
|---|---|---|
| Read calendar events | `calendar.readonly` | iCal secret URL |
| Read inbox highlights | `gmail.readonly` | Dropped entirely |
| Send the briefing email | `gmail.send` | SMTP + App Password |

**Calendar → iCal secret URLs**

Every Google Calendar has a "Secret address in iCal format" buried in its settings page. It's a static URL with an embedded secret token. You fetch it with a plain GET request, parse the response with the `icalendar` Python library, and you're done. No OAuth client. No refresh token. No expiration. The URL only resets if you manually click "Reset" in Calendar settings.

The `recurring-ical-events` library handles the part that makes this non-trivial: expanding recurring events. A bare iCal parse will show you the event template but not the individual occurrences. The library expands them for a given date, so weekly standups and monthly reviews show up correctly.

**Email highlights → dropped**

I cut the email highlights section. It was the section that required `gmail.readonly` — the most restricted scope in the stack, and the one that would have required the heaviest verification review if I'd ever tried to move the app out of Testing mode. More honestly: the section showed me emails I was about to open in Gmail anyway. It was solving a problem I didn't have.

**Sending → Gmail SMTP + App Password**

Gmail App Passwords are a 16-character credential generated in Google Account security settings. They authenticate over standard SMTP using Python's built-in `smtplib`. No library dependency, no token rotation, no expiration as long as 2-Step Verification stays active on the account — which it will.

The replacement is six lines of Python. The original Gmail API send path was forty.

---

## The resulting system

```
GitHub Actions (weekday cron, 7 AM ET)
        |
        └── briefing.py
                ├── OpenWeatherMap API    → weather
                ├── Google Calendar iCal  → events (no OAuth)
                ├── GitHub Gist API       → TASKS.md
                ├── Anthropic API         → daily greeting
                └── Gmail SMTP            → HTML email (no OAuth)
```

Every secret in GitHub Actions is now a static key. None of them expire on a schedule. The system will run until one of the upstream services changes its API in a breaking way, which is a much more honest failure mode for personal automation.

One gotcha worth calling out: Google Calendar settings show two iCal URLs that look almost identical. The one you want is **"Secret address in iCal format"** — it has `private-` followed by a long random token in the path (`/private-a1b2c3.../basic.ics`). The other one, "Public URL to this calendar," ends in `/public/basic.ics` and returns a 404 unless you've made the calendar public. They're listed a few pixels apart and easy to mix up.

---

## When OAuth is still the right call

None of this means OAuth2 is bad. It means it's the right tool for applications where users authorize your app — not for headless personal tools where you are the only user and the only operator.

iCal URLs and App Passwords exist precisely for this use case. They're lower-security in a narrow sense: an iCal URL grants calendar read access to anyone with the URL, and an App Password grants account access to anyone with the string. For a tool that runs on GitHub Actions with secrets scoped to a private repo, that tradeoff is fine. For a multi-user app, it's not.

The [original playbook post](https://coreymark.com/blog/claude-plus-github-actions-integration-playbook/) is still accurate for cases where OAuth is the right choice. If you're building something where users authorize your app, that's the path. If you're building a personal tool for one inbox, start here instead.

---

The repo is at [github.com/coreywininger/DailyBriefing](https://github.com/coreywininger/DailyBriefing). The README has the updated setup steps for the v2 approach.
