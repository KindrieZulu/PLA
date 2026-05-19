# Email Feature Implementation Guide

## Overview
The email reporting feature allows students to:
1. **Send Mastery Reports** - Email their progress report to themselves or guardians
2. **Send Support Queries** - Ask questions to the support team

## Architecture

### Backend (pla-backend/)

**Service Layer** (`src/services/emailService.js`)
```javascript
sendReport({ email, subject, type, message, data = {} })
sendQuery({ email, subject, message })
sendMasteryReport({ email, skills, overallProgress })
```

**Controller Layer** (`src/controllers/emailController.js`)
- `POST /api/v1/email/send-report` - Sends mastery report
- `POST /api/v1/email/send-query` - Sends support query
- `POST /api/v1/email/send-achievement` - Sends achievement notification

**Route Layer** (`src/routes/emailRoutes.js`)
- Express-validator chains for input validation
- Authentication middleware requirement
- Rate limiting ready (can be added)

### Frontend (pla-webApp/)

**API Wrappers** (`src/api/api.js`)
```javascript
sendMasteryReport(email, skills, overallProgress)
sendSupportQuery(subject, message)
sendAchievementReport(email, achievement, skill, date)
```

**UI Component** (`src/components/EmailReportModal.js`)
- Modal with 2 tabs: Reports & Queries
- Form validation and error handling
- Loading states and success feedback

**Integration** (`src/pages/Dashboard.js`)
- "📧 Send Report" button in hero section
- Opens modal on click
- Passes user email and mastery data

## Deployment Checklist

### 1. Install Dependencies
```bash
cd pla-backend
npm install nodemailer
```

### 2. Configure Environment Variables
Create/update `.env` in `pla-backend/`:
```env
# Email Configuration
SUPPORT_EMAIL=support@pla-app.com
EMAIL_FROM=noreply@pla-app.com
EMAIL_SERVICE=gmail  # or 'SendGrid', 'Mailgun', 'SMTP'
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password  # Use app password for Gmail, API key for others
EMAIL_PORT=587
```

### 3. Update emailService.js
Replace the mock implementation with real nodemailer transporter:

```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

static async sendReport({ email, subject, type, message, data = {} }) {
  const html = this.generateEmailHTML(type, message, data);
  
  const result = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject,
    html,
    text: message,
  });
  
  return { success: true, messageId: result.messageId };
}
```

### 4. Test Email Endpoints
```bash
# Test mastery report
curl -X POST http://localhost:5000/api/v1/email/send-report \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "skills": [{"name":"Algebra","mastery":0.85}],
    "overallProgress": 0.82
  }'

# Test support query
curl -X POST http://localhost:5000/api/v1/email/send-query \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Question about problem 5",
    "message": "I don'\''t understand how to solve this problem"
  }'
```

### 5. Verify Frontend Integration
1. Start the web app: `cd pla-webApp && npm start`
2. Log in as a student
3. Click "📧 Send Report" button on Dashboard
4. Fill out and submit form
5. Check server logs for success/error messages

## Email HTML Templates

The service can generate beautiful HTML emails with:
- Student name and date
- Mastery progress chart/table
- Skill-by-skill breakdown
- Achievement badges
- Call-to-action links back to the app

### Example Template Variables
```javascript
{
  type: 'mastery',
  studentName: 'John Doe',
  overallProgress: 82,
  skills: [
    { name: 'Algebra', mastery: 0.85, status: 'mastered' },
    { name: 'Geometry', mastery: 0.72, status: 'in-progress' },
  ],
  achievements: ['5-Day Streak', 'Speed Demon'],
}
```

## Rate Limiting Recommendations
```javascript
// Add to emailRoutes.js after other middleware
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 emails per 15 min
  message: 'Too many emails sent. Please try again later.',
});

router.post('/send-report', emailLimiter, /* ...rest of middleware */ );
router.post('/send-query', emailLimiter, /* ...rest of middleware */ );
```

## MongoDB Audit Trail (Optional Enhancement)
Create a schema to track all emails sent:
```javascript
const emailLogSchema = new Schema({
  userId: ObjectId,
  email: String,
  type: String, // 'report', 'query', 'achievement'
  subject: String,
  status: String, // 'sent', 'failed'
  messageId: String,
  error: String,
  createdAt: { type: Date, default: Date.now },
});
```

## Troubleshooting

**"503 Email service unavailable"**
- Check SMTP credentials in .env
- Verify firewall allows SMTP port (usually 587)
- Test credentials with a separate email client

**"Email validation failed"**
- Check email format (must be valid RFC5322)
- Verify controller validation rules in emailRoutes.js

**"Cannot send to this email"**
- User trying to send to someone else's email
- Controller validates email matches logged-in user
- This is intentional for security (prevents info disclosure)

**Emails not arriving**
- Check spam/junk folder
- Verify sender domain isn't blacklisted
- Use SendGrid or similar service for better deliverability

## Next Steps

1. **Phase 1 - Setup** (1-2 hours)
   - Install nodemailer
   - Configure SMTP service (Gmail, SendGrid, etc.)
   - Update emailService.js with real transporter

2. **Phase 2 - Testing** (1 hour)
   - Manual curl tests of all 3 endpoints
   - End-to-end flow test in web app
   - Check email receives all data correctly

3. **Phase 3 - Enhancement** (2-4 hours)
   - Add HTML email templates
   - Add email audit logging to MongoDB
   - Add rate limiting on email endpoints
   - Add attachment support (PDF exports)

4. **Phase 4 - Production** (1 hour)
   - Deploy configuration to production environment
   - Set up email service credentials (SendGrid recommended for reliability)
   - Monitor email delivery rates
   - Set up alerts for email failures
