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
- **`users` collection**: Stores user profiles and statuses.
- **`stats` collection**: Tracks signal count statistics.
- **`tickets` collection**: Manages help desk submissions and their statuses.
- **`reviews` collection**: Stores user reviews, ratings, and admin replies.

### Money Management Calculator (money-management.html)
The Advanced Money Management Calculator provides traders with a comprehensive tool to:
- **Configuration Panel**: Deposit amount input, risk mode toggle (percentage/fixed stake), strategy selection (No Martingale, 1-Step, Advanced Custom), martingale settings (multiplier 1.8x-3.0x, max steps), trade parameters (payout %, max trades, max daily cycles)
- **Results Dashboard**: Real-time calculations showing Base Stake, MTG Stake, Profit on Win, Recovery Profit, Cycle Loss, Max Daily Loss, Stop Loss, Daily Target
- **Risk Assessment**: Dynamic risk level badge (Low/Medium/High/Extreme) with account survival estimate
- **Safety System**: Blocks if risk >10% deposit, warnings for high MTG steps, auto-reset if fixed stake >10%, daily loss alerts
- **Pro Features**: Preset buttons (Safe Trader, Balanced, Aggressive), Reset All, Copy Summary for Telegram/WhatsApp
- **Design**: Dark fintech theme consistent with Digimun Pro, mobile-first responsive layout

### System Design Choices
The platform supports distinct user flows for free access (requiring broker affiliate sign-up and admin approval) and paid access. Premium features are gated based on user approval. The admin panel facilitates user, ticket, and review management with a dark fintech UI, real-time stats, and quick actions. The ticket system allows user submission and viewing, with admin capabilities for direct contact and conversation management. Payment pages integrate Binance Pay. Comprehensive SEO optimization is applied to key pages. A user contact system allows users to provide Telegram/WhatsApp details for support. The review system includes a public display of approved reviews with pagination and an admin management interface. Internal links use clean URLs without `.html` extensions, handled by Netlify redirects. The DigimunX AI scanner features an upgraded UI with a premium AI scanning effect. Signal generator pages (Digimun Pro Bot and DigiMaxx) have distinct, professionally redesigned interfaces with themed styling. Tamper-resistant access control is implemented using real-time Firestore verification. Firebase quota optimization is achieved by using `onSnapshot` real-time subscriptions instead of per-click reads.

## External Dependencies

### Firebase Services
- **Firebase Auth**: User authentication.
- **Cloud Firestore**: NoSQL database.

### Third-Party APIs
- **OpenAI API**: For chart image analysis (GPT-4 Vision) via `server.js`.
- **EmailJS**: Optional for email notifications.

### External Integrations
- **Telegram (@digimun49)**: Primary customer support channel.
- **Support Ticket System**: Secondary fallback contact method via `help.html`.
- **Broker Affiliate Links**: Quotex, IQ Option, Exnova, Pocket Option, Binomo, Olymp Trade.
- **Binance Pay**: Primary payment gateway (ID: 887528640).
- **Google Analytics**: Via gtag.js.

### CDN Resources
- **Firebase JS SDK**: From gstatic.com.
- **Google Fonts**: Inter, Poppins, JetBrains Mono, Orbitron, Space Grotesk.