# Repository Guidelines

## Project Structure & Module Organization
- `app/` contains the Next.js App Router entry points, global styles, and the health check route (`app/api/health/route.ts`).
- `components/` holds the main UI and transfer logic. `components/p2p-share.tsx` is the core P2P workflow; `components/ui/` contains reusable shadcn-style primitives.
- `public/` stores static assets used by the landing page and UI.

## Build, Test, and Development Commands
- `pnpm dev` starts the local development server on port 3000.
- `pnpm build` creates a production build and catches type or compile errors.
- `pnpm start` runs the production build locally.
- `pnpm lint` runs ESLint across the codebase.

## Coding Style & Naming Conventions
- Use TypeScript, React function components, and Next.js App Router patterns.
- Keep files and components in `camelCase` for modules (`p2p-share.tsx`) and `PascalCase` for React components (`P2PShare`).
- Prefer concise, descriptive names for state, refs, and handlers (`connectionRef`, `handleFileChange`).
- Follow the existing style: 2-space indentation, double quotes, semicolons, and the repository’s block-comment documentation format.

## Testing Guidelines
- There is no dedicated test suite in this repository yet.
- Use `pnpm lint` and `pnpm build` as the primary verification steps before opening a PR.
- If you add tests, place them near the code they cover or in a dedicated `__tests__/` directory and keep names explicit, such as `p2p-share.test.tsx`.

## Commit & Pull Request Guidelines
- Follow the existing commit pattern from history: `feat: ...`, `fix: ...`, `docs: ...`.
- Keep commits focused on one change at a time.
- PRs should include a short summary, verification steps, and screenshots or screen recordings for UI changes.
- Mention any browser or network assumptions, especially for P2P transfer behavior.

## Security & Configuration Tips
- Do not commit secrets or environment-specific values.
- P2P behavior depends on browser WebRTC support and two open browser sessions for local testing.
