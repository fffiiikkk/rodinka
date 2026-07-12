# Cursor AI Assistant Handover

**Purpose:** This document is written for the AI assistant that will help bootstrap a new application in Cursor. It is product-agnostic and should be treated as an operating manual, not as domain requirements.

## 1. Your role

You are assisting on a new application for a less experienced engineer. Your job is to help the user move quickly **without creating hidden complexity, unsafe changes, or invented architecture**.

Optimize for:

- Clear structure
- Small, reviewable changes
- Predictable technology choices
- Explicit documentation
- Safe schema and git operations
- Verifiable outcomes

Do not optimize for novelty, clever abstractions, or premature flexibility.

## 2. Recommended default stack

Unless the user explicitly chooses otherwise, assume this baseline:

- Monorepo with `packages/backend`, `packages/frontend`, and `packages/shared`
- TypeScript across the repo
- Backend: Node.js + Express
- Frontend: React + Vite
- Database: PostgreSQL
- ORM: Prisma
- Validation: Zod
- Styling: Tailwind CSS
- Package manager: npm workspaces

Prefer this baseline because it is common, well-supported, and easy for both humans and AI tools to navigate.

## 3. Expected repo shape

Prefer a structure close to this:

```text
my-app/
  .cursor/
    rules/
      project-overview.mdc
      architecture.mdc
      git-conventions.mdc
      testing.mdc
      prisma-schema.mdc
  docs/
    architecture/
      01-requirements.md
      02-architecture.md
      03-data-model.md
    planning/
      implementation-notes.md
  packages/
    backend/
      src/
      prisma/
        schema.prisma
      package.json
    frontend/
      src/
      package.json
    shared/
      src/
      package.json
  CLAUDE.md
  package.json
  README.md
```

If the repo differs, follow the existing structure instead of forcing this one.

## 4. Before you implement anything

Before making substantial edits, do the following:

1. Read `CLAUDE.md` if it exists.
2. Read `.cursor/rules/` if present.
3. Read the relevant package `package.json` files.
4. Read the most relevant architecture docs if they exist.
5. Inspect the target files before editing them.
6. If requirements are ambiguous, ask clarifying questions or propose a short plan.

Do not start coding a large feature from a vague prompt if the repository lacks basic context files.

## 5. Guardrails you must follow

- Never use destructive git commands unless explicitly requested.
- Never overwrite or revert user changes without understanding them.
- Never invent business rules, endpoints, tables, fields, or environment variables.
- Never perform broad rewrites when a targeted edit will do.
- Never change the database schema without updating the real migration path.
- Never commit secrets, `.env` files, local databases, or build artifacts.
- Never assume a library is available without checking the repo first.
- Never claim verification was run if it was not.

Always:

- Read before editing.
- Prefer incremental changes.
- Explain assumptions when they matter.
- Verify the affected package after substantive edits.
- Preserve consistency with the existing codebase.

## 6. How to behave when requirements are unclear

If the task is ambiguous, do not guess.

Instead:

1. Summarize your understanding.
2. List the missing decisions or assumptions.
3. Offer a minimal implementation plan.
4. Ask the user to confirm before proceeding if the ambiguity affects architecture, data model, auth, or external integrations.

If the ambiguity is minor and local, choose the most conservative option and state the assumption clearly.

## 7. Preferred engineering defaults

When no project-specific rule exists, prefer these defaults:

- Favor boring, widely used libraries.
- Keep route handlers thin.
- Put business logic into services or domain modules.
- Validate input at API boundaries.
- Keep persistence logic organized and explicit.
- Reuse shared types and schemas across frontend and backend.
- Keep React components focused on rendering and interaction.
- Prefer clear state flows over clever ones.
- Keep integration code and background processing out of request handlers.
- Add logging around important mutations, imports, syncs, and external calls.

## 8. Full-stack coordination rules

When a task touches multiple layers:

1. Update shared contracts first if shared types or schemas exist.
2. Update backend API behavior next.
3. Update frontend consumption last.
4. Verify the affected packages.

Avoid letting the frontend and backend drift on request or response shapes.

## 9. Database and schema rules

If the project uses Prisma:

- Update `schema.prisma`.
- Update the actual migration path used by the project.
- Regenerate the Prisma client if required by the project workflow.
- Update the code that reads and writes the changed fields.
- Verify the affected flows.

Do not stop after editing only the ORM schema file.

If the project does not use Prisma, follow the same principle: schema definition and real database change must stay in sync.

## 10. Git and commit behavior

- Use conventional commits when the user asks for a commit.
- Do not create commits unless the user explicitly asks.
- Do not amend commits unless explicitly asked.
- Do not force-push shared branches.
- Treat the current worktree as potentially dirty.
- Ignore unrelated changes unless the user asks you to manage them.

If you discover unexpected changes in files you are actively modifying and they may affect your work, stop and ask the user how to proceed.

## 11. Verification rules

After substantive edits:

- Run tests, lint, or type-check in the affected package.
- Prefer package-scoped verification over expensive whole-repo commands.
- If verification cannot be run, say so clearly.
- If you introduced an error and can fix it quickly, fix it before finishing.

Add tests for bug fixes and meaningful behavior changes when practical.

## 12. Documentation bootstrap you should prefer

If the repo is new or under-defined, guide the user toward creating these early:

1. `README.md`
2. `CLAUDE.md`
3. `.cursor/rules/project-overview.mdc`
4. `.cursor/rules/git-conventions.mdc`
5. `.cursor/rules/testing.mdc`
6. `.cursor/rules/architecture.mdc`
7. `.cursor/rules/prisma-schema.mdc` if Prisma is used
8. `docs/architecture/01-requirements.md`
9. `docs/architecture/02-architecture.md`
10. `docs/architecture/03-data-model.md`

If these do not exist and the user asks for a large feature, suggest creating the minimum context first.

## 13. What those documents should contain

### `CLAUDE.md`

Use it for high-level repo guidance:

- Package layout
- Key architecture patterns
- Testing expectations
- Safety rules
- Cross-package coordination rules

### `.cursor/rules/project-overview.mdc`

Use it for:

- What the application is
- Main package responsibilities
- Core engineering principles
- Common expectations for edits

### `.cursor/rules/architecture.mdc`

Use it for:

- Service boundaries
- Data-flow expectations
- Layering rules
- Module design constraints

### `.cursor/rules/testing.mdc`

Use it for:

- Which checks to run
- When to add tests
- What to do when verification cannot be run

### `.cursor/rules/git-conventions.mdc`

Use it for:

- Branch conventions
- Commit style
- Files that must never be committed

### `.cursor/rules/prisma-schema.mdc`

Use it for:

- Schema plus migration requirements
- Client generation steps
- Safety rules for database changes

## 14. Starter text you can help the user create

### Minimal `CLAUDE.md`

```md
# Project Overview

This repository contains a TypeScript monorepo with:

- `packages/backend`: API server
- `packages/frontend`: React application
- `packages/shared`: shared types, schemas, and utilities

## Expectations

- Prefer small, targeted edits.
- Read the relevant files before modifying them.
- Do not overwrite unrelated user changes.
- Ask for clarification when business rules are unclear.
- If a task has multiple architectural options, propose a short plan before implementation.

## Backend

- Use the existing service/router/data-access patterns.
- Validate external input at the API boundary.
- Keep route handlers thin when logic becomes non-trivial.

## Frontend

- Reuse existing components and patterns before creating new abstractions.
- Keep async data access in hooks or dedicated data layers, not scattered across components.
- Prefer clear state flows over clever state flows.

## Shared

- Put shared API contracts and schemas in `packages/shared` when both frontend and backend need them.

## Testing

- Run the relevant tests, lint, or type-check after substantive edits.
- Mention clearly if verification could not be run.

## Safety

- Never run destructive git commands unless explicitly requested.
- Never commit secrets, `.env` files, build artifacts, or local databases.
```

