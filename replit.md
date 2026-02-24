# Digimun Pro

## Overview
Digimun Pro is an AI-powered trading signals platform for binary options across multiple brokers. It provides real-time signals for Live, OTC, Crypto, Commodities, and Stocks markets. The platform offers various subscription models, including free access via affiliate broker sign-ups and paid passes. Key capabilities include AI signal generation, user authentication, an admin panel for user and review management, and a comprehensive help/ticketing system. The project aims to offer a complete AI-driven trading ecosystem, emphasizing risk management and market potential.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The application is a Progressive Web App (PWA) built with static HTML, CSS, and vanilla JavaScript using ES modules. It features a mobile-first, responsive design with a dark fintech theme. UI elements are dynamic, adapting to user authentication status. The landing page includes a premium design with animated market grids, live tickers, enhanced CTAs, scroll reveal animations, glassmorphic feature cards, and a refined typography and spacing system. The main access dashboard provides an institutional-grade interface with subtle styling, solid borders, and clear information presentation. A universal back navigation system ensures consistent user experience. The DigimunX AI Chart Analyzer page features a professional trading terminal-style interface with clean header bar, institutional-grade upload zone, compact options row with JetBrains Mono inputs, smooth analysis-to-result transitions (chart fades out, results slide in without spacing gaps), and full responsive design across mobile (320px+), tablet, and desktop breakpoints.

### Backend
The core backend uses Firebase Backend-as-a-Service, leveraging Firebase Authentication for user management and Cloud Firestore for data storage. Netlify Functions serve as the primary backend for signal processing and other serverless operations. An optional Express.js server can integrate with OpenAI for chart analysis.

### Authentication & Authorization
Firebase Authentication handles user sign-ins, with role-based access control managed via Firestore user fields (`paymentStatus`, `quotexStatus`, `recoveryRequest`) to gate access and identify admin users. Admin email is stored securely as an environment variable (`ADMIN_EMAIL`) and never exposed in frontend code. Admin detection on login/access-check pages uses a server-side `check-admin` endpoint. The admin panel uses Firebase Auth `onAuthStateChanged` to set the admin email dynamically from the authenticated user session.

### Important Architecture Notes
- **No Firestore composite indexes required**: All queries avoid `.orderBy()` with `.where()` combinations. Sorting is done in JavaScript after fetching to prevent Firestore composite index errors.
- **Admin email security**: The `ADMIN_EMAIL` env var must be set in all environments (Replit shared env + Netlify env vars) for admin functions to work.

### Data Model (Firestore)
The Firestore database includes collections for `users`, `stats`, `tickets`, `reviews`, `signals`, `signalCounters`, and `signalBatches`. These collections store user profiles, signal data, help desk submissions, reviews, and manage signal processing workflows.

### Signal System Architecture
The signal recording system uses Netlify Functions. The process involves:
1. User uploads a chart for AI analysis via OpenAI.
2. The system saves the generated signal to Firestore with a sequential ID.
3. Users submit signal results (WIN/LOSS/INVALID/REFUNDED).
4. Completed signals are batched for admin review.
5. Admins approve batches and can publish signals to a live display (`DigimunXLive`).
6. Performance reports are sent via email.
The system incorporates AI learning by feeding past winning/losing signal patterns to OpenAI for improved analysis. Access is controlled, preventing users from bypassing the workflow.

### Netlify Functions
A suite of Netlify Functions manages various aspects of the signal system, including saving new signals, checking pending signals, submitting results, retrieving history, auto-expiring pending signals, and admin functionalities for signal and batch management, reporting, and public signal endpoints.

### DigimunXLive Standalone Page
This page displays only admin-approved signals with masked identities, providing a public view of successful trades. It features two tabs for Telegram integration and website-displayed signals, with real-time updates for new approvals and performance statistics. Data privacy is maintained by sanitizing information through server-side endpoints.

### Admin PDF Report Download
Admins can generate professional PDF reports of user signal data, including performance summaries and detailed signal tables, branded with Digimun Pro.

### Advanced Money Management System
A comprehensive, customizable money management tool with a tab-based interface for configuration, a dashboard for real-time calculations, a compound growth calculator, and discipline prompts. It features a "Smart Calculator" for instant risk assessment and supports saving/loading multiple profiles, exporting/importing settings, and generating a professional PDF trading plan.

### System Design Choices
The platform supports distinct user flows for free (affiliate-based) and paid access. An admin panel facilitates user, ticket, and review management. Payment integration uses Binance Pay. SEO optimization is applied, and a user contact system is available. Reviews are publicly displayed with admin moderation. Clean URLs are used, and access control is tamper-resistant. Firebase quota optimization strategies are implemented, including caching and adjusted polling intervals. Signal generator pages (Digimun Pro Bot and DigiMaxx) have distinct, professional interfaces.

## External Dependencies

### Firebase Services
- **Firebase Auth**: User authentication.
- **Cloud Firestore**: NoSQL database.

### Third-Party APIs
- **OpenAI API**: For chart image analysis (GPT-4 Vision).
- **Nodemailer**: SMTP email sending for performance reports.

### External Integrations
- **Telegram (@digimun49)**: Primary customer support channel.
- **Broker Affiliate Links**: Quotex, IQ Option, Exnova, Pocket Option, Binomo, Olymp Trade.
- **Binance Pay**: Primary payment gateway.
- **Google Analytics**: Via gtag.js.

### CDN Resources
- **Firebase JS SDK**: From gstatic.com.
- **Google Fonts**: Inter, Poppins, JetBrains Mono, Orbitron, Space Grotesk.