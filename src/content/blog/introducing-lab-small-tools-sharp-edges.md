---
title: "I built a /lab/ for the small IT tools I keep reaching for"
description: "A CIDR calculator, a cron decoder, and a JWT decoder. Single-purpose, client-side, free. Why I built mine instead of using the ones already out there."
pubDate: 2026-05-10
pillar: personal
tags: [lab, tools, personal, operator]
featured: false
draft: false
---

Every IT operator who has ever debugged SSO has paused at the moment of pasting a production JWT into jwt.io. The site promises it's client-side. The small voice in your head still says: this is somebody else's domain.

That's one of three small irritations I shipped tools for this weekend. They live at [coreymark.com/lab/](/lab/).

## What's in /lab/ today

**A CIDR calculator** at `/lab/subnet/`. IPv4 and IPv6, hosts-needed inverse, RFC 2317 reverse-DNS, Cisco ACL hint, equal-size split. The kind of thing you used to reach for `ipcalc` to do — readable, with copy buttons and shareable URLs.

**A cron decoder** at `/lab/cron/`. Plain-English description, field breakdown, last and next 5 fires around any pivot date, pitfall warnings (the day-of-month / day-of-week OR-not-AND gotcha; day-31 in months that don't have 31 days; February edge cases). Translates the same expression to systemd `OnCalendar`, Kubernetes `CronJob`, GitHub Actions, and AWS EventBridge — because the cron you wrote on a Linux box is rarely the cron you need on the platform you actually run on.

**A JWT decoder** at `/lab/jwt/`. Header, payload, signature, claims explained with hover tooltips for the things you actually want to know — what `iss` and `aud` and `oid` and `tid` mean. Live expiration countdown. Algorithm posture (`HS*` / `RS*` / `none`) called out. In-browser HMAC verification for `HS256/384/512`. Samples for Entra, Auth0, Okta, and AWS Cognito so you can see what each issuer's tokens look like before pasting your own. Nothing leaves the browser: no URL state, no localStorage history, no token content in the page title. The privacy posture is the point.

## Why /lab/ exists

None of these tools are novel. There are good free versions of all three on the open internet. The reason I built mine is that the existing options ask me to make small, recurring trade-offs I've stopped wanting to make.

A subnet calculator that's free until an ad surfaces mid-debug. A cron decoder that's elegant on `/etc/crontab` and useless when the schedule actually has to land in `spec.schedule` on a `CronJob`. A JWT decoder that promises it's client-side but is somebody else's domain.

The compounding annoyance of those small moments adds up to enough surface area that it's worth a `/lab/` section on a personal site. Three tools today; more as the irritations accumulate.

## The operator's posture

Tools like these aren't differentiation. Every IT person has built or bookmarked some version of them. What's worth saying out loud is the posture: the tool you reach for at 11 PM should belong to you, or at least to someone whose privacy posture you can audit. Pasting production secrets into anonymous web forms is one of those things we've collectively trained ourselves not to think about. Building three small tools doesn't undo that. But it does mean three fewer moments in my week where the small voice has to be ignored.

The lab is at [coreymark.com/lab/](/lab/). Bookmark what helps; ignore what doesn't. Sharp edges that earn their space, not a directory that grows for its own sake.
