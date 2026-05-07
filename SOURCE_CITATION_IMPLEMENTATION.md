# Source Citation Enforcement Implementation

## Summary
Implemented multi-layer source citation enforcement to ensure factual responses include proper source citations. Fixed the issue where "what happened to charlie kirk?" responses didn't cite any sources.

## Key Components

### 1. Citation Format Enforcement
- **buildVerificationSystemMessage()** - Generates system messages for different verification statuses:
  - **Verified**: "CRITICAL: You MUST cite sources...Include at least 2 independent sources"
  - **Weak**: "WEAK EVIDENCE - YOU MUST CITE SOURCES...explicitly cite"
  - **Low Confidence**: "STRICT CITATION REQUIRED...cite every claim with source name"
  - Includes `AVAILABLE SOURCES:` list with top 5 URLs for model reference

### 2. Citation Validation
- **hasSufficientCitations(text, minimumCitations=2)** - Detects two strict citation formats:
  - `[Source: Name]` - formal citations
  - `(per Name)` - inline citations
  - Returns true only if minimum citations found with proper format

### 3. Response Enforcement
- In **streamFinalAnswer()**: When response is complete:
  1. Checks if verification message was present in context
  2. Checks if response has sufficient citations (2+ sources)
  3. If verification required but citations missing: 
     - Retracts the response
     - Injects stronger enforcement message
     - Re-streams answer with citation mandate

### 4. Source Collection
- Sources collected from:
  - Web search results
  - Deep research queries
  - Page reads during verification rounds
  - All deduplicated and passed to verification message

## Flow for "what happened to charlie kirk?"

1. **Detection**: `requiresFactVerification()` recognizes "what happened to" pattern
2. **Verification Triggered**: Inside `planTools()`:
   - Runs verification queries (buildVerificationQueries)
   - Collects sources from web searches
   - Builds verification report
   - Generates system message with sources list
3. **Initial Response**: Model answers with system message context:
   - Sees available sources
   - Gets explicit citation format instructions
   - Should cite [Source: Reuters], (per BBC), etc.
4. **Validation**: If citations missing:
   - Detected by hasSufficientCitations() check
   - Response retracted
   - Stronger enforcement message injected
   - Model re-answers with mandatory citation requirement

## Tests Added

- 7 tests for buildVerificationSystemMessage (citation formats, source list)
- 7 tests for hasSufficientCitations (various formats, edge cases)
- 8 integration tests for verification flow
- All 242 tests passing

## Example Citation Formats

**Required format examples in system message:**
```
Charlie Kirk is alive [Source: Reuters]. This was confirmed by major outlets [Source: BBC News].
According to reports (per Reuters), Kirk continues his work.
Latest updates (per AP News) confirm his status.
```

## Changes Made

1. **chatStream.js**:
   - Enhanced buildVerificationSystemMessage() with source list injection
   - Added hasSufficientCitations() validation function
   - Added citation enforcement check in streamFinalAnswer()
   - Exports buildVerificationSystemMessage for testing

2. **chatStream.test.js**:
   - Added 14 new tests for citation validation
   - Imported hasSufficientCitations for testing
   - All existing tests still passing

3. **chatStream.integration.test.js**:
   - Added integration tests for verification flow
   - Tests source collection and message building

## Verification Guarantee

✅ Verification flow triggers for high-risk factual questions  
✅ Sources are collected and visible to model  
✅ System message explicitly mandates citation format  
✅ Response is validated for citations  
✅ If missing, response is regenerated with stronger enforcement  
✅ User sees both sources list and cited response  

## Testing the Fix

To test with "what happened to charlie kirk?":
1. Verification triggers (what happened = factual)
2. Web searches run (collecting source URLs)
3. System message injected with source list
4. Model answers, citing sources: "[Source: Reuters]", "(per BBC)"
5. If it doesn't cite, streamFinalAnswer retracks and regenerates
6. User sees sources panel + cited response
