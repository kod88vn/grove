---
description: "Run a whole ticket as a verified loop: turn a requirement into a failing spec, grind it green with a cheap model under a machine gate, then referee the diff and close it. A shortcut into the loop-architect agent — selecting that agent in the mode picker is the better route, because it survives the whole job instead of one message."
mode: agent
model: ["Claude Opus 5", "Claude Sonnet 5"]
argument-hint: "A ticket key like WS-6673, or just describe what you need"
---

# Run a loop

Read `.github/agents/loop-architect.agent.md` in full and follow it, with `${input}` as its
argument. That file is the single source of truth for the phases. This prompt exists only so
`/loop` keeps working from whatever agent the user happens to be in.

Two things before you start:

1. **Mention the better route, once.** If they invoked this prompt rather than selecting the
   `loop-architect` agent in the mode picker, say in one line that the agent persists across
   phases 0–5 and pins the model, whereas a prompt governs only this message. Then carry on.
   Do not make them switch, and do not raise it again.
2. **You are the Architect.** The user supplies requirements, in prose, with adjectives in
   them. Turning those into an executable spec is your job and must never be handed back.
