# Digimun Pro - Firebase Cloud Functions

Email notification system using PrivateEmail SMTP with secure secret management.

---

## Complete Setup Guide

### Step 1: Install Firebase CLI
```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase
```bash
firebase login
```

### Step 3: Navigate to Your Firebase Project
```bash
cd /path/to/your/firebase-project
```

### Step 4: Initialize Functions (if not already done)
```bash
firebase init functions
```
- Select your project
- Choose JavaScript
- Say "No" to ESLint

### Step 5: Copy Files
Copy these files to your `functions/` folder:
- `index.js`
- `package.json`

### Step 6: Install Dependencies
```bash
cd functions
npm install
```

### Step 7: Set Secrets (Secure Method)
Run each command and enter the value when prompted:

```bash
# Your PrivateEmail address
firebase functions:secrets:set SMTP_USER
# Enter: noreply@digimun.pro

# Your PrivateEmail password
firebase functions:secrets:set SMTP_PASS
# Enter: [your email password - it will be hidden]

# Your website URL
firebase functions:secrets:set SITE_URL
# Enter: https://digimun.pro
```

### Step 8: Deploy
```bash
firebase deploy --only functions
```

---

## How It Works

1. Admin replies to ticket/approves review in admin panel
2. A document is created in `emailNotifications` collection
3. Cloud Function automatically triggers
4. Email is sent via PrivateEmail SMTP
5. Document status updated to "sent" or "error"

---

## Email Notification Types

| Type | Trigger | Description |
|------|---------|-------------|
| `ticket_reply` | Admin replies to support ticket | Sends reply content to user |
| `review_approved` | Admin approves a review | Notifies user their review is public |
| `review_reply` | Admin replies to a review | Sends reply to reviewer |

---

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

---

## Troubleshooting

### Check Function Logs
```bash
firebase functions:log
```

### Verify Secrets
```bash
firebase functions:secrets:access SMTP_USER
```

### Common Issues

| Issue | Solution |
|-------|----------|
| "Permission denied" | Run `firebase login` again |
| "Secret not found" | Set secrets using Step 7 |
| "Email not sent" | Check SMTP password is correct |
| "Function not triggering" | Ensure Firestore rules allow writes |

---

## SMTP Settings Reference

- **Host:** mail.privateemail.com
- **Port:** 587
- **Security:** STARTTLS
- **From:** noreply@digimun.pro
