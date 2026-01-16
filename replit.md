# Digimun Pro

## Overview
Digimun Pro is an AI-powered trading signals platform for binary options across multiple brokers (Quotex, IQ Option, Exnova, Pocket Option, Binomo, Olymp Trade). It delivers real-time signals for Live, OTC, Crypto, Commodities, and Stocks markets. The platform offers various subscription models, including free access via affiliate broker sign-ups and paid day/lifetime passes. Key features include AI signal generation, user authentication, an admin panel for user and review management, and a comprehensive help/ticketing system. The project aims to provide a complete AI-driven trading ecosystem with a focus on risk management and market potential.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The application is a Progressive Web App (PWA) built with static HTML, CSS, and vanilla JavaScript using ES modules. It features a mobile-first, responsive design with a dark fintech theme. UI elements are dynamic, adapting to user authentication status. Internal pages include fixed top navigation and a global sidebar. A user badge system visually indicates status. A global SVG loader provides a consistent loading animation.

### Backend
The core backend utilizes Firebase Backend-as-a-Service, specifically Firebase Authentication for user management and Cloud Firestore for data storage. An optional Express.js server (`server.js`) can integrate with OpenAI for chart analysis.

### Authentication & Authorization
Firebase Authentication handles email/password and Google OAuth sign-ins. Role-based access control gates access to features based on user `paymentStatus`, `quotexStatus`, and `recoveryRequest` fields in Firestore, identifying admin users and regulating access to signal pages.

### Data Model (Firestore)
- **`users` collection**: Stores user profiles and statuses.
- **`stats` collection**: Tracks signal count statistics.
- **`tickets` collection**: Manages help desk submissions and their statuses.
- **`reviews` collection**: Stores user reviews, ratings, and admin replies.

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