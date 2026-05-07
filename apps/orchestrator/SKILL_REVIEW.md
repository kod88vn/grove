# Orchestrator Skill Review & Audit

**Date**: May 7, 2026  
**Status**: Skills strengthened with mandatory tool enforcement

---

## Executive Summary

Reviewed 6 skills in `/apps/orchestrator/src/skills/`. Found **2 critical weaknesses** in fact-dependent skills where models could ignore instructions despite "required" verification. Applied fixes to mandate explicit tool usage and source citation.

---

## Skills Reviewed

### 1. ✅ **search_and_summarize** — FIXED
**Status**: Critical weakness → Enforced  
**Purpose**: Answer factual queries with trusted sources

**Issues Found**:
- Instructions told model to use `factual_lookup` but didn't enforce it
- Model could read instructions and return vague generic answers (demonstrated by Charlie Kirk failure)
- No validation that tool was actually called or sources cited
- Allowed "may have" statements without evidence

**Fixes Applied**:
- Restructured instructions as **MANDATORY PROCESS** with numbered, non-optional steps
- Added explicit tool call requirement: "CALL factual_lookup FIRST"
- Enforced citation: "EVERY CLAIM must be grounded in a cited source"
- Added failure mode: explicit rejection if tool returns no credible sources
- Minimum citation requirement: "at least 2 independent authoritative sources"
- Zero tolerance for fabrication: "It is better to say 'not found' than to guess"

**New Instructions Highlight**:
```
1. CALL factual_lookup FIRST (mandatory)
2. VALIDATE RESULTS (reject if no credible sources)
3. EXTRACT FACTS with source attribution
4. ASSESS CONFIDENCE (confirmed/disputed/rumored)
5. DISCLOSE GAPS explicitly
6. STRUCTURE RESPONSE with source citations on every claim
7. REJECT FABRICATION if sources don't support claim
VERIFICATION: Must cite 2+ independent authoritative sources
FAILURE MODE: Explicit reporting if lookup returns insufficient data
```

**Test Case**: Charlie Kirk incident
- **Before**: "no official news confirming negative incident" (vague, generic, no sources)
- **After**: Would return: "[Date, source] Kirk was assassinated September 10, 2025 at Utah Valley University, shot while on stage. [Source citations]. Confirmed across [outlets]. [Confidence assessments]"

---

### 2. ✅ **planning_reasoning** — FIXED
**Status**: Weak enforcement → Mandatory tool usage

**Purpose**: Handle complex reasoning with structured planning

**Issues Found**:
- Instruction "request tool-backed evidence when factual claims are made" is passive and vague
- Model has discretion to decide when factual claims exist (loophole)
- No explicit citation requirement
- No failure mode if tool returns nothing

**Fixes Applied**:
- Restructured as **MANDATORY** step-by-step process
- Removed discretion: "For any factual claim... MUST use factual_lookup"
- Pre-defined scope: "factual_lookup for: historical facts, current events, statistics, product details, person details, policy changes"
- Citation enforced: "Every factual statement must cite source"
- Confidence marking required: "verified/disputed/uncertain based on source agreement"
- Explicit failure: "say so—do not fabricate or speculate as fact"
- Validation: "Factual claims without citations will be rejected"

**New Instructions Highlight**:
```
1. IDENTIFY factual vs. subjective (required)
2. MUST use factual_lookup for: [pre-defined list]
3. CITE SOURCES for every factual statement
4. DISTINGUISH: verified/disputed/uncertain
5. DISCLOSE LIMITS explicitly
6. SHOW REASONING PATH (no magic conclusions)
7. REJECT GUESSES if tool returns insufficient data
VALIDATION: Claims without citations rejected
```

---

### 3. ✅ **general_family_chat** — PASS
**Status**: Appropriate  
**Purpose**: Casual household chat  
**Profile**: `fast`, no tools required, `verificationPolicy: none`

**Assessment**:
- Correctly scoped: "concise, friendly responses"
- Correctly constrained: "avoid fabricating factual claims when uncertain"
- No tool requirements: appropriate for casual chat
- Allows prose: correct for conversational mode

**Recommendation**: No changes. Maintains appropriate boundary.

---

### 4. ✅ **weather_widget** — PASS
**Status**: Well-designed  
**Purpose**: Return normalized weather JSON for widget  
**Profile**: `strict_json`, requires tool (`weather_provider`), verification required

