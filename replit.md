# Digimun Pro

## Overview
Digimun Pro is an AI-powered trading signals platform for binary options across multiple brokers. It provides real-time signals for Live, OTC, Crypto, Commodities, and Stocks markets. The platform offers various subscription models, including free access via affiliate broker sign-ups and paid passes. Key capabilities include AI signal generation, user authentication, an admin panel for user and review management, and a comprehensive help/ticketing system. The project aims to offer a complete AI-driven trading ecosystem, emphasizing risk management and market potential.

## User Preferences
Preferred communication style: Simple, everyday language. User speaks Urdu/English mix.

## Hosting & Environment
- **Replit**: Code editor only — not used for hosting or deployment.
- **Netlify**: Hosts the frontend (static HTML/CSS/JS) and all serverless functions (`netlify/functions/`). Live site at `digimun.pro`.
- **Firebase**: Backend services — Authentication, Cloud Firestore database, Cloud Messaging (FCM). No Firebase Hosting is used.
- **Deployment flow**: Code is pushed to GitHub (`Digimun-Backup` repo) → Netlify auto-deploys from there.

## System Architecture

### Frontend
The application is a Progressive Web App (PWA) built with static HTML, CSS, and vanilla JavaScript using ES modules. It features a mobile-first, responsive design with a dark fintech theme. A unified CSS variables system (`variables.css`) defines the design tokens: colors (`--color-accent: #00D4AA`, `--color-danger: #ef4444`, `--color-warning: #f59e0b`), typography (`--font-primary: Inter`), z-index layers (`--z-navbar` through `--z-loader`), spacing, and border-radius values. All CSS files reference these shared variables. The dashboard (`dashboard.html`) uses consolidated CSS that references `variables.css` tokens — no duplicated `:root` block. It features a sticky quick-navigation strip, a dynamic "next step" prompt in the user-status card, an enhanced VIP accordion with gradient banner, hover micro-interactions on service cards, and comprehensive mobile responsiveness down to 320px with 44px minimum touch targets. The z-index scale follows: dropdown(100) < sticky(500) < navbar(1000) < sidebar-overlay(5000) < sidebar(5500) < modal(8000) < overlay(9000) < gate(9500) < loader(10000). Suspension overlay and access gate styles are in dedicated external CSS files (`suspension-overlay.css`, `access-gate.css`) rather than embedded in JavaScript. UI elements are dynamic, adapting to user authentication status. The landing page includes a premium design with animated market grids, live tickers, enhanced CTAs, scroll reveal animations, glassmorphic feature cards, and a refined typography and spacing system. Engagement features include: animated stats counter (IntersectionObserver-driven count-up), social proof toast notifications (cycling every 12s), hero gradient mesh background with floating card animation, partners marquee (infinite scroll with edge fade masks), How It Works step connector line with SVG icons, floating scroll CTA (visible after hero, hidden near bottom CTA), back-to-top button (appears after 500px scroll), and enhanced service card hover effects with flagship card scale emphasis. All new features respect `prefers-reduced-motion`. Duplicate `:root` CSS variables were consolidated into `variables.css`. The main access dashboard provides an institutional-grade interface with subtle styling, solid borders, and clear information presentation. A universal back navigation system ensures consistent user experience. The DigimunX AI Chart Analyzer page features a professional trading terminal-style interface with clean header bar, institutional-grade upload zone, compact options row with JetBrains Mono inputs, smooth analysis-to-result transitions (chart fades out, results slide in).

### CSS Design System
- **`variables.css`**: Unified design tokens — colors (`--accent: #00D4AA`, `--bg-primary: #050508`), typography (`--font-family: Inter`), spacing, radii, shadows, z-index scale (base=1 through loader=9999), transitions, and shared keyframe animations. Includes global reset and scrollbar styling. Must be linked first in all HTML pages.
- **`auth.css`**: Shared auth page styles (~1066 lines) consolidating login/signup page CSS. Covers trading background, candlestick animations, price ticker, floating stats, login container, form inputs, password toggle, auth-switch tabs, suspension/deleted banners, Google sign-in button, forgot-password section, and responsive breakpoints. Login.html and signup.html link this instead of inline styles.
- **`style.css`**: Legacy styles for splash screen, signal generator pages, sidebar, and payment screens. Cleaned to remove 3 duplicate `body` rules, 2 duplicate `#generate-btn` blocks, duplicate splash definitions, and conflicting login-container styles. Still used by dashboard, checkout, free, discount, and signal pages.

