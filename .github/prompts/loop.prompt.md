---
description: "Run a requirement — from a Jira ticket or straight from this prompt — as a verified loop: turn it into a failing spec, grind it green with a cheap model under a machine gate, then referee the diff and close it. A shortcut into the loop-architect agent — select loop-dispatcher in the mode picker instead; it is the documented entry and survives the whole job instead of one message."
mode: agent
model: ["GPT-6 Sol", "GPT-5.6 Terra"]
tools: ['read/readFile', 'read/problems', 'search/fileSearch', 'search/textSearch', 'search/listDirectory', 'search/codebase', 'search/changes', 'edit/createFile', 'edit/createDirectory', 'edit/editFiles', 'execute/runInTerminal', 'execute/getTerminalOutput', 'execute/killTerminal', 'todo']
argument-hint: "Your requirement and repo: a Jira key like WS-6673, or describe it in plain words"
---

# Run a loop

Read `.github/agents/loop-architect.agent.md` in full and follow its **Preflight** before any
phase, with `${input}` as its
argument. That file is the single source of truth for the phases. This prompt exists only so
`/loop` keeps working from whatever agent the user happens to be in.

Two things before you start:

1. **Mention the better route, once.** Say in one line: select `loop-dispatcher` in the mode
   picker next time — it hands the request to `loop-architect` on its pinned tier, routes
   consults and wrong-agent replies, and persists across phases, whereas a prompt governs
   only this message. Then carry on.
   Do not make them switch, and do not raise it again.
2. **You are the Architect.** The user supplies requirements, in prose, with adjectives in
   them. Turning those into an executable spec is your job and must never be handed back.
