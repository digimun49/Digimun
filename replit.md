# Digimun Pro

## Overview
Digimun Pro is an AI-powered trading signals platform for binary options across multiple brokers (Quotex, IQ Option, Exnova, Pocket Option, Binomo, Olymp Trade). It delivers real-time signals for Live, OTC, Crypto, Commodities, and Stocks markets. The platform offers various subscription models, including free access via affiliate broker sign-ups and paid day/lifetime passes. Key features include AI signal generation, user authentication, an admin panel for user and review management, and a comprehensive help/ticketing system. The project aims to provide a complete AI-driven trading ecosystem with a focus on risk management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The application uses static HTML, CSS, and vanilla JavaScript with direct browser ES modules. It functions as a Progressive Web App (PWA) with a manifest and service worker. The design is mobile-first, responsive, and adheres to a dark fintech theme using CSS custom properties. UI elements dynamically adapt based on user authentication status. Internal pages utilize a fixed top navigation and a global sidebar. A user badge system visually indicates user status (e.g., "Digimun User", "VIP Member").

### Backend Architecture
The core backend is Firebase Backend-as-a-Service, leveraging Firebase Authentication for user management and Cloud Firestore for data storage. An optional Express.js server (`server.js`) can integrate with OpenAI for chart analysis; otherwise, the architecture is largely serverless.

### Authentication & Authorization
Firebase Authentication manages email/password and Google OAuth sign-ins. Role-based access control identifies admin users and gates access to signal pages for regular users based on `paymentStatus` and `quotexStatus` fields in Firestore. Access to DigimunX is controlled independently via the `recoveryRequest` field.

### Data Model (Firestore)
- **`users` collection**: Stores user profiles including `email`, `quotexID`, `paymentStatus`, `quotexStatus`, `telegramUsername`, `whatsappNumber`, `contactLinkedAt`, and `createdAt`.
- **`stats` collection**: Tracks signal count statistics.
- **`tickets` collection**: Manages help desk submissions with details like `name`, `email`, `subject`, `message`, `status`, `replies[]`, `telegramUsername`, `whatsappNumber`, `createdAt`, and `updatedAt`.
- **`reviews` collection**: Stores user reviews with `name`, `country`, `rating`, `message`, `status` (pending/approved/rejected), `createdAt`, and optional `reply` object containing `message` and `updatedAt` for admin responses.

### System Design Choices
The platform supports distinct user flows for free access (requiring broker affiliate sign-up and admin approval) and paid access (requiring direct payment and admin approval). Premium features are gated based on user approval. The admin panel facilitates user, ticket, and review management with a dark fintech UI, real-time stats, and quick actions. The ticket system allows user submission and viewing, with admin capabilities for direct contact and conversation management. Payment pages feature a dark fintech design with Binance Pay integration and direct admin contact options for local currency payments. Comprehensive SEO optimization is applied to key pages. A user contact system allows users to provide Telegram/WhatsApp details for support.

### Reviews System
- **Public Reviews Page** (`reviews.html`): Displays only approved reviews with pagination (50 per batch using Firestore `startAfter`). Shows reviewer name, country, star rating, message, date, and optional admin reply labeled "Official Response – Digimun Team". Includes stats for total reviews, average rating, and 5-star count.
- **Admin Reviews Management**: Full control via admin panel to approve/reject/delete reviews and manage public replies. Reply badge indicator shows which reviews have admin responses.

## External Dependencies

### Firebase Services
- **Firebase Auth**: User authentication.
- **Cloud Firestore**: NoSQL database.
- **Project ID**: `digimun-49`.

### Third-Party APIs
- **OpenAI API**: Used by `server.js` for chart image analysis (GPT-4 Vision).
- **EmailJS**: Optional integration for email notifications.

### External Integrations
- **Telegram (@digimun49)**: Primary customer support channel (preferred).
- **WhatsApp (+44 7846 665413)**: Secondary direct contact for support. WhatsApp channel also active for updates.
- **Support Ticket System**: Alternative contact method via `help.html`.
- **Broker Affiliate Links**: Integrations with Quotex, IQ Option, Exnova, Pocket Option, Binomo, and Olymp Trade.
- **Binance Pay**: Primary payment gateway (ID: 887528640).

### CDN Resources
- **Firebase JS SDK**: From gstatic.com.
- **Google Fonts**: Inter, Poppins.
- **Google Analytics**: Via gtag.js.

## Recent Changes

### January 9, 2026
- **DigimunX AI Scanner UX Upgrade**: Complete redesign of chart analysis UI:
  - Replaced circular loader with premium AI scanner effect
  - Multi-directional scan lines (top→bottom, bottom→top, left→right, right→left)
  - Grid overlay with pulsing "AI SCANNING" text and corner brackets
  - Chart image stays visible throughout analysis process
  - Smooth scale-down transition when analysis completes
  - Inline result appears without layout jumps
  - Removed all legacy loading overlay styles
  - Mobile-responsive fixed-height approach for completed state
- **Clean URL Implementation**: Converted all internal links across 52 files to use clean URLs without .html extensions:
  - All href attributes updated (e.g., `href="/login"` instead of `href="login.html"`)
  - All JavaScript location.href calls updated to clean paths
  - Netlify `_redirects` file handles URL rewrites with 200 status codes
  - 311 total link replacements for consistent URL structure

### January 5, 2026
- **High-End Professional Redesign**: Complete redesign of signal.html and digimaxx.html:
  - Premium dark fintech theme with gradient accents
  - Glassmorphism effects with backdrop blur
  - Modern typography (Inter, JetBrains Mono, Orbitron fonts)
  - Animated gradient buttons with hover effects
  - Stats cards with glow effects
  - Professional gate screens with smooth transitions
  - Fully responsive mobile-first design
- **Critical Security Fix**: Implemented tamper-resistant access control:
  - AccessController using Symbol-keyed private state
  - Real-time Firestore verification on every signal generation
  - Console manipulation no longer bypasses access controls
- **Firebase Quota Optimization**: Replaced per-click reads with onSnapshot real-time subscription:
  - Only 1 initial Firestore read per session
  - Real-time listener detects status changes instantly (no extra reads)
  - Generate Signal clicks use cached state (zero Firestore reads)
  - Subscription auto-cleanup on page unload to prevent memory leaks

### December 29, 2025
- **Bot Logo Images**: Replaced bot emojis with unique logo images in the dashboard (`chooseAccountType.html`):
  - Digimun Pro: `assets/digimun-pro-logo.png` (DXP gold logo)
  - Digimaxx: `assets/digimaxx-logo.png` (DigiMax blue chart logo)
  - DigimunX AI: `assets/digimunx-ai-logo.png` (Pro Bot logo)
  - Future Signals: `assets/future-signals-logo.png` (colorful arrow logo)
- Logos are consistently used in the bot access grid, service cards, and modals.