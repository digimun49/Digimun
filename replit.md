# Digimun Pro

## Overview

Digimun Pro is a trading signals platform that provides AI-powered market analysis and signals for binary options trading across multiple brokers (Quotex, IQ Option, Exnova, Pocket Option, Binomo, Olymp Trade). The platform offers various subscription tiers including free access, discounted access via affiliate broker signups, and paid day/lifetime passes. Key features include real-time signal generation for Live, OTC, Crypto, Commodities, and Stocks markets, user authentication, admin panel for user management, help/ticketing system, and public user reviews.

## Recent Changes (December 2024)

### Landing Page Redesign (index.html)
- Complete redesign as a premium dark fintech landing page
- Hero section with professional messaging (no hype claims)
- Why Digimun section explaining AI logic, risk management, discipline-based execution
- Services section showcasing AI Signal Systems, DigiMax Indicators, Recovery Management
- How It Works section with 4-step process (Register → Apply → Admin Review → Access)
- Reviews section with public display of approved reviews only
- Review submission form that saves to Firestore with status="pending"
- Trust/Compliance section with risk disclaimer
- Final CTA section with professional tone

### Admin Panel Upgrade (admin.html, admin.js)
- New sidebar navigation with sections for Users, Tickets, Reviews
- Dark fintech theme matching the landing page
- Reviews Management section with load/filter/manage functionality
- Admin can approve/reject/edit/delete user reviews
- Only approved reviews display publicly on landing page
- All existing user management and ticket functionality preserved

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

### Firebase Security Rules Required
To enable public review display, add to Firestore security rules:
```
match /reviews/{reviewId} {
  allow read: if resource.data.status == "approved";
  allow write: if request.auth != null;
}
```

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