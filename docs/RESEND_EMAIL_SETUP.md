# Resend Email Service Setup Guide

This guide will help you set up Resend for sending emails in the Event RSVP system.

## Why Resend?

Resend is a modern email API built for developers with:
- Simple, clean API
- Excellent deliverability
- Built-in domain verification
- React email template support
- Generous free tier (3,000 emails/month)
- Great documentation and developer experience

## Prerequisites

1. A domain you own (e.g., `yourdomain.com`)
2. Access to your domain's DNS settings
3. A Resend account (free to start)

## Step 1: Create a Resend Account

1. Go to [https://resend.com/signup](https://resend.com/signup)
2. Sign up with your email
3. Verify your email address

## Step 2: Verify Your Domain

**Important:** You must verify your domain before you can send emails.

1. Log into your Resend dashboard
2. Go to **Domains** in the sidebar
3. Click **Add Domain**
4. Enter your domain (e.g., `yourdomain.com`)
5. Resend will provide DNS records to add:
   - **SPF Record** (TXT)
   - **DKIM Record** (TXT)
   - **DMARC Record** (TXT)

### Adding DNS Records

The exact steps depend on your DNS provider (Cloudflare, GoDaddy, Namecheap, etc.):

1. Log into your DNS provider
2. Find the DNS management section
3. Add each record provided by Resend:
   - Type: `TXT`
   - Name: (as provided by Resend)
   - Value: (as provided by Resend)
4. Save the records

**Note:** DNS propagation can take up to 48 hours, but usually completes within minutes.

### Verify Domain Status

1. Return to Resend dashboard
2. Click **Verify** next to your domain
3. Wait for all records to show as verified (green checkmarks)

## Step 3: Get Your API Key

1. In Resend dashboard, go to **API Keys**
2. Click **Create API Key**
3. Give it a name (e.g., "Event RSVP Production")
4. Select permissions: **Sending access**
5. Click **Create**
6. **Copy the API key** (starts with `re_`)
   - ⚠️ You won't be able to see it again!

## Step 4: Configure Your Backend

1. Open `backend-event-rsvp/.env`
2. Update the email configuration:

```env
# Email Service (Resend)
RESEND_API_KEY="re_xxxxxxxxx"
FROM_EMAIL="Events <noreply@yourdomain.com>"
```

**Important:**
- Replace `re_xxxxxxxxx` with your actual API key
- Replace `yourdomain.com` with your verified domain
- The email format can be:
  - `"Events <noreply@yourdomain.com>"` (with name)
  - `"noreply@yourdomain.com"` (without name)

## Step 5: Test Email Sending

Restart your backend server:

```bash
cd backend-event-rsvp
npm run start:dev
```

Check the logs for:
```
✅ Email service initialized with Resend API
```

### Send a Test Email

1. Create an invite in the admin dashboard
2. Send the invite to your email
3. Check your inbox

If emails aren't arriving:
- Check spam folder
- Verify domain is fully verified in Resend
- Check backend logs for errors
- Verify API key is correct

## Email Types Sent

The system sends these email types:

### 1. Confirmation Emails
- Sent when attendee successfully RSVPs
- Includes event details
- Attaches QR code for check-in
- Attaches calendar file (.ics)

### 2. Plus-One Confirmation Emails
- Sent to plus-one guests
- Includes their own unique QR code
- Separate from primary attendee

### 3. Waitlist Emails
- Sent when event is at capacity
- Notifies attendee they're on waitlist

### 4. Invitation Emails
- Sent from admin dashboard
- Contains unique invitation link
- Customizable content

## Resend Features

### Free Tier Includes:
- 3,000 emails per month
- 100 emails per day
- Domain verification
- Email analytics
- Webhook support
- API access

### Paid Plans:
- More emails per month
- Higher daily limits
- Priority support
- Advanced analytics

## Monitoring & Analytics

### View Email Activity

1. Log into Resend dashboard
2. Go to **Emails** in sidebar
3. See all sent emails with:
   - Delivery status
   - Opens (if tracking enabled)
   - Clicks (if tracking enabled)
   - Bounces
   - Complaints

### Check Individual Email

Click on any email to see:
- Full email content
- Delivery timeline
- Recipient information
- Error messages (if any)

## Troubleshooting

### Issue: Emails not sending

**Check:**
1. `RESEND_API_KEY` is set correctly in `.env`
2. Backend server restarted after changing `.env`
3. Domain is fully verified in Resend dashboard
4. Check backend logs for error messages

### Issue: Emails going to spam

**Solutions:**
1. Ensure all DNS records are properly configured
2. Use a professional sender name and email
3. Avoid spam trigger words in subject/content
4. Warm up your domain (start with small volumes)

### Issue: "Domain not verified" error

**Check:**
1. All DNS records added correctly
2. DNS propagation completed (can take up to 48 hours)
3. Click "Verify" button in Resend dashboard
4. Use a DNS checker tool to verify records

### Issue: API key invalid

**Check:**
1. API key copied correctly (no extra spaces)
2. API key starts with `re_`
3. API key has "Sending access" permission
4. API key not deleted in Resend dashboard

## Best Practices

### 1. Use a Subdomain
Instead of `yourdomain.com`, use `mail.yourdomain.com` or similar:
- Protects your main domain reputation
- Easier to manage email-specific DNS
- Industry standard practice

### 2. Professional Sender Email
Use professional addresses:
- ✅ `noreply@yourdomain.com`
- ✅ `events@yourdomain.com`
- ✅ `hello@yourdomain.com`
- ❌ `test@yourdomain.com`
- ❌ `admin@yourdomain.com`

### 3. Monitor Deliverability
- Check Resend dashboard regularly
- Watch for bounces and complaints
- Maintain clean email lists
- Remove invalid addresses

### 4. Test Before Production
- Send test emails to multiple providers (Gmail, Outlook, Yahoo)
- Check spam folders
- Verify all attachments work
- Test on mobile and desktop

## Environment Variables

```env
# Required
RESEND_API_KEY="re_xxxxxxxxx"          # Your Resend API key
FROM_EMAIL="Events <noreply@yourdomain.com>"  # Sender email (must use verified domain)

# Optional (already configured)
FRONTEND_URL="https://rsvp.yourdomain.com"    # For links in emails
```

## Security Notes

- ⚠️ Never commit API keys to git
- ⚠️ Use different API keys for dev/staging/production
- ⚠️ Rotate API keys periodically
- ⚠️ Restrict API key permissions to minimum needed
- ⚠️ Keep `.env` file in `.gitignore`

## Migration from Brevo

If you're migrating from Brevo:

1. ✅ Resend SDK already installed (`resend` package)
2. ✅ Email service updated to use Resend API
3. ✅ Environment variables updated
4. ⚠️ Update your `.env` file with new variables
5. ⚠️ Remove old `BREVO_API_KEY` from `.env`
6. ⚠️ Verify your domain in Resend
7. ⚠️ Test email sending

## Support & Resources

- **Resend Documentation:** [https://resend.com/docs](https://resend.com/docs)
- **Node.js Guide:** [https://resend.com/docs/send-with-nodejs](https://resend.com/docs/send-with-nodejs)
- **Domain Verification:** [https://resend.com/docs/dashboard/domains/introduction](https://resend.com/docs/dashboard/domains/introduction)
- **API Reference:** [https://resend.com/docs/api-reference/introduction](https://resend.com/docs/api-reference/introduction)
- **Support:** [https://resend.com/support](https://resend.com/support)

## Quick Start Checklist

- [ ] Create Resend account
- [ ] Add and verify your domain
- [ ] Add all DNS records (SPF, DKIM, DMARC)
- [ ] Wait for domain verification (green checkmarks)
- [ ] Create API key with sending access
- [ ] Update `.env` with `RESEND_API_KEY`
- [ ] Update `.env` with `FROM_EMAIL` (using verified domain)
- [ ] Restart backend server
- [ ] Send test email
- [ ] Check email delivery in Resend dashboard

---

**Status:** Ready for Production  
**Email Provider:** Resend  
**Configuration:** Complete
