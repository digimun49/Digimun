# Digimun Pro — Smart Signal System

## Overview

Digimun Pro is a frontend-only web application focused on signal parsing and display for what appears to be a trading or financial signal service. The project consists of static HTML files:

- **`index.html`** — Public-facing landing page for "Digimun – Smart Signal System"
- **`timefix.html`** — A signal parser tool ("Smart Signal Parser") with a textarea input, controls for parsing/transforming signals, and a responsive two-column grid layout
- **`admincontroldp49.html`** — A hidden admin panel (marked `noindex, nofollow`) with a sidebar-based dashboard UI for managing the service

The application is entirely client-side with no backend framework, database, or build system currently in place. All styling is done via embedded CSS with CSS custom properties (variables) for theming.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Pure static HTML/CSS/JS** — No frontend framework (React, Vue, etc.) is used. Each page is a self-contained HTML file with inline styles and (presumably) inline scripts.
- **CSS Custom Properties** — All three pages use CSS variables for consistent dark-themed design tokens (colors, shadows, borders). The admin panel and signal parser share a similar dark color palette (`--bg-primary`, `--accent: #00ffc3`, etc.).
- **Responsive Design** — Pages use CSS Grid with media query breakpoints (e.g., `@media (max-width:900px)`) to collapse layouts on mobile. Touch-action and font-size rules prevent unwanted zoom on mobile.
- **Admin Panel Security** — The admin page (`admincontroldp49.html`) uses an obscure filename and `noindex, nofollow` meta tags as basic security-through-obscurity. No authentication framework is visible in the provided code.

### Page Purposes

| File | Role |
|---|---|
| `index.html` | Marketing landing page with CTA button and contact links |
| `timefix.html` | Signal parser tool — paste raw signals, configure options, get parsed output |
| `admincontroldp49.html` | Admin dashboard with sidebar navigation for managing the service |

### Design System

- Dark theme with teal/green accent (`#00ffc3` / `#20e3b2`)
- Monospace fonts for signal/code display areas
- Card-based UI components with subtle borders and glow effects

## External Dependencies

- **No external JavaScript libraries** are referenced in the provided file content (no CDN imports visible)
- **No backend or database** — currently a static site
- **No build tools** — no package.json, webpack, or similar tooling present
- **Favicon** — references `assets/digimun-favicon.png` locally

### Potential Future Integrations to Consider

If this project grows, likely additions would be:
- A backend API (Node.js/Express or similar) for signal delivery and admin authentication
- A database (PostgreSQL with Drizzle ORM) for storing signals, users, and subscriptions
- Real authentication for the admin panel (currently protected only by obscure URL)
- A Telegram or WhatsApp API integration for signal delivery (common in trading signal services)