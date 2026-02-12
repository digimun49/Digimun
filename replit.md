# Digimun Pro

## Overview
Digimun Pro is an AI-powered trading signals platform for binary options across multiple brokers (Quotex, IQ Option, Exnova, Pocket Option, Binomo, Olymp Trade). It delivers real-time signals for Live, OTC, Crypto, Commodities, and Stocks markets. The platform offers various subscription models, including free access via affiliate broker sign-ups and paid day/lifetime passes. Key features include AI signal generation, user authentication, an admin panel for user and review management, and a comprehensive help/ticketing system. The project aims to provide a complete AI-driven trading ecosystem with a focus on risk management and market potential.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The application is a Progressive Web App (PWA) built with static HTML, CSS, and vanilla JavaScript using ES modules. It features a mobile-first, responsive design with a dark fintech theme. UI elements are dynamic, adapting to user authentication status. Internal pages include fixed top navigation and a global sidebar. A user badge system visually indicates status. A global SVG loader provides a consistent loading animation.

### Landing Page (index.html)
The landing page features a premium, institutional-grade design with:
- **Hero Section**: Animated market grid background with scanning effect, live market ticker, enhanced CTAs with glow effects, trust badges, and premium spacing
- **Scroll Experience**: Smooth reveal animations using Intersection Observer (with progressive enhancement - content visible if JS fails)
- **Feature Cards**: Glassmorphic effects with backdrop-filter blur, glow outlines on hover, micro-animations
- **Typography System**: Refined hierarchy (H1: 58px, H2: 42px, H3: 22px) with improved line-height and letter-spacing
- **Spacing System**: 8px base unit for consistent margins/padding (8, 16, 24, 32, 48, 64, 80, 96, 120)
- **Border Radius**: Consistent system (sm: 8px, md: 12px, lg: 20px, xl: 24px)
- **Accessibility**: Respects `prefers-reduced-motion` preference, progressive enhancement for JS-dependent features, reduced backdrop-filter on mobile for performance

### Main Access Page (dashboard.html)
The main access page features an institutional-grade interface with:
- **Tone & Authority**: Reduced glow opacities (0.08), slower transitions (0.4s), depth shadows instead of colored glows
- **Cards & Modules**: 1.5px solid borders, reduced border-radius (16px), heavier padding, subtle -2px hover lifts
- **Pricing Presentation**: Solid backgrounds (not gradients), 6px border-radius, font-weight 600 - feels like "system access fees"
- **Accuracy Metrics**: Monospace font styling, letter-spacing 0.5px, muted colors - analytical/technical appearance
- **Typography**: Solid white page title (no gradient), strong heading hierarchy, more whitespace
- **Dashboard Perception**: Subtle neutral styling, solid borders - feels like a tool, not promotional

### Universal Back Navigation
All pages use a standardized `goBack()` function:
- Uses `window.history.back()` for normal navigation
- Falls back to `/` if browser history is empty (direct page access)
- Consistent styling: top-left position, dark fintech theme, touch-friendly
- Login/signup prompts preserved in gated pages

### Backend
The core backend utilizes Firebase Backend-as-a-Service, specifically Firebase Authentication for user management and Cloud Firestore for data storage. An optional Express.js server (`server.js`) can integrate with OpenAI for chart analysis.

### Authentication & Authorization
Firebase Authentication handles email/password and Google OAuth sign-ins. Role-based access control gates access to features based on user `paymentStatus`, `quotexStatus`, and `recoveryRequest` fields in Firestore, identifying admin users and regulating access to signal pages.

### Data Model (Firestore)
- **`users` collection**: Stores user profiles, statuses, and signal performance stats (wins, losses, invalid, refunded, totalSignals).
- **`stats` collection**: Tracks signal count statistics.
- **`tickets` collection**: Manages help desk submissions and their statuses.
- **`reviews` collection**: Stores user reviews, ratings, and admin replies.
- **`signals` collection**: Stores all trading signals permanently with fields: signalId, sequentialId, userEmail, pair, direction, signal, confidence, reason, failureReason, entryTip, signalTime, result (WIN/LOSS/INVALID/REFUNDED), status (pending/completed), batchId, createdAt, resultSubmittedAt, adminEdited, approvedForLive.
- **`signalCounters` collection**: Doc `main` with field `lastSequentialId` for auto-incrementing sequential IDs (never decremented).
- **`signalBatches` collection**: Groups of 15 completed signals for admin batch review with fields: batchId, userEmail, signalIds, signalCount, status (pending/approved), createdAt, approvedAt, emailSent.

### Signal System Architecture
The signal recording system uses Netlify Functions as the backend (NOT Express routes). The flow is:
1. User uploads chart → server.js /analyze endpoint → OpenAI GPT-4o → returns structured signal data
2. Frontend calls `signal-analyze` Netlify Function to save signal to Firestore with sequential ID
3. User submits result (WIN/LOSS/INVALID/REFUNDED) via `signal-submit-result` Netlify Function
4. Every 15 completed signals auto-creates a batch for admin review
5. Admin reviews batches, approves them, optionally publishes to DigimunXLive
6. Admin sends HTML performance report emails via SMTP (nodemailer)

Key design decisions:
- No image storage in signal flow (analyze and discard immediately)
- Sequential IDs never break (counter never decremented, even on signal deletion)
- Batch system hidden from users (15 signals per batch, auto-created)
- DigimunXLive loads data permanently with realtime updates only on admin approvals
- Admin-only fields: sequentialId, adminEdited (users never see these)

