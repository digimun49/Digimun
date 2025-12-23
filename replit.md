# Digimun Pro

## Overview

Digimun Pro is a trading signals platform that provides AI-powered market analysis and signals for binary options trading across multiple brokers (Quotex, IQ Option, Exnova, Pocket Option, Binomo, Olymp Trade). The platform offers various subscription tiers including free access, discounted access via affiliate broker signups, and paid day/lifetime passes. Key features include real-time signal generation for Live, OTC, Crypto, Commodities, and Stocks markets, user authentication, admin panel for user management, help/ticketing system, and public user reviews.

## Recent Changes (December 2024)

### Choose Platform Redesign (December 23, 2024)
- High-end professional trading platform selection page
- **Pocket Option as PRIMARY focus** with "Recommended" badge
- Two clear access paths for Pocket Option:
  - FREE Access ($0): Affiliate link signup + $30 deposit
  - Paid Access ($6): Direct access without broker requirement
- VIP Benefits section with 9 premium features displayed
- Quotex as secondary platform option
- Other platforms (Exnova, IQ Option, Binomo, Olymp Trade) in compact grid
- Premium dark fintech design with gradient accents
- Card-based layout with smooth hover effects
- Responsive design for mobile and desktop

### Controlled User Flow Binding (December 23, 2024)
- **index.html and chooseAccountType.html are now logically connected**
- Guest users see preview information; bot access requires login
- Service buttons on landing page use `requireLogin()` gate function
- Login prompt modal displays for unauthenticated users clicking services
- Navigation updates based on auth state (shows Dashboard for logged users)
- Redirect to login.html for guests trying to access chooseAccountType.html

### Choose Account Type Redesign (December 23, 2024)
- Premium dark fintech design matching landing page theme
- **VIP Membership Tiers - Free Access via Deposit:**
  - $25 deposit → Future Signals Group (70+ signals)
  - $50 deposit → Bot + Future Signals Group
  - $60+ deposit → All Groups + Live Signals + 1M Bot + DSigAI
- **VIP Membership Tiers - Paid Direct Access:**
  - $25/week → All VIP Access
  - $80/month → Save 20%
  - $200/3 months → Save 30%
  - $380/6 months → Save 40%
- VIP Benefits grid: 9 benefits including daily signals, compounding plans, risk management, lifetime bots
- User status card showing approval status (approved/pending/locked badges)
- Pending approval banner with admin contact
- Service cards with locked states for non-approved users
- Firebase-based access control checking paymentStatus, quotexStatus, digimaxStatus, recoveryRequest fields

### Landing Page Redesign v2 (December 23, 2024)
- Enterprise-level dark fintech landing page with accent color #00D4AA
- Hero section positioning Digimun Pro as a "Complete Trading Ecosystem" (not just a signals provider)
- Platform Stats card showcasing: 5+ Trading Systems, 24/7 Market Coverage, Live OTC Markets, Pro Risk Control
- Available Modules displayed: Digimun Pro, Digimaxx, Future Signals, DigimunX AI, Loss Recovery
- Hero feature badges: AI Signal Bots, Premium Indicators, Live Signals, Future Signals
- Why Digimun section: AI-Based Logic, Risk Management, Multiple Systems, Admin Controlled
- Services grid with 6 cards featuring all products with correct pricing:
  - Future Signals (From $2.99) - 91%+ accuracy, 15-100 signals/day
  - Digimun Pro ($3.99) - Core signals bot, 81%+ accuracy
  - Digimaxx ($6.99) - Premium signals, 87%+ accuracy  
  - DigimunX AI (Beta) - Chart screenshot analyzer, 95%+ accuracy
  - Loss Recovery ($5) - Admin-led recovery sessions
  - Support section with help links
- **Login-gated service buttons with requireLogin() modal prompt**
- Professional Telegram/WhatsApp popup with sessionStorage to show once per session
- Reviews section with Firebase integration for loading approved reviews
- How It Works: 4-step process (Create Account → Choose Plan → Admin Approval → Start Trading)
- Trust/Compliance section with risk disclaimer and trust badges
- Responsive design with 1024px, 768px, and 480px breakpoints
- Global sidebar integration via sidebar-include.js

### Admin Panel Upgrade (admin.html, admin.js)
- New sidebar navigation with sections for Users, Tickets, Reviews
- Dark fintech theme matching the landing page
- Reviews Management section with load/filter/manage functionality
- Admin can approve/reject/edit/delete user reviews
- Only approved reviews display publicly on landing page
- All existing user management and ticket functionality preserved
- **Dashboard Stats Grid** - 4 clickable stat cards showing:
  - Total Users count
  - Open Tickets count
  - Pending Reviews count
  - Pending User Approvals count
- **Quick Actions Toolbar** - One-click buttons for common admin tasks:
  - Refresh All (reloads all data)
  - View Pending Users (filters to pending approval users)
  - View Open Tickets (switches to tickets section)
  - Review Pending (switches to reviews section)
- **Toast Notifications** - Visual feedback for actions (success/error/info)
- **Auto-refresh** - Dashboard stats refresh automatically every 60 seconds
- **Auto-load on login** - Dashboard stats, tickets, and reviews load automatically when admin logs in

