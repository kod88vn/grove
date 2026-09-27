# Post-Deploy Verification Skill

After a merge to `master` triggers the deploy workflow, verify the deployment succeeded.

This is **not** required to finish a task: a merged PR finishes the loop (see Loop Engineering in `AGENTS.md`).

## When to Use

- When the owner asks you to verify a deploy
- When a deploy failure is suspected (failed `deploy` check, errors reported after a merge)

## Procedure

### Step 1: Check Deploy Workflow Status

Use GitHub MCP to check the deploy workflow run status for the latest commit on `master`:

```
1. Use GitHub MCP `list_commits` on master to get the latest commit SHA
2. Use GitHub MCP `get_commit` with that SHA to see check run statuses
3. Look for the "deploy" job status — it should show as passed (green checkmark)
```

### Step 2: Verify Container Health

If the workflow passed, verify the running container is healthy:

```
1. Check that `docker logs grove-live --tail 50` shows no errors
2. Confirm the health check in deploy.yml passed (HTTP response 2xx-4xx on port 80)
3. If health check fails, the container is running but may be unhealthy — investigate logs
```

### Step 3: Confirm Specific Changes Are Live

For tasks that added new features or fixed bugs, verify the specific change is reflected:

```
1. Navigate to the relevant route in the deployed application
2. Verify the change is visible and functioning correctly
3. Document verification result in the PR comment or task completion message
```

## Output Format

When reporting deployment status:

```
### Deploy Verification: ✅ PASSED / ❌ FAILED

**Workflow Run**: [link to GitHub Actions run]
**Image Tag**: grove:<sha7>
**Container**: grove-live running on port 80

**Health Check**: HTTP 2xx-4xx response from http://127.0.0.1/
**Logs**: No errors detected / [specific error if present]

**Change Verification**: [what was verified and result]
```

## Rollback Procedure

If deployment fails:

1. **Do NOT silently ignore the failure** — report it immediately
2. Check `docker logs grove-live --tail 100` for application errors
3. If the Docker build failed: fix the issue in a new PR (follow debugging skill)
4. If the container started but health check failed: investigate application logs
5. For critical production issues, the deploy workflow's container swap replaces the running container — if the new image is broken, create a fix PR immediately

## Notes

- The deploy workflow's health check (HTTP on port 80) is the primary gate — if it passes, the deployment is considered successful
- The workflow prunes old images after each deploy to prevent disk exhaustion
- Monitor `nora-data` volume for SQLite data persistence across deploys — this is separate from the container