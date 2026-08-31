---
description: >
  How to answer questions about my current work using the bot MCP server. Applies
  everywhere, because "what should I do next" is not a question about any one file.
applyTo: "**"
---

# Answering questions about my work

There is an MCP server called `bot` in this workspace. It reads a local mirror of my Jira
tickets, my pull requests and my local branches.

## Use it instead of guessing

When I ask any of these, call a tool rather than reasoning from memory or from the repository:

| I ask | Call |
| --- | --- |
| what should I do next, what is stuck, what needs a push | `bot_status` |
| what is waiting on me | `bot_status` with `owner: "me"` |
| what am I waiting on someone else for | `bot_status` with `owner: "them"` |
| what was WS-1234, which PR touched X, is there a ticket for Y | `bot_find` |

## Report the mirror's age

Every answer carries when the mirror last synced. Pass it on. A quiet day and a sync that
stopped running three days ago produce identical output otherwise, and I will act on the
wrong one.

If it says `never synced`, say so and suggest the `bot: refresh mirror` task rather than
presenting an empty result as good news.

## What it will not do

The server is read-only. It cannot merge a pull request or resolve a ticket, and there is no
tool that will. Those happen from the dashboard (`bot serve`), behind a button I press. If a
next move needs one of them, say which button and stop — do not look for another route to the
same effect.