### Global Sidebar Navigation (December 2024)
- Created sidebar.html with professional dark theme navigation component
- Created sidebar-include.js for dynamic sidebar loading across all pages
- Added sidebar navigation to 45+ HTML pages site-wide
- Sidebar includes: Dashboard, Submit Ticket, My Tickets, About Us, Our Team, FAQs, Trading Rules, Privacy Policy, Terms & Conditions, Contact Us submenu
- Mobile-responsive hamburger menu (☰) positioned in top-right corner
- Swipe gestures supported for mobile sidebar open/close
- Social media links in footer (YouTube, Telegram, WhatsApp, TikTok)

### Enhanced Support Ticket System (December 2024)
- **help.html / help.js**: Ticket submission form saving to Firestore "tickets" collection
  - Fields: name, email, subject, message, status="open", createdAt, updatedAt
  - User-friendly error/success messages
- **my-tickets.html / my-tickets.js**: New user-facing page to view and respond to tickets
  - Users enter email to lookup their submitted tickets
  - View ticket details, admin replies, and conversation history
  - Reply to admin responses
  - Close tickets from user side
- **admin.html / admin.js**: Enhanced admin ticket management
  - View all tickets with filter by status (all/open/replied/closed)
  - Reply to tickets with email notification to user
  - Update ticket status manually
  - Delete tickets
  - Distinguish admin vs customer replies visually
- **Email notifications**: EmailJS integration sends email to user when admin replies

### Firebase Requirements
**Firestore Index Required** - The reviews query requires a composite index:
- Collection: `reviews`
- Fields: `status` (Ascending), `createdAt` (Descending)
- Create via Firebase Console or use the link in the browser console error

**Security Rules** - To enable public review display, add to Firestore security rules:
```
match /reviews/{reviewId} {
  allow read: if resource.data.status == "approved";
  allow write: if request.auth != null;
}
```

### Mobile Responsiveness (December 2024)
- Landing page has dedicated mobile navigation (separate from global sidebar)
- Added 480px breakpoint for small mobile screens
- Hero buttons stack vertically on mobile
- Stats grid wraps properly on small screens
- Touch-friendly star rating in review form
- Full-screen mobile menu overlay with proper transitions

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Static HTML/CSS/JS**: The application is built as a collection of static HTML pages with embedded CSS and vanilla JavaScript modules
- **No build system**: Direct browser ES modules are used via CDN imports from Firebase and other libraries
- **Progressive Web App (PWA)**: Includes manifest.json, service worker, and app icons for installable experience
- **Responsive design**: CSS uses media queries and flexible layouts for mobile-first approach
- **Design system**: Consistent CSS custom properties (variables) for theming with dark gradient backgrounds and accent colors (#00ffc3, #7c3aed)

### Backend Architecture
- **Firebase Backend-as-a-Service**: 
  - Firebase Authentication for user login/signup (email/password and Google OAuth)
  - Cloud Firestore for user data, ticket submissions, and signal statistics
  - No custom backend server required for core functionality
- **Express.js server (server.js)**: Optional server for OpenAI integration to analyze trading charts via image uploads
- **Serverless approach**: Most logic runs client-side with direct Firebase SDK calls

### Authentication & Authorization
- Email/password authentication via Firebase Auth
- Google OAuth sign-in option
- Role-based access control:
  - Admin user identified by hardcoded email (muneebg249@gmail.com)
  - Regular users require approval status checks (paymentStatus, quotexStatus fields in Firestore)
- Access gating: Signal pages check user approval status before allowing access

### Data Model (Firestore)
- **users collection**: Stores user profiles with fields like email, quotexID, paymentStatus, quotexStatus, createdAt
- **stats collection**: Tracks signal count statistics
- **tickets collection**: Help desk ticket submissions

### Key User Flows
1. **Free Access**: Signup → Create broker account via affiliate link → Submit Trader ID → Admin approval → Signal access
2. **Paid Access**: Signup → Pay via crypto/local methods → Submit payment proof → Admin approval → Signal access
3. **Signal Generation**: Select market type → Select asset → Generate signal with AI-powered direction prediction

### Page Structure
- Landing/marketing pages: index.html, digimax.html
- Auth pages: login.html, signup.html
- Signal pages: signal.html (main), digimaxx.html (premium)
- Payment flows: checkout.html, payment.html, various broker-specific pages
- Admin: admin.html with user management table
- Support: help.html, connect.html

## External Dependencies

### Firebase Services
- **Firebase Auth**: User authentication (email/password, Google OAuth)
- **Cloud Firestore**: NoSQL database for users, tickets, stats
- Project ID: digimun-49

### Third-Party APIs
- **OpenAI API**: Used in server.js for chart image analysis (GPT-4 Vision)
- **EmailJS**: Optional email notifications for ticket submissions (not fully configured)

### NPM Dependencies (server.js only)
- express: Web server framework
- multer: File upload handling for chart images
- openai: OpenAI API client
- dotenv: Environment variable management
- cors: Cross-origin resource sharing

### External Links/Integrations
- Telegram (@digimun49): Primary customer support channel
- WhatsApp Channel: Secondary communications (being phased out)
- YouTube: Tutorial videos
- Broker affiliate links: Quotex, IQ Option, Exnova, Pocket Option

### CDN Resources
- Firebase JS SDK (v10.12.0) via gstatic.com
- Google Fonts: Inter, Poppins
- Google Analytics (gtag.js)