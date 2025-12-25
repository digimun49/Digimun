# Digimun Pro

## Overview
Digimun Pro is an AI-powered trading signals platform specializing in binary options for multiple brokers (Quotex, IQ Option, Exnova, Pocket Option, Binomo, Olymp Trade). It offers real-time signals for Live, OTC, Crypto, Commodities, and Stocks markets. The platform supports various subscription models, including free access through affiliate broker sign-ups and paid day/lifetime passes. Key capabilities include AI signal generation, user authentication, an admin panel for user management and review moderation, and a comprehensive help/ticketing system. The project aims to provide a complete trading ecosystem, emphasizing AI-based logic, risk management, and multiple trading systems.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The application is built using static HTML, CSS, and vanilla JavaScript, leveraging direct browser ES modules without a build system. It follows a Progressive Web App (PWA) approach with a manifest and service worker for an installable experience. The design is mobile-first, responsive, and uses a dark fintech theme with consistent CSS custom properties for branding.

### Backend Architecture
The core backend relies on Firebase Backend-as-a-Service, utilizing Firebase Authentication for user management and Cloud Firestore for data storage (user profiles, tickets, signal statistics). An optional Express.js server (`server.js`) is included for integrating with OpenAI for chart analysis via image uploads, otherwise, the architecture is largely serverless with client-side Firebase SDK calls.

### Authentication & Authorization
Firebase Authentication handles email/password and Google OAuth sign-ins. Role-based access control is implemented, identifying an admin user by a specific email and requiring approval status checks for regular users (based on `paymentStatus` and `quotexStatus` fields in Firestore) to gate access to signal pages.

### Data Model (Firestore)
- **`users` collection**: Stores user profiles with fields such as `email`, `quotexID`, `paymentStatus`, `quotexStatus`, `telegramUsername`, `whatsappNumber`, `contactLinkedAt`, and `createdAt`.
- **`stats` collection**: Tracks various signal count statistics.
- **`tickets` collection**: Manages help desk ticket submissions with fields: `name`, `email`, `subject`, `message`, `status` (open/replied/closed), `replies[]` (conversation thread), `telegramUsername`, `whatsappNumber`, `createdAt`, `updatedAt`.
- **`reviews` collection**: Stores user reviews, with `status` and `createdAt` fields, requiring specific Firestore security rules for public display of approved reviews.

### System Design Choices
The platform integrates a sophisticated user flow that distinguishes between free access (via broker affiliate sign-up and admin approval) and paid access (direct payment and admin approval). Premium features like AI signal bots, indicators, and live signals are gated based on user approval status. The admin panel provides comprehensive tools for user, ticket, and review management, featuring a dark fintech UI, real-time stats, quick actions, and toast notifications. A global sidebar navigation, dynamically loaded across all pages, provides consistent site navigation and mobile responsiveness.

### Ticket System Features
- **User Ticket Submission** (`help.html`, `help.js`): Users submit tickets with optional Telegram/WhatsApp contact fields for faster support. Contact info is cleaned and saved to both ticket and user profile.
- **User Ticket Dashboard** (`my-tickets.html`, `my-tickets.js`): Users can view all their tickets, filter by status (Open/Replied/Closed), and reply to open tickets via a chat-style conversation interface. Auto-detects logged-in users and pre-fills email.
- **Admin Ticket Management** (`admin.html`, `admin.js`): Admin can view all tickets with contact icons, click direct contact buttons (Telegram/WhatsApp) in ticket details, and manage conversation threads. WhatsApp numbers are validated before generating links.
- **Contact Linking**: Once a user provides Telegram/WhatsApp, it's stored in their profile and shown in admin views for easy direct contact.

### Admin Panel Mobile Responsiveness (December 2024)
- **Sticky Mobile Header**: Fixed header with hamburger menu and dynamic page title on mobile (<768px).
- **Touch-Friendly Controls**: All buttons have minimum 44px touch targets for better mobile usability.
- **Mobile Card Layouts**: Tables are hidden on mobile and replaced with stacked card views for users, tickets, and reviews sections.
- **Dual Rendering Functions**: `renderUserMobileCard()`, `renderTicketMobileCard()`, and `renderReviewMobileCard()` provide optimized mobile layouts alongside desktop tables.
- **Auto-Close Sidebar**: Sidebar automatically closes on mobile after navigation to prevent blocking content.
- **Consistent Data Sync**: All user functions (search, prefix search, filters, quick actions like filterPendingUsers) now populate both desktop table and mobile cards simultaneously.