### Backend
The core backend uses Firebase Backend-as-a-Service, leveraging Firebase Authentication for user management and Cloud Firestore for data storage. Netlify Functions serve as the primary backend for signal processing and other serverless operations. An Express.js server integrates with OpenAI for chart analysis, serves static files with security restrictions, and proxies Netlify function calls.

### Authentication & Authorization
Firebase Authentication handles user sign-ins. All API endpoints require Firebase ID tokens via `Authorization: Bearer <token>` headers. Server-side token verification is performed using Firebase Admin SDK (`firebase-admin-init.cjs`). Admin access is verified by checking the authenticated user's email against the `ADMIN_EMAIL` environment variable. Moderator access is checked against comma-separated `MODERATOR_EMAILS` env var. User-facing signal endpoints extract the user's email from the verified token (not from request body) to prevent impersonation. The admin panel uses Firebase Auth `onAuthStateChanged` to set the admin email dynamically and calls `getIdToken()` for every API request.

### Role-Based Access Control
- **Super-admin**: Full access to all admin features. Determined by `ADMIN_EMAIL` env var.
- **Moderator**: Read/edit access but restricted from destructive/bulk operations (batch approvals, user deletion, signal deletion). Determined by `MODERATOR_EMAILS` env var (comma-separated).
- **Backend enforcement**: `verifyAdmin(event, { requireSuperAdmin: true })` blocks moderators from restricted endpoints.
- **Frontend enforcement**: `data-require-super-admin` HTML attribute hides UI elements for moderators via MutationObserver. `requireSuperAdmin()` JS function blocks moderator actions at runtime.
- **Role helpers**: `getAdminRole(email)` returns `'super-admin'`, `'moderator'`, or `null`. `isAdminOrModerator(email)` returns boolean.

