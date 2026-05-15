# Production Worker Nodes

## Runner Environment

- **OS:** Windows 11
- **Shell available:** `powershell` (Windows PowerShell 5.x) — use this for shell steps
- **NOT available:** `/bin/bash`, `pwsh` (PowerShell Core), `sh`

### GitHub Actions Shell Directives

| Directive | Available? | Notes |
|-----------|------------|-------|
| `shell: powershell` | ✅ Yes | Windows PowerShell 5.x — use this on Windows runners |
| `shell: pwsh` | ❌ No | PowerShell Core not installed |
| `shell: bash` | ❌ No | WSL/bash not available (`/bin/bash` missing) |
| `shell: sh` | ❌ No | POSIX shell not available |

### Implications for Workflow Design

All shell steps in `.github/workflows/deploy.yml` must use `shell: powershell`. This includes:
- Package diff detection (git-based logic)
- Docker operations
- Health checks

Do not assume Linux-style tools (`grep`, `cut`, `sort`, `basename`) are available. Use PowerShell equivalents:
- `grep` → `Where-Object { $_ -match '...' }`
- `cut -d/ -f1-2` → `$_.Split('/')[0..1] -join '/'`
- `sort -u` → `Sort-Object -Unique`
- `basename` → `Split-Path $_ -Leaf`
- `case/esac` → `switch ($var) { "pattern" { ... } }`
- `echo "key=val" >> "$GITHUB_OUTPUT"` → `Add-Content -Path $env:GITHUB_OUTPUT -Value "key=val"`