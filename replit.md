# Digimun Pro

## Overview

Digimun Pro is a trading signals platform that provides AI-powered market analysis and signals for binary options trading across multiple brokers (Quotex, IQ Option, Exnova, Pocket Option, Binomo, Olymp Trade). The platform offers various subscription tiers including free access, discounted access via affiliate broker signups, and paid day/lifetime passes. Key features include real-time signal generation for Live, OTC, Crypto, Commodities, and Stocks markets, user authentication, admin panel for user management, and a help/ticketing system.

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