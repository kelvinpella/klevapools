# AGENTS Guidelines for This Repository

This repository contains a Fastify server application written in TypeScript. Please use the relevant skills when possible and follow the guidance below so the development workflow stays smooth and consistent.

## 1. Use the development server, not `npm run build`

- Always use `npm run dev` while iterating on the application.
- This starts Fastify in development mode.

## 2. Keep dependencies in sync

Whenever you add or update dependencies:

1. Update the appropriate lockfile: `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`.
2. Restart the development server so the app picks up the changes.

## 3. Coding conventions

- Consult the relevant Fastify, TypeScript, and other project skills when working on related tasks.
- Use TypeScript for all new utilities.

## 4. Useful command recap

| Command | Purpose |
| --- | --- |
| `npm install` | Install project dependencies and packages |
| `npm run dev` | Start the Fastify server |
| `npm run lint` | Run ESLint checks |
| `npm run test` | Execute the test suite (if present) |
| `npm run build` | Production build — do not run during agent sessions |

---

Following these practices keeps the agent-assisted workflow fast and dependable. When in doubt, restart the development server rather than running the production build.