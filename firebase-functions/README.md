# Digimun Pro - Firebase Cloud Functions

Email notification system using PrivateEmail SMTP.

## Setup Instructions

### 1. Install Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

### 2. Initialize Functions (if not done)
```bash
firebase init functions
```

### 3. Set SMTP Configuration
```bash
firebase functions:config:set smtp.user="your-email@privateemail.com" smtp.pass="your-email-password"
firebase functions:config:set site.url="https://your-site-url.com"
```

### 4. Deploy Functions
```bash
cd firebase-functions
npm install
firebase deploy --only functions
```

## Email Notification Types

| Type | Trigger | Description |
|------|---------|-------------|
| `ticket_reply` | Admin replies to support ticket | Sends reply content to user |
| `review_approved` | Admin approves a review | Notifies user their review is public |
| `review_reply` | Admin replies to a review | Sends reply to reviewer |

## Firestore Document Structure

```javascript
{
  type: "ticket_reply" | "review_approved" | "review_reply",
  to_email: "user@example.com",
  to_name: "User Name",
  subject: "Email subject line",
  message: "Email body content",
  link: "/my-tickets",
  status: "pending",
  createdAt: Timestamp
}
```

## Status Updates

- `pending` - Waiting to be sent
- `sent` - Successfully delivered
- `error` - Failed to send (check `error` field)