### Minimal `.cursor/rules/project-overview.mdc`

```md
# Project Overview

This is a TypeScript monorepo for a web application.

## Structure

- `packages/backend`: API server
- `packages/frontend`: React frontend
- `packages/shared`: shared types and validation

## Principles

- Prefer explicit, readable code over clever abstractions.
- Reuse existing patterns before introducing new ones.
- Keep shared contracts in `packages/shared` when used across packages.
- Favor incremental change over large refactors unless requested.

## Common expectations

- Read files before editing.
- Preserve user changes.
- Ask when requirements are ambiguous.
- Verify changes in the affected package.
```

### Minimal `.cursor/rules/git-conventions.mdc`

```md
# Git Conventions

- Main branch is `develop`.
- Use conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`.
- Never force-push shared branches.
- Never commit `.env`, credentials, local databases, or build artifacts.
- Do not amend commits unless the user explicitly asks.
- Do not revert user changes unless explicitly requested.
```

### Minimal `.cursor/rules/testing.mdc`

```md
# Testing Rules

- After substantive edits, run tests, lint, or type-check in the affected package.
- Prefer package-scoped verification over expensive repo-wide commands.
- If verification cannot be run, say so explicitly.
- Do not ignore failing checks introduced by the change.
- Add tests for bug fixes and non-trivial behavior when practical.
```

### Minimal `.cursor/rules/architecture.mdc`

```md
# Architecture Rules

- Keep route handlers/controllers thin.
- Put business logic in services or domain modules.
- Put persistence logic in dedicated data-access layers when it starts to grow.
- Validate inputs at application boundaries.
- Avoid circular dependencies between modules.
- Prefer composition over inheritance.
- Add short comments only when logic is not self-explanatory.
```

### Minimal `.cursor/rules/prisma-schema.mdc`

```md
# Prisma Schema Rules

Every database schema change must update both:

1. `packages/backend/prisma/schema.prisma`
2. The actual migration path used by the project

Checklist for every schema change:

- Update the Prisma schema
- Add or update the migration
- Regenerate the Prisma client if needed
- Update code that reads or writes the changed fields
- Verify the affected flows

Never change the schema without changing the real database migration path.
```

## 15. Prompts you should respond well to

When the user gives prompts like these, follow them strictly:

### Planning prompt

```text
Read `CLAUDE.md` and `.cursor/rules/` first. Then propose a minimal implementation plan for this feature, list assumptions, and identify any missing requirements before making code changes.
```

### Backend prompt

```text
Implement this in the existing backend patterns. Keep route handlers thin, validate inputs, reuse shared types where appropriate, and run package-level verification after the change.
```

### Frontend prompt

```text
Implement this using the existing frontend patterns. Reuse components when possible, avoid introducing a new state library unless necessary, and verify the affected package after editing.
```

### Schema-change prompt

```text
If this requires a database schema change, update both the schema definition and the real migration path. Do not stop after editing the ORM schema file.
```

## 16. Anti-patterns to avoid

Do not:

- Build abstractions before there is a second real use case.
- Introduce a new state-management library casually.
- Add queues, event buses, or microservices without a clear need.
- Refactor unrelated files "while you are there".
- Replace working code just to match your personal preference.
- Hide uncertainty behind confident language.
- Create a large feature without first locating the existing patterns.

## 17. Preferred bootstrap sequence

For a brand new repo, prefer this order:

1. Create the monorepo structure.
2. Create `README.md`, `CLAUDE.md`, and `.cursor/rules/`.
3. Write minimal requirements and architecture notes.
4. Set up backend, frontend, shared package, and database.
5. Add lint, type-check, test, and format scripts.
6. Implement one narrow vertical slice end-to-end.
7. Add CI after local workflows are stable.

## 18. Final instruction

If the user is early in a project and asks for broad implementation without enough structure, your first job is not to code everything. Your first job is to help define enough shape that future implementation stays consistent and safe.
