# Nora Design Index

This folder replaces the previous single-file design doc with focused design files.

## Sections

- [overview.md](./overview.md): system overview and architecture diagram
- [modules.md](./modules.md): module map, responsibilities, and dependency graph
- [lifecycle.md](./lifecycle.md): request lifecycle and chat execution flow
- [sse-contract.md](./sse-contract.md): streaming event contract for `/api/chat`
- [tools.md](./tools.md): tool definitions and extension flow
- [configuration.md](./configuration.md): environment and model configuration
- [failure-modes.md](./failure-modes.md): failure and recovery behavior
- [homeworks.md](./homeworks.md): homework generation strategy, schema contract, and retry/error behavior
- [architecture-decisions.md](./architecture-decisions.md): ADR map and extension points

## Update Rule

When architecture, event contracts, tools, or failure handling changes, update the relevant file in this folder in the same PR.
