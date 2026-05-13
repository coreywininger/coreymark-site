---
title: "The change management process nobody actually uses"
description: "Most IT orgs have solid change control on paper. In practice, it tends to collapse at exactly the moments it's supposed to prevent."
pubDate: 2026-05-13
pillar: ops
draft: false
---

The first time I sat in a change advisory board meeting where the board approved a change nobody in the room understood, I thought it was a one-time problem. A few years later, I had learned it was the norm.

The CAB had reviewed the ticket, asked a few clarifying questions that got vague answers, and approved anyway — because the alternative was holding up a change that had executive sponsorship and a deadline attached. Nobody was comfortable saying they didn't understand it. Everyone was more comfortable pretending they did.

This is not a process failure. This is a people failure dressed up in process clothing. And it's almost universal.

---

## What change management is actually for

Most change processes are sold — to leadership, to auditors, to the team — as a mechanism for preventing bad outcomes. If we review every change, we catch the bad ones before they break production.

That's not wrong, exactly. But it's incomplete. And the incomplete version is where most processes get designed to fail.

Change management at its best does one thing: makes the blast radius predictable. It doesn't prevent all failures — nothing does. It ensures that when something goes wrong, you know what changed, when it changed, who owns it, and how to reverse it. That's the actual value proposition. Prevention is a side effect of good process, not the goal.

When you design a change process around prevention, you end up with rubber-stamp approvals and checkbox compliance. When you design it around blast-radius control, you end up with something people actually use.

---

## Where it breaks

The emergency change procedure is the first casualty. Most orgs have one — a fast-track path for unplanned, urgent changes that bypasses the normal review cycle. The intent is sound. In practice, it becomes the path of least resistance for anything with enough pressure behind it.

I've seen "emergency" used for changes that were planned for two weeks and just ran out of runway. The definition expands to match the deadline. And once the standard process gets bypassed enough times, the cultural signal is clear: process is for when things aren't urgent. When they are, you call it an emergency and move.

The second breakdown is risk-rating. Most processes ask you to rate your change as low, medium, or high risk. In practice, high risk means more process — more approvals, more review cycles, more time. So changes drift toward low and medium regardless of their actual risk profile. The process trains people to underreport.

The third is the CAB itself. A review board that's too large, meets too often, or reviews too many low-stakes changes becomes a rubber stamp by necessity. People stop engaging seriously because the volume doesn't allow for it. The board becomes a compliance gesture rather than a decision-making body.

None of this is novel. Every experienced IT leader has watched it happen. The honest question is whether your process accounts for how people actually behave under pressure, or whether it assumes they'll behave differently when it matters.

---

## What good looks like

The best change process I've seen was boring. That's the tell.

Changes were documented well enough that someone who didn't write them could execute a rollback — not in theory, but in practice, at 2 AM with the person who wrote the change unreachable. Rollback steps were tested, not assumed. Success criteria were defined before the change window opened, not after the change ran. The change owner knew exactly what "this worked" looked like, and so did whoever was on call.

The CAB was small, met less often than you'd expect, and spent its time on a short list of changes that were genuinely complex or high-blast-radius — not reviewing a queue of low-risk ticket updates to confirm they looked fine. The rest went through a lighter path with asynchronous review and an objection window. Anyone could raise a flag; most changes didn't need one.

High-pressure changes went through the same process as everything else — because the process was designed to be fast enough to actually use. The emergency path existed for genuine surprises, not for anything with a deadline attached.

The people running changes weren't more disciplined than average. The process was just designed around what actually happens, not what the textbook assumes.

---

## The operator's posture

Change management earns its credibility in the moments when something goes wrong — not in the meetings where everything went right. The CAB that approved what it didn't understand will be invisible in the postmortem. The missing rollback procedure won't be.

A process that runs smoothly on Tuesday afternoons and falls apart at 2 AM on a Friday isn't a change process. It's documentation.

The test isn't whether your CAB approvals are logged or your risk ratings are filled in. It's whether the on-call engineer — alone, under pressure, with the person who wrote the change unreachable — has everything they need to know what happened and how to undo it.

If the answer depends on who's on call, the process still has work to do.