**Assessment**:
- Correctly structured: "Return only normalized weather JSON"
- Tool enforced: requires `weather_provider` MCP call
- Strict schema validation: `strict_json` profile
- No prose output: enforced with `allowProse: false`

**Recommendation**: No changes. Good pattern for structured data.

---

### 5. ✅ **local_time** — PASS
**Status**: Well-designed  
**Purpose**: Deterministic local time retrieval  
**Profile**: `none`, requires `get_current_time` tool, no verification needed

**Assessment**:
- Correctly designed for deterministic execution
- Tool-driven: `responseMode: "local_tool"` ensures tool execution
- No prose: enforced
- No verification needed: output is deterministic

**Recommendation**: No changes. Good pattern for deterministic tools.

---

### 6. ✅ **dashboard_profile** — PASS
**Status**: Well-designed  
**Purpose**: Return structured dashboard data  
**Profile**: `strict_json`, requires `dashboard_provider`, verification required

**Assessment**:
- Correctly structured: "strict JSON only"
- Tool enforced: requires `dashboard_provider`
- No prose: correctly enforced with `allowProse: false`
- Verification required: ensures data quality

**Recommendation**: No changes. Follows good structured data pattern.

---

## Key Findings

| Skill | Issue Type | Severity | Status |
|-------|-----------|----------|--------|
| search_and_summarize | Instruction ignored by model | **Critical** | ✅ Fixed |
| planning_reasoning | Weak enforcement, passive language | **High** | ✅ Fixed |
| general_family_chat | N/A | N/A | ✅ Pass |
| weather_widget | N/A | N/A | ✅ Pass |
| local_time | N/A | N/A | ✅ Pass |
| dashboard_profile | N/A | N/A | ✅ Pass |

---

## Pattern Analysis

### Skills That Work (4/6)
- **Structured data skills** (weather_widget, local_time, dashboard_profile): Use strong typing, tool enforcement, responseMode limits
- **Casual chat** (general_family_chat): Correct scope with clear constraints

### Skills That Broke (2/6)
- Both fact-dependent skills with `responseMode: "chat"` and `verificationPolicy: "required"`
- Problem: Chat mode is too permissive; model can return prose without tool execution
- Root cause: Instructions are suggestions, not enforced constraints

### Why Enforcement Failed
1. Models read instructions as guidelines, not rules
2. Vague language ("request", "when", "may") gives discretion
3. No penalty for skipping steps
4. Prose mode allows natural fallback (vague response seems safer than admitting failure)

---

## Recommendations Going Forward

### 1. **Mandatory Language for Tool-Dependent Skills**
Use imperative: "MUST use", "CALL", "REQUIRE", not "should", "request", "may"

### 2. **Explicit Failure Modes**
Define what happens when tool returns no data. Don't allow graceful fallback to guessing.

### 3. **Citation Requirements**
For any fact-dependent skill, require minimum citation count (e.g., 2+ sources) in response validation.

### 4. **Pre-define Tool Scope**
Instead of "when factual claims are made", list exactly: "factual_lookup for: [list]"

### 5. **Validate Responses**
Implement response validation layer:
- Does response cite sources? If required, reject if not.
- Were expected tools called? Log and warn if not.
- Are citations properly formatted? Parse and verify.

### 6. **Consider Structured Output**
For fact-heavy responses, consider `responseMode: "structured_data"` with schema that requires source field on each claim.

---

## Next Steps

1. **Commit changes**: search_and_summarize and planning_reasoning strengthened
2. **Monitor**: Track whether strengthened instructions improve output quality
3. **Test**: Create test cases for each skill with validation
4. **Pattern**: Apply same enforcement pattern to any new fact-dependent skills
5. **Schema enhancement**: Consider adding `citationRequired` and `toolCallRequired` fields to skill manifest schema

---

## Files Changed

- ✅ `/apps/orchestrator/src/skills/search_and_summarize.json` — Instructions strengthened with mandatory tool enforcement
- ✅ `/apps/orchestrator/src/skills/planning_reasoning.json` — Instructions restructured for explicit tool requirement

**Total Skills Reviewed**: 6  
**Issues Found**: 2 (Critical: 1, High: 1)  
**Fixed**: 2  
**No Issues**: 4