### Netlify Functions (Signal System)
- **firebase-admin-init.js**: Shared Firebase Admin SDK initialization helper
- **signal-analyze.js**: Save new signal to Firestore with sequential ID
- **signal-get-pending.js**: Check if user has a pending signal
- **signal-submit-result.js**: Submit WIN/LOSS/INVALID/REFUNDED result
- **signal-history.js**: Get user's signal history with performance stats
- **signal-auto-expire.js**: Auto-delete pending signals older than 12 hours
- **admin-signals-search.js**: Admin search by ID/pair/email
- **admin-signal-edit.js**: Admin edit signal fields
- **admin-signal-delete.js**: Admin delete signal (sequential ID preserved)
- **admin-batches.js**: Admin view signal batches
- **admin-batch-approve.js**: Admin approve batch and optionally publish to live
- **admin-send-report.js**: Admin send HTML performance report email via SMTP
- **digimunxlive-signals.js**: Public endpoint for approved signals

### DigimunXLive Page (digimunx/index.html)
Two sections:
- **Telegram Addition**: Links to DigimunX Telegram channel
- **Website Addition**: Displays admin-approved signals with permanent data load and minimal Firebase reads

### Advanced Money Management System (money-management.html)
A comprehensive, 100% customizable binary options trading money management tool with professional features:

**Tab-Based Interface:**
- **Configuration Tab**: Capital & Account (deposit, currency, broker, account type, goal, risk tolerance), Trading Days Management (weekly schedule with day checkboxes, hours, sessions, monthly calculator), Advanced Risk Configuration (daily/weekly/monthly loss limits, drawdown, consecutive losses, risk-reward ratio), Strategy & Martingale System (No MTG, 1-Step, 2-Step, Custom, Compound modes with MTG ladder visualization, anti-martingale toggle), Trade Parameters (payout %, win rate, max trades, duration)
- **Dashboard Tab**: Real-time calculations for Base Stake, MTG Stake, Profit per Win, Recovery Profit, Expected Daily/Weekly/Monthly Profit, Max Losses, Break-even Win Rate, Days to Goal, Risk Level Badge, Account Survival Estimate
- **Compound Tab**: Compound Growth Calculator with enable/disable toggle, frequency selection (daily/weekly/monthly), reinvestment percentage, projection table (7-90 days), visual bar chart
- **Discipline Tab**: Pre-session checklist and post-session review prompts for trading discipline
- **Settings Tab**: Profile management (save/load/delete multiple profiles), auto-save toggle, export/import settings as JSON, reset to defaults, clear all data

**Smart Calculator (Above Tabs):**
- Instant auto-calculation from Balance, Risk Profile, and Broker Payout inputs
- 7 result cards: Trade Size, Daily Stop Loss, Daily Target, Max Trades/Day, Break-even Win %, Account Survival, Risk Level Badge
- Risk profiles: Ultra Safe (0.5%), Conservative (1%), Balanced (2%), Aggressive (3%)
- STOP TRADING warning banner when daily loss limit would be hit
- Session Tracker: Wins/Losses today, current P&L, remaining trades, stop banner

**Pro Features:**
- 5 Preset Profiles: Ultra Safe, Conservative, Balanced, Aggressive, High Risk
- Download Trading Plan: Professional 5-page PDF with jsPDF (cover page, account summary, trading plan, 30-day calendar, rules) with DIGIMUN PRO watermark on every page
- Copy Summary: Formatted text for Telegram/WhatsApp sharing
- localStorage Persistence: Save multiple named profiles, auto-save option
- Safety System: Blocks risky configurations, warning alerts, discipline checklists
- Default $100 balance (beginner-safe)

**Design:** Professional institutional-grade dark fintech theme, glassmorphic Smart Calculator, tab-based navigation, collapsible sections, mobile-first responsive layout, no sidebar (standalone tool)

**Documentation:** Complete feature guide available in `MONEY-MANAGEMENT-GUIDE.md` covering every function, option, calculation formula, and feature in detail.

### System Design Choices
The platform supports distinct user flows for free access (requiring broker affiliate sign-up and admin approval) and paid access. Premium features are gated based on user approval. The admin panel facilitates user, ticket, and review management with a dark fintech UI, real-time stats, and quick actions. The ticket system allows user submission and viewing, with admin capabilities for direct contact and conversation management. Payment pages integrate Binance Pay. Comprehensive SEO optimization is applied to key pages. A user contact system allows users to provide Telegram/WhatsApp details for support. The review system includes a public display of approved reviews with pagination and an admin management interface. Internal links use clean URLs without `.html` extensions, handled by Netlify redirects. The DigimunX AI scanner features an upgraded UI with a premium AI scanning effect. Signal generator pages (Digimun Pro Bot and DigiMaxx) have distinct, professionally redesigned interfaces with themed styling. Tamper-resistant access control is implemented using real-time Firestore verification. Firebase quota optimization is achieved by using `onSnapshot` real-time subscriptions instead of per-click reads.

## External Dependencies

### Firebase Services
- **Firebase Auth**: User authentication.
- **Cloud Firestore**: NoSQL database.

### Third-Party APIs
- **OpenAI API**: For chart image analysis (GPT-4 Vision) via `server.js`.
- **EmailJS**: Optional for email notifications.
- **Nodemailer**: SMTP email sending for performance reports (uses SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS secrets).

### External Integrations
- **Telegram (@digimun49)**: Primary customer support channel.
- **Support Ticket System**: Secondary fallback contact method via `help.html`.
- **Broker Affiliate Links**: Quotex, IQ Option, Exnova, Pocket Option, Binomo, Olymp Trade.
- **Binance Pay**: Primary payment gateway (ID: 887528640).
- **Google Analytics**: Via gtag.js.

### CDN Resources
- **Firebase JS SDK**: From gstatic.com.
- **Google Fonts**: Inter, Poppins, JetBrains Mono, Orbitron, Space Grotesk.