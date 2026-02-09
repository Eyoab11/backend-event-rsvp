# Google Sheets Integration

This document explains how to set up and use the Google Sheets integration to automatically sync attendee registrations.

## Overview

Every time someone registers for an event, their information is automatically added to a Google Sheet. This provides:
- Real-time attendee tracking
- Easy data export and analysis
- Shareable attendee lists
- Backup of registration data

## Setup Instructions

### Step 1: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it something like "Event Attendees"
4. Copy the Sheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit
   ```

### Step 2: Set Up Google Cloud Credentials

You have two options for authentication:

#### Option A: Service Account (Recommended for Production)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the Google Sheets API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"
4. Create a Service Account:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Fill in the details and click "Create"
   - Skip optional steps and click "Done"
5. Create a Key:
   - Click on the service account you just created
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose "JSON" format
   - Download the key file
6. Share your Google Sheet with the service account email:
   - Open your Google Sheet
   - Click "Share"
   - Add the service account email (found in the JSON key file)
   - Give it "Editor" permissions

#### Option B: API Key (Simpler but Less Secure)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable the Google Sheets API (same as above)
3. Create an API Key:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the API key
4. Make your Google Sheet publicly accessible:
   - Open your Google Sheet
   - Click "Share"
   - Change to "Anyone with the link" can edit

### Step 3: Configure Environment Variables

Add the following to your `backend-event-rsvp/.env` file:

```env
# Google Sheets Integration
GOOGLE_SHEET_ID="your-sheet-id-here"

# Option A: Service Account (recommended)
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'

# OR Option B: API Key
GOOGLE_API_KEY="your-api-key-here"
```

**Important:** If using a service account, paste the entire JSON key as a single-line string.

### Step 4: Restart the Backend

```bash
cd backend-event-rsvp
npm run start:dev
```

### Step 5: Initialize the Sheet

The first time an attendee registers, the system will automatically:
- Create an "Attendees" sheet (if it doesn't exist)
- Add column headers
- Start syncing data

## Sheet Structure

The Google Sheet will have the following columns:

| Column | Description |
|--------|-------------|
| Registration Date | When the attendee registered |
| Name | Attendee's full name |
| Email | Attendee's email address |
| Company | Attendee's company |
| Title | Attendee's job title |
| Status | CONFIRMED, WAITLISTED, or CANCELLED |
| Registration ID | Unique registration identifier |
| Event | Event name |
| Has Plus One | Whether they brought a plus one |
| Checked In | Whether they've checked in at the event |

## Viewing the Sheet in Admin Dashboard

1. Log in to the admin dashboard
2. Click "Attendee Sheet" in the sidebar
3. The sheet will be embedded in the page
4. Click "Open in Google Sheets" to view in a new tab

## Troubleshooting

### Sheet Not Syncing

1. Check that `GOOGLE_SHEET_ID` is set correctly
2. Verify credentials are valid
3. Check backend logs for errors
4. Ensure the service account has edit permissions on the sheet

### "Google Sheets Not Configured" Message

This means the environment variables are not set. Follow the setup instructions above.

### Permission Errors

If using a service account, make sure you've shared the sheet with the service account email address.

## Manual Initialization

If you want to manually initialize the sheet structure:

```bash
# In the backend directory
npm run start:dev

# Then make a test registration or use the admin API
```

## Security Notes

- **Service Account Keys:** Never commit the JSON key to version control
- **API Keys:** Restrict API key usage to specific IPs if possible
- **Sheet Permissions:** Only share with necessary users
- **Environment Variables:** Keep `.env` file secure and never commit it

## Features

- ✅ Automatic sync on registration
- ✅ Plus-one tracking
- ✅ Real-time updates
- ✅ Embedded view in admin dashboard
- ✅ Direct link to Google Sheets
- ✅ Graceful failure (registration succeeds even if sync fails)

## Future Enhancements

Potential improvements:
- Bi-directional sync (update status from sheet)
- Multiple event sheets
- Custom column configuration
- Bulk import from sheet
- Advanced filtering and sorting