### Security Architecture
- **CORS**: Locked down to `digimun.pro`, `www.digimun.pro`, and the Replit dev domain only. Dynamic origin checking via `getCorsHeaders()` helper.
- **Token Verification**: All admin endpoints use `verifyAdmin()` (token + admin email check). User endpoints use `verifyFirebaseToken()`. Shared helpers in `firebase-admin-init.cjs`.
- **Admin 2FA**: TOTP-based two-factor authentication. Sessions stored server-side in Firestore `admin2faSessions` collection with UID, email, IP, and expiry. Default session: `sessionStorage` (3-hour expiry). "Trust this device" option stores in `localStorage` (7-day expiry). `get2FAStore()` checks localStorage first for trusted sessions.
- **Rate Limiting**: Applied to `/analyze` (10/min), `/api/upload-ticket-attachment` (5/min), 2FA verification (5 attempts per 15min window with 30min lockout), signup validation (5/IP per 15min, 3/email per 30min), send-verification-email (5/IP per 15min, 3/email per 10min), send-reset-email (5/IP per 15min, 3/email per 15min), and check-admin (20/IP per min). Shared rate limiter module: `netlify/functions/rate-limiter.cjs`.
- **Server-Side Signup Validation**: `validate-signup.cjs` checks `deletedAccounts` server-side, enforces rate limiting, validates email format, and collects device fingerprint for duplicate account detection. Flagged signups stored in `flaggedSignups` Firestore collection for admin review.
- **Device Fingerprinting**: Client-side fingerprint generated in `signup.js` using canvas, navigator, screen, and timezone data. Hash stored in user doc (`deviceFingerprint` field). Server checks for duplicate fingerprints across accounts and flags matches.
- **User Intelligence & Tracking**: On every login/signup, client-side code collects device info (browser, OS, screen, timezone, language, fingerprint) and sends it to `user-geo-lookup.cjs` Netlify function. The function derives the user email from the authenticated Firebase token (not from request body), captures the client IP from request headers, performs a GeoIP lookup via ipapi.co (HTTPS), and writes a `trackingMeta` object to the user's Firestore document. Fields: `lastIP`, `ipHistory` (last 5 unique IPs), `lastGeo` (country, city, region, ISP, lat/lng), `deviceInfo`, `deviceFingerprint`, `lastLoginAt`. Requests use `keepalive: true` to survive page navigation. Admin panel displays this data in a "User Intelligence" panel when searching users and in a collapsible panel within the ticket reply modal.
- **Server-Side Premium Access Verification**: `verify-premium-access.cjs` module checks account status, email verification, subscription status, and expiry on every premium content request (signals, AI analysis). Enforced in `signal-analyze.cjs`, `signal-get-pending.cjs`, `signal-history.cjs`, `signal-submit-result.cjs`. Expired subscriptions are auto-revoked server-side.
- **Payment Status Audit Trail**: All payment/access field changes go through `update-user-field.cjs` which logs every change to `auditLog` Firestore collection with previous value, new value, admin email, UID, timestamp, and client IP. Admin panel (`mxpanel49d.js`) uses this endpoint instead of direct Firestore writes for audited fields.
- **Email Verification Enforcement**: Premium content Netlify functions verify `emailVerified` status via Firebase Admin SDK before serving content.
- **Admin Panel URL Security**: Admin panel URL is never exposed in client-side code. The `check-admin` Netlify function returns the admin route only to verified admin users via server response. The URL is stored server-side in the `ADMIN_PANEL_ROUTE` env var (no fallback — env var must be set). Login redirect URLs are validated to prevent open redirects. No robots.txt entry, no client-side hardcoded paths.
- **Static File Protection**: `server.js` blocks access to sensitive files (server.js, package.json, .env, netlify/, node_modules/, .git/, firestore.rules, etc.). Admin files are not served to unauthenticated users.
- **Error Sanitization**: All error responses return generic messages. Internal error details are logged server-side only.
- **Firestore Rules**: Use `request.auth.token.admin == true` custom claims for admin checks (no hardcoded emails). Users can only read/write their own data. Sensitive collections like `admin2faSessions` are server-only (deny all client access). Tickets require auth + field validation for creation. `activeVisitors` uses `hasOnly` for strict schema enforcement. `deletedAccounts` requires auth matching the email (unauthenticated reads fail gracefully in login/signup). `pageVisits` has field count limits and source length validation. `reviews` enforce schema on create (rating 1-5, text ≤2000 chars, status must be "pending"). `users` create enforces initial field values; update blocks sensitive field changes. `adminLogs` collection is admin-read-only, server-write-only (client writes denied).
- **XSS Prevention**: All user-controlled data rendered via `escapeHtmlStr()` helper or DOM methods (textContent/createElement). `highlightMatch()` escapes HTML before insertion. File names in help.js use DOM API instead of innerHTML. Email display in gate screens is escaped. `mxpanel49d.js` top-pages list escapes page names.
- **Server-Side Input Validation**: All Netlify function endpoints validate input types, lengths, and formats. Email fields validated with regex + 320-char limit. Names capped at 200 chars. Message/body fields capped at 5000 chars. MIME type whitelist on file uploads. Document IDs validated as strings with 128-char limit.
- **Platform Config**: Centralized in `config.js` and root `platform.js` (single abstraction layer hiding backend provider). `platform.js` re-exports all auth and firestore SDK functions — no frontend file imports from CDN directly. `platform-messaging.js` re-exports messaging SDK functions (loaded only by `push-notifications.js` to avoid loading messaging on every page). Sub-apps (`digimunx/platform.js`) import from root. Service worker (`messaging-sw.js`) loads config via `importScripts` (can't use ES modules). All frontend JS/HTML files import exclusively from `platform.js`. Global window variables use generic names (`_auth`, `_db`, `_app`, `_ready`).
- **Session Timeout**: 30-minute inactivity timeout with 60-second warning. Tracks mousedown/keydown/touchstart/scroll/mousemove events (throttled to 5s). On timeout, clears 2FA session and shows re-auth overlay. "Stay Active" button extends session.
- **Audit Logging**: All admin actions logged to Firestore `adminLogs` collection. Server-side logging via `logAdminAction()` for Netlify function operations (batch approve, signal edit/delete). Client-side logging via `admin-audit-log.cjs` Netlify function for direct Firestore operations (user status changes, ticket/review actions). Audit log viewer in admin panel with action type filtering.
- **Confirmation Dialogs**: All destructive actions use styled confirmation modals (`showConfirmDialog()`) instead of native `confirm()`. Returns a Promise for async flow control. Gracefully falls back to native `confirm()` if dialog HTML is missing.

### App Check
App Check with reCAPTCHA v3 is initialized in `platform.js`, gated to only activate on `digimun.pro` / `www.digimun.pro`. Uses `ReCaptchaV3Provider` with key `6LcI9oUsAAAA...`. Protects Firestore from unauthorized access. Includes exponential backoff (up to 3 retries) to prevent throttling errors. A window-level flag prevents duplicate initialization when the module is imported by multiple scripts on the same page. The SDK's built-in `isTokenAutoRefreshEnabled: true` handles token lifecycle.

### Push Notifications (FCM)
Cloud Messaging is integrated via `push-notifications.js` (loaded by `sidebar-include.js`) and `messaging-sw.js` (service worker). Users see a "Notifications" toggle button in the sidebar (logged-in only). FCM tokens are stored in Firestore `users/{emailLower}.fcmTokens` as an array. VAPID key is hardcoded in `push-notifications.js`. In-app toast notifications display when the app is in the foreground; background notifications are handled by the service worker. A notification bell icon appears in the homepage navbar and dashboard header; clicking it opens a slide-out panel showing notification history from the `notifications` Firestore collection. Unread notifications show a pulsing green badge on the bell. A fintech-styled bottom prompt encourages logged-in users to enable notifications (dismissible, stored in localStorage).

### Important Architecture Notes
- **Firestore composite indexes required**: Server-side queries use `.orderBy()` with `.where()` for performance. `all-signals.cjs` uses `.orderBy('createdAt', 'desc').limit(100)`. `signal-auto-expire.cjs` uses `.where('status', '==', 'pending').where('createdAt', '<', timestamp).orderBy('createdAt', 'asc')`. `signal-history.cjs` uses `.where('userEmail', '==', ...).orderBy('createdAt', 'desc').limit().startAfter()`. Required composite indexes are documented in `firestore.indexes.json` (signals: userEmail+createdAt, status+createdAt). Deploy indexes via Firebase CLI or create them manually in Firebase Console.
- **Admin email security**: The `ADMIN_EMAIL` env var must be set in all environments (Replit shared env + Netlify env vars) for admin functions to work.
- **Firebase Admin init**: Shared singleton in `netlify/functions/firebase-admin-init.cjs` exports `admin`, `db`, `initError`, `getCorsHeaders()`, `verifyFirebaseToken()`, `verifyAdmin()`, `isAdminEmail()`, `isAdminOrModerator()`, `getAdminRole()`, `logAdminAction()`.
- **Shared auth/user-profile module**: `auth-profile.js` provides a single `onAuthStateChanged` listener with real-time Firestore `onSnapshot` for user doc updates. Other scripts (`user-badges.js`, `suspension-check.js`, `access-gate.js`) consume this via `onProfileChange()` instead of attaching duplicate auth listeners. This eliminates redundant Firestore reads.
- **Admin panel pagination**: `mxpanel49d.js` uses paginated Firestore queries (200 users per batch via `orderBy(documentId()).startAfter().limit()`) instead of fetching the entire users collection in one call.
- **Visitor tracker**: `visitor-tracker.js` uses the modular v10 SDK from `platform.js` instead of loading separate compat SDK scripts. Loaded as `type="module"` via `sidebar-include.js`.
- **Signal history pagination**: `signal-history.cjs` uses cursor-based pagination with `startAfter()` instead of offset-based slicing. Clients pass `startAfter` (signal doc ID) for subsequent pages.

### Support Ticket System
Professional chat-style support system with conversation threads.
- **Status workflow**: `open` (new ticket) -> `waiting-user` (admin replied) -> `waiting-support` (user replied) -> `closed`. Admin can also manually set any status.
- **Admin capabilities**: Chat bubble UI, edit/delete own replies (with Firestore Timestamp serialization via `serializeReply()`), "Info" panel visible by default (shows subject/reason, original message, contact, attachments), auto-scroll, and "Create Ticket" for any user (creates ticket + sends email notification).
- **User capabilities**: Chat bubble conversation view, auto-scroll, reply with attachments, close own tickets.
- **Email notifications**: Support reply emails do NOT include message content (security) - only a link to the dashboard.
- **Auto-management**: `ticket-auto-manage.cjs` function handles 3-day inactivity reminders and 4-day auto-close with email notifications. Runs automatically every 6 hours via Netlify scheduled function (`netlify.toml`), plus manual "Auto-Manage" button in admin ticket toolbar. Uses `db` directly from `firebase-admin-init.cjs` (not `getFirestore`).
- **Admin reply detection**: Checks `reply.adminEmail || reply.isAdmin === true || reply.from === 'admin'` to support both legacy and new reply formats.
- **XSS prevention**: All attachment URLs are sanitized via `escapeHtml()` before rendering. Image viewer uses `this.src` reference instead of inline URL interpolation.

### Data Model (Firestore)
The Firestore database includes collections for `users`, `stats`, `tickets`, `reviews`, `signals`, `signalCounters`, `signalBatches`, `notifications`, `deletedAccounts`, `admin2faSessions`, `pageVisits`, `activeVisitors`, and `adminLogs`. These collections store user profiles, signal data, help desk submissions, reviews, manage signal processing workflows, push notification history, and admin security sessions. Tickets use `replies` array with `isAdmin`, `adminEmail`, `edited`, `editedAt` fields. Ticket status values: `open`, `waiting-user`, `waiting-support`, `replied`, `closed`.

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
A suite of Netlify Functions manages various aspects of the signal system, including saving new signals, checking pending signals, submitting results, retrieving history, auto-expiring pending signals, and admin functionalities for signal and batch management, reporting, public signal endpoints, and `send-push-notification.cjs` for admin-authenticated FCM push notifications (broadcast to all users or single email target, with stale token cleanup). All functions use `getCorsHeaders()` for CORS and `verifyAdmin()`/`verifyFirebaseToken()` for authentication.

### Unified Checkout System
**`checkout.html`** is the single unified checkout page handling both manual (Binance Pay, USDT TRC20, Local/Pakistan) and automated crypto (NOWPayments 100+ coins) payment flows. Features:
- **Multi-step flow**: Step 1 (Select Product) → Step 2 (Payment Method) → Step 3 (Payment Details/Verification) → Step 4 (Confirmation)
- **Visual progress stepper** at top showing current step
- **Product selection cards** with radio selection; already-owned products auto-hidden via Firestore user doc check
- **Promo code system**: API validation against `/.netlify/functions/promo-codes`, inline success/error states, strikethrough pricing, auto-apply from URL params or sessionStorage, remove functionality
- **Payment method tabs**: Binance Pay (Pay ID + QR), USDT TRC20 (wallet address + QR + network warning), Crypto auto-pay (NOWPayments), Local Pakistan (Telegram contact)
- **Toast notification system**: All user feedback via inline toasts (no `alert()` calls)
- **Copy buttons** with clipboard API and toast feedback
- **Verification form** (manual path): Auto-filled email from Firebase auth, payment method dropdown, amount field. Submit generates formatted message with preview, Telegram share, copy, and support ticket options
- **Crypto payment flow** (automated path): Creates NOWPayments invoice → animated status stepper (Order Created → Waiting → Confirming → Complete) → 15s polling → receipt screen
- **Login gate**: Professional login-required screen with redirect
- **Trust indicators**: Human verification, activation time, no auto-billing, active traders count
- **Mobile-first responsive**: Sticky bottom CTA, stacked layouts, touch targets
- **Premium fintech design**: Dark theme, glass-morphism, micro-animations, Inter font, gradient accents
- `crypto-checkout.html` redirects to `checkout.html` preserving URL params for backward compatibility
- `payment-details.html` and `digimunx-payment-portal.html` left as-is (legacy portals)

### Crypto Auto Payment System (NOWPayments)
Automated cryptocurrency payment processing for Pro Bot ($6), DigiMaxx 1-Day ($7), DigiMaxx 3-Day ($14), DigiMaxx Lifetime ($49.99), DigimunX Standard ($20), and DigimunX Discounted ($10). Uses NOWPayments API with direct payment mode (10 supported coins).
- **Supported coins**: btc, eth, usdttrc20, ltc, bnbbsc, sol, doge, trx, xrp, matic — validated via `SUPPORTED_CURRENCIES` whitelist in `crypto-create-invoice.cjs`.
- **`crypto-create-invoice.cjs`**: Creates NOWPayments direct payment (or invoice fallback), saves payment record to `cryptoPayments` collection. Features: `SUPPORTED_CURRENCIES` whitelist with alias mapping, `mapNowPaymentsError()` for user-friendly error messages, pre-flight currency validation, rate limiting (30s cooldown), duplicate order prevention with coin-switch handling, promo code support, expiry-aware access check.
- **`crypto-ipn-webhook.cjs`**: Receives NOWPayments IPN callbacks, verifies HMAC-SHA512 signature. Full logging at every step (HMAC check, doc lookup via payment_id/invoice_id/order_id fallback, amount validation, access grant). On confirmed payment: auto-updates user Firestore field to "approved" with proper expiry for time-limited plans, sends email + push notification, updates `paymentSummary` aggregation.
- **`crypto-payment-status.cjs`**: Frontend polls this every 15s. Checks NOWPayments API directly as backup if IPN fails. Auto-grants access when NOWPayments confirms payment with proper expiry fields. Returns step indicators for UI.
- **`crypto-test.cjs`**: Diagnostic endpoint — validates API key, IPN secret, checks all 10 coin codes against `/v1/estimate` with $7 test amount, reports which coins work/fail.
- **`crypto-admin.cjs`**: Admin-only endpoint for listing all crypto payments, revenue summary, and refund toggle.
- **`crypto-checkout.html`**: Legacy page, now redirects to unified `checkout.html` preserving all URL params (product, invoice, status, promo).
- **Firestore collections**: `cryptoPayments` (full transaction records with invoice ID, email, product, amounts, crypto details, status, timestamps, refund eligibility), `paymentSummary` (aggregated revenue for accounting/tax).
- **Admin panel section**: "Crypto Payments" in mxpanel49d with revenue cards, searchable/filterable transaction table, CSV export, manual refund toggle.
- **Environment variables required**: `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET` (from NOWPayments dashboard).
- **Refund policy**: Refund available only before access is granted; no refund after activation.

### DigimunXLive Standalone Page
This page displays only admin-approved signals with masked identities, providing a public view of successful trades. It features two tabs for Telegram integration and website-displayed signals, with real-time updates for new approvals and performance statistics. Data privacy is maintained by sanitizing information through server-side endpoints.

### Admin PDF Report Download
Admins can generate professional PDF reports of user signal data, including performance summaries and detailed signal tables, branded with Digimun Pro.

### Advanced Money Management System
A comprehensive, customizable money management tool with a tab-based interface for configuration, a dashboard for real-time calculations, a compound growth calculator, and discipline prompts. It features a "Smart Calculator" for instant risk assessment and supports saving/loading multiple profiles, exporting/importing settings, and generating a professional PDF trading plan.

### My Bots & Licenses Section (Profile Page)
The My Profile page (`my-profile.html`) includes a "My Bots" section showing five cards: Pro Bot, DigiMaxx, DigimunX, Auto Hedger, and Money Mgmt. Each card's Active/Locked status is determined by Firestore user fields. A "My Licenses" section appears below My Bots, showing the user's saved Auto Hedger license key from localStorage (`dg_hedger_license`). On page load, the license is verified against the backend API (`https://digimun.replit.app/api/licenses/verify-access`) — if valid, it shows as "Active" with copy/open buttons; if invalid/expired, it clears from localStorage and shows "Renew License" link; if network fails, it shows "Could not verify" but still displays the key. The license is linked to the user's email address.

### Auto Hedger Bot
Digimun Auto Hedger is a premium floating widget that overlays on top of any trading website. It automatically executes hedge trades with a single click, supports consecutive trades (1-5 in sequence), and provides real-time win/loss detection. The bot uses a license key system (format: DG-XXXXXXXX) with device fingerprinting for security. Its details page is `auto-hedger-details.html`. The bot's backend/API is hosted at `https://digimun.replit.app`. Dashboard access status is controlled via Firestore `hedgerStatus` field. The bot is listed across: dashboard (Trading Bots grid + bot access status + botData JS object), how-it-works page (bots grid + available options list), index.html (SEO structured data + hero modules + service cards), and sitemap.xml.

**Auto Hedger Pricing** (10 plans via Weekly/Monthly tabs):
- 1 Device: $30/week, $100/month
- 2 Devices: $50/week, $160/month
- 3 Devices: $70/week, $220/month
- 4 Devices: $85/week, $280/month
- 5 Devices: $100/week, $340/month
All pricing cards link to `/checkout?product=...&price=...` for payment flow.

**Free Access Option**: Between pricing and features sections. Users create Quotex account via referral link (`https://broker-qx.pro/sign-up/?lid=1422017`), deposit, then send their Quotex Account ID to admin on Telegram (`t.me/Digimun49`). Three buttons: Create Quotex Account (green), Send ID on Telegram, Support Ticket. Admin manually issues a free license key after verification.

**Locked Setup Content**: The "How To Setup & Use" section is locked behind license key verification via `https://digimun.replit.app/api/licenses/verify-access`. After verification, 4 installation code blocks are revealed via tabbed interface (Desktop Console, Android Bookmark, Safari Address Bar, iOS Shortcut). Browser is auto-detected and correct tab is pre-selected. Codes are injected dynamically by JS — not in HTML source. All code uses `https://digimun.replit.app` as both API base and inject script source (`/inject.js`). License key saved to Firestore (`hedgerStatus`, `hedgerLicenseKey`, `hedgerActivatedAt`) and cached in localStorage (`dg_hedger_license`). Firestore takes priority on return visits. Dashboard and My Profile check both sources for access status.

### Admin Panel Bug Fixes (March 2026)
Fixed critical issues in admin panel HTML and JS:
1. **DOMContentLoaded race condition (ROOT CAUSE)**: The admin JS module is loaded dynamically as `type="module"` after DOM is parsed. Three `DOMContentLoaded` callbacks (mobile menu, 2FA verify button, access duration modal) NEVER fired because the event had already dispatched. This meant the 2FA "Verify Code" button had no click handler → users couldn't authenticate → `isAdminAuthenticated` stayed false → ALL buttons silently failed. Fixed by replacing `DOMContentLoaded` with immediate IIFEs.
2. **deleteSignal overwrite conflict**: Telegram signals modal had `deleteSignal()` which was overwritten by websignals' `window.deleteSignal(signalId)`. Modal version renamed to `deleteSignalFromModal()`.
3. **Silent auth failures**: All `isAdminAuthenticated` guards now show toast error messages instead of silently returning.
4. **Module load verification**: Added 10s timeout check that shows error banner if JS module fails to initialize.
5. **Fragile JSON serialization**: `renderSignalsTable` now uses `_websignalDataCache` object instead of inline JSON in onclick attributes. `editSignal` and `deleteSignal` resolve data from cache.

### Notification System Improvements (March 2026)
- Added **Eid Campaign Templates** (3 templates): Eid Mubarak greeting, 50% OFF sale, Free 3-day VIP trial
- Added **Notification History** section in admin panel showing last 20 sent notifications with timestamp, target, and content
- History auto-loads when opening Push Notifications section
- `get-notifications.cjs` now returns admin-only fields (target, sent, failed) only when authenticated admin requests
- All notification history content is HTML-escaped to prevent injection
- Timestamp parsing handles number, Firestore Timestamp, and string formats

### Technical SEO Foundation (April 2026)
- **robots.txt**: Comprehensive Disallow rules for all private/authenticated pages (dashboard, signal, payment, checkout, VIP portals, tickets, admin, profile, etc.)
- **sitemap.xml**: Auto-generated via `scripts/generate-sitemap.cjs` (122 public URLs incl. 62 programmatic SEO pages). Skips private routes. Run `node scripts/generate-sitemap.cjs` to regenerate.
- **Structured Data (JSON-LD)**: SoftwareApplication schema on pro-bot-details, future-signals-details, auto-hedger-details, DigimunX-details. Product + AggregateRating + Review schema on reviews.html. BreadcrumbList schema on all key public pages (product details, reviews, connect, help, choose-platform, vip-groups-details).
- **Image Optimization**: `loading="lazy"` added to all `<img>` tags across the site (except logos/nav). Script: `scripts/optimize-images.cjs`.
- **Private Page Protection**: All private pages have `<meta name="robots" content="noindex, nofollow">` (dashboard, checkout, payment, payment-details, my-tickets, free-vip, paid-vip-portal, etc.). Fixed dashboard & VIP portals that incorrectly had `index, follow`.
- **OG URL Consistency**: Fixed `.html` extensions in og:url meta tags to use clean URLs matching canonical tags.
- **Canonical Tags**: Added to connect.html. Existing canonical tags verified on all public pages.

### Programmatic SEO Landing Pages (April 2026)
- **Generator**: `scripts/generate-seo-pages.cjs` — reads JSON data from `seo-data/` and outputs 62 HTML pages to `seo/` directory
- **Data files**: `seo-data/brokers.json` (6), `seo-data/assets.json` (17), `seo-data/indicators.json` (11), `seo-data/markets.json` (5)
- **URL patterns** (7 categories, 62 pages total):
  - `/binary-options-signals/{broker}` — 6 pages (broker signal guides)
  - `/trading-bots/{broker}` — 6 pages (bot guides per broker)
  - `/binary-options-strategy/{indicator}` — 11 pages (indicator strategy guides)
  - `/best-trading-bot-for-{broker}` — 6 pages (best bot comparison)
  - `/ai-trading-signals-for-{asset}` — 17 pages (asset-specific signal guides)
  - `/how-to-trade-{pair}` — 11 pages (currency pair trading guides)
  - `/best-indicator-for-{market}` — 5 pages (market-specific indicator guides)
- **SEO features per page**: Unique title/meta description, H1-H2 hierarchy, FAQPage schema, BreadcrumbList schema, canonical tags, OG tags, internal linking (blog + products + cross-SEO pages), CTA sections
- **Shared CSS**: `seo/seo-page.css` — dark fintech design matching site theme (Inter font, #00D4AA accent), plus pillar page styles (TOC, authority section, cluster links, pillar navigation)
- **Routing**: `_redirects` maps clean URLs → `seo/*.html` files (200 rewrites)
- **Sitemap**: 129 URLs total (62 programmatic + 7 pillar + 60 core pages). Pillar pages at 0.90 priority, weekly changefreq.

### Pillar Pages & Content Hub (April 2026)
- **Generator**: `scripts/generate-pillar-pages.cjs` — reads `seo-data/pillars.json`, generates 7 comprehensive pillar pages with Article+FAQPage+BreadcrumbList schemas, TOC, authority section, cluster links to SEO pages, and pillar cross-navigation.
- **Topics** (7): binary-options-trading, ai-trading-signals, trading-bots, broker-reviews, trading-indicators, trading-strategies, risk-management
- **Internal Linking Engine**: `scripts/internal-linking-engine.cjs` — scans public HTML (blog + SEO pages), inserts contextual keyword-to-pillar-URL links. Max 3 links per page. Skips private/authenticated pages.
- **Blog Topic Clusters**: blog.html has a "Topic Guides" section linking to all 7 pillar pages above the article grid.
- **To regenerate all**: `node scripts/generate-seo-pages.cjs && node scripts/generate-pillar-pages.cjs && node scripts/internal-linking-engine.cjs && node scripts/generate-sitemap.cjs`

### Promo Code System (March 2026)
- **Backend**: `netlify/functions/promo-codes.cjs` — Firestore `promoCodes` collection
  - `GET ?action=validate&code=X` — read-only validation (does NOT increment usage), public endpoint. Returns `expiresAt` ISO string for countdown timer.
  - `POST ?action=redeem&code=X&uid=Y` — private endpoint (requires Firebase token). Atomically increments usage and updates user's `promoRedeemed` field.
  - `POST ?action=create` — admin only. Creates new promo code with expiry and usage limit.
- **Frontend Integration**: Checkout page (`checkout.html`) features a promo code input with real-time validation, a live expiry countdown timer, and automated price updates after redemption. Redeemed status is persisted in the user's Firestore profile.
- **Admin Management**: Admin panel (`mxpanel49d.js`) includes a "Promo Codes" section for creating and managing codes, with a real-time table showing code details, usage, and expiry status. Supports deleting promo codes.