### DigimunX Access Control & Mobile Responsiveness (December 2024)
- **Independent Access Control**: DigimunX now checks ONLY `recoveryRequest` field, completely independent of Digimun Pro, payment status, or any other bot approvals.
- **Clear Access States**: Five distinct user states with appropriate UI screens:
  - `recoveryRequest: approved`/`active`: Full access to DigimunX analyzer
  - `recoveryRequest: pending`: Approval pending screen with contact options
  - `recoveryRequest: denied`/`revoked`/`rejected`: Access denied screen with contact admin option
  - `status: suspended`/`banned`: Account suspended screen
  - Not logged in: Login prompt screen
- **Mobile Responsiveness**: Comprehensive responsive CSS preventing horizontal scroll, touch-friendly buttons (min 48px height), stacked layouts on mobile, and properly sized elements across all breakpoints.
- **Auth State Handling**: Analyzer UI only loads after access verification completes, preventing premature content display.
- **Admin Panel Integration**: The `recoveryRequest` field can be toggled in the admin panel under the "Recovery" column/toggle for each user.

### Frontend Redesign (December 2024)
- **chooseAccountType.html**: Complete redesign with bot access status grid showing clear indicators for each bot (Pro, Digimaxx, DigimunX AI, Future Signals). Modal-based "Get Bot" contact flow for locked bots with prefilled messages to admin.
- **choose-platform.html**: Professional fintech redesign focused on bot purchase. Clear Free ($40-50 deposit) vs Paid ($6) access options with step-by-step guides.
- **VIP System**: Comprehensive Free and Paid VIP access flows:
  - `free-vip.html`: SEO-optimized page with all 6 brokers (Quotex, Pocket Option, IQ Option, Exnova, Binomo, Olymp Trade), referral links, and Trader ID submission flow.
  - `paid-vip-portal.html`: SEO-optimized page with VIP duration options ($6-$380), Binance Pay integration (ID: 887528640), screenshot submission.
- **index.html Navbar**: Updated with prominent gold gradient "Join VIP" button with glow animation.
- **VIP Section Links**: Updated VIP section in index.html to link to new dedicated pages.
- **Contact Details**: Telegram @digimun49, WhatsApp +447846665413, Binance Pay ID 887528640.

### SEO Optimization (December 2024)
- **free-vip.html**: Google-indexable with proper meta tags, Open Graph, Twitter cards, JSON-LD structured data, and `robots: index, follow`.
- **paid-vip-portal.html**: Google-indexable with same SEO optimizations.
- **robots.txt**: Configured to allow all pages (`Allow: /`).
- **Canonical URLs**: Set to https://digimun.pro/free-vip.html and https://digimun.pro/paid-vip-portal.html.

### Payment System (Updated December 2024)
- **Professional Dark Fintech Design**: All payment pages use a consistent dark theme with neon accent colors (#20e3b2, #0088ff), gradient backgrounds, and modern card treatments.
- **Binance Pay Integration**: Primary payment method with Pay ID: 887528640, copy-to-clipboard functionality, and QR code display (assets/binance-qr.png).
- **PKR Payment Flow**: Users wanting to pay in PKR are directed to contact admin via:
  - Telegram: @digimun49
  - WhatsApp: +447846665413
  - Prefilled messages automatically include product name and request for payment details.
- **Payment Pages Updated**: payment.html, payment-details.html, oneday-access.html, threeday-access.html, sevenday-access.html, loss-recovery.html, discount-payment.html.
- **DigimunX Payment Portal**: Professional portal with tab switching (Binance/Bank), user auth integration, and status tracking.

## External Dependencies

### Firebase Services
- **Firebase Auth**: User authentication (email/password, Google OAuth).
- **Cloud Firestore**: NoSQL database for `users`, `tickets`, `stats`, and `reviews` collections.
- **Project ID**: `digimun-49`.

### Third-Party APIs
- **OpenAI API**: Utilized by `server.js` for advanced chart image analysis (GPT-4 Vision).
- **EmailJS**: For sending email notifications related to ticket submissions (optional integration).

### External Integrations
- **Telegram (@digimun49)**: Primary channel for customer support.
- **WhatsApp Channel**: Secondary communication channel.
- **YouTube**: For tutorials and informational content.
- **Broker Affiliate Links**: Integrations with Quotex, IQ Option, Exnova, Pocket Option, Binomo, and Olymp Trade for user sign-ups and tracking.

### CDN Resources
- **Firebase JS SDK**: Version 10.12.0 from gstatic.com.
- **Google Fonts**: Inter, Poppins.
- **Google Analytics**: Via gtag.js.