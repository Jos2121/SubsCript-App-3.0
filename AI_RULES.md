# AI Rules & Guidelines for Isites Pro

This document defines the technology stack, architectural decisions, and rules for extending or modifying the Isites Pro codebase. Always adhere to these guidelines when making code changes or adding new features.

## Tech Stack

*   **Frontend Framework**: React 19 (using strict functional components and hooks).
*   **Routing**: React Router v7 for client-side navigation.
*   **Styling**: Tailwind CSS for utility-first styling and responsive design.
*   **Icons**: Lucide React for consistent, customizable SVG icons.
*   **Charts & Visualizations**: Recharts for building responsive and composable charts.
*   **Backend Environment**: Node.js environment using `@hono/node-server`.
*   **Backend Framework**: Hono for fast, lightweight routing and API endpoints.
*   **Database**: PostgreSQL, accessed via raw SQL bindings using the `postgres` package.
*   **Authentication & Security**: JWT (`hono/jwt`) for session management and `bcryptjs` for password hashing.
*   **Data Validation**: Zod for defining schemas and validating shared data types between the frontend and backend.

## Library Rules & Usage Guidelines

### Frontend (src/react-app)
*   **Icons**: **MUST** use `lucide-react`. Do not install or use other icon libraries (e.g., FontAwesome, Heroicons, Material Icons).
*   **Styling**: **MUST** use Tailwind CSS utility classes. Avoid creating custom CSS in `index.css` unless it's a global utility class, animation keyframe, or standard reset. Do not use CSS modules or styled-components.
*   **Routing**: Keep all top-level route definitions in `src/react-app/App.tsx`. Use `useNavigate` and `<Link>` from `react-router-dom`.
*   **State Management**: Use React Context API combined with custom hooks (e.g., `useAuth`, `useToast`, `usePlatformSettings`). **DO NOT** introduce Redux, Zustand, MobX, or Jotai unless explicitly approved.
*   **Data Fetching**: Use standard native `fetch` via the custom `apiCall` wrapper (found in `useAuth.tsx`) to automatically handle JWT injection and 401 redirects. Do not use Axios or React Query unless specifically requested.
*   **Notifications**: Use the existing custom Toast system (`useToast` hook). Do not introduce third-party toast libraries like `react-toastify` or `react-hot-toast`.
*   **Charts**: **MUST** use `recharts`. Do not install Chart.js, D3 directly, or ApexCharts.

### Backend (src/worker)
*   **API Framework**: **MUST** use `hono`. Keep endpoints in `src/worker/index.ts` (or split into Hono sub-routers if the file gets too large).
*   **Database Access**: **MUST** use PostgreSQL with the `postgres` package (`sql\`...\``). **DO NOT** use Prisma, Drizzle, or TypeORM. Write secure, parameterized raw SQL queries.
*   **Validation**: Use `zod` for both runtime request validation and generating static TypeScript types (store these in `src/shared/types.ts`).
*   **Authentication**: Use `hono/jwt` for signing and verifying tokens. Passwords must be hashed using `bcryptjs` before insertion into the database. Never store plain-text passwords.

### General Architecture Rules
1.  **Strict TypeScript**: Write strictly typed code. Avoid `any` wherever possible.
2.  **Directory Structure Constraints**:
    *   `src/react-app/`: Strictly for frontend code (Pages, Components, Hooks, Utils).
    *   `src/worker/`: Strictly for backend API code and database logic.
    *   `src/shared/`: For interfaces and Zod schemas shared between frontend and backend.
3.  **Component Size**: Aim to keep React components under 100-150 lines. Break large components down into smaller, focused files if they grow too large.