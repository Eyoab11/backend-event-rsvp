# Event RSVP Backend API

A robust NestJS-based backend API for managing event registrations, invitations, and attendee check-ins with QR code generation, email notifications, and Google Sheets integration.

## Features

- **Event Management**: Create and manage events with capacity limits and waitlist support
- **Invitation System**: Generate unique invitation tokens with expiration dates
- **RSVP Processing**: Handle attendee registrations with plus-one support
- **Email Notifications**: Automated confirmation and waitlist emails via Brevo
- **QR Code Generation**: Unique QR codes for each attendee for event check-in
- **Calendar Integration**: Generate .ics calendar files for attendees
- **Google Sheets Sync**: Real-time attendee data synchronization (optional)
- **Admin Dashboard API**: Comprehensive endpoints for event administration
- **Rate Limiting**: Built-in protection against abuse
- **JWT Authentication**: Secure admin access

## Tech Stack

- **Framework**: NestJS 11
- **Database**: PostgreSQL with Prisma ORM
- **Email Service**: Brevo (formerly Sendinblue)
- **Authentication**: JWT
- **QR Codes**: qrcode library
- **Calendar**: ics library
- **Google Sheets**: googleapis (optional)

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Brevo account with API key
- (Optional) Google Cloud project with Sheets API enabled

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend-event-rsvp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/event_rsvp?schema=public"
   
   # JWT
   JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
   
   # Admin Credentials
   ADMIN_EMAIL="admin@example.com"
   ADMIN_PASSWORD="admin123"
   
   # Email Service (Brevo)
   BREVO_API_KEY="your-brevo-api-key-here"
   FROM_EMAIL="noreply@yourdomain.com"
   
   # Frontend URLs
   FRONTEND_URL="http://localhost:3000"
   ADMIN_URL="http://localhost:3001"
   
   # Server
   PORT=3002
   NODE_ENV="development"
   ```

4. **Set up the database**
   ```bash
   # Run migrations
   npx prisma migrate deploy
   
   # (Optional) Seed with sample data
   npm run db:seed
   ```

5. **Start the server**
   ```bash
   # Development mode with hot reload
   npm run start:dev
   
   # Production mode
   npm run build
   npm run start:prod
   ```

The API will be available at `http://localhost:3002`

## API Documentation

### Public Endpoints

#### Invite Validation
```http
GET /api/invite/validate/:token
```
Validates an invitation token and returns event details.

#### RSVP Submission
```http
POST /api/rsvp/submit
Content-Type: application/json

{
  "inviteToken": "string",
  "name": "string",
  "email": "string",
  "company": "string",
  "plusOne": {
    "name": "string",
    "email": "string",
    "company": "string"
  }
}
```

#### Registration Details
```http
GET /api/rsvp/success/:attendeeId
```
Retrieves registration confirmation details.

#### QR Code Validation
```http
GET /api/qr/validate/:qrCode
```
Validates a QR code for check-in.

#### Calendar Download
```http
GET /api/calendar/attendee/:attendeeId/download
```
Downloads .ics calendar file for an attendee.

### Admin Endpoints (Requires JWT)

#### Authentication
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "admin123"
}
```

#### Event Management
```http
GET    /api/event              # List all events
GET    /api/event/:id          # Get event details
POST   /api/event              # Create event
PUT    /api/event/:id          # Update event
DELETE /api/event/:id          # Delete event
```

#### Invitation Management
```http
POST /api/invite/create        # Create single invite
POST /api/invite/bulk-create   # Create multiple invites
GET  /api/invite/event/:eventId # List event invites
POST /api/invite/resend/:id    # Resend invitation email
```

#### Admin Dashboard
```http
GET /api/admin/events/:eventId/attendees  # List attendees
GET /api/admin/events/:eventId/stats      # Event statistics
GET /api/admin/events/:eventId/export     # Export attendee data
POST /api/admin/attendees/:id             # Cancel registration
GET /api/admin/dashboard-stats            # Overall statistics
```

For complete API documentation, see the [docs](./docs) directory.

## Project Structure

```
backend-event-rsvp/
├── src/
│   ├── modules/
│   │   ├── admin/          # Admin dashboard endpoints
│   │   ├── auth/           # JWT authentication
│   │   ├── calendar/       # Calendar file generation
│   │   ├── email/          # Email service (Brevo)
│   │   ├── event/          # Event management
│   │   ├── invite/         # Invitation system
│   │   ├── qr/             # QR code generation/validation
│   │   ├── rsvp/           # RSVP processing
│   │   └── sheets/         # Google Sheets integration
│   ├── prisma/             # Prisma service
│   ├── app.module.ts       # Root module
│   └── main.ts             # Application entry point
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── migrations/         # Database migrations
│   └── seed.ts             # Database seeding
├── docs/                   # Additional documentation
└── test/                   # E2E tests
```

## Database Schema

The application uses the following main entities:

- **Event**: Event details, capacity, and settings
- **Invite**: Invitation tokens and metadata
- **Attendee**: Registered attendees with QR codes
- **PlusOne**: Plus-one guests with separate QR codes

See [prisma/schema.prisma](./prisma/schema.prisma) for the complete schema.

## Email Templates

The system sends automated emails for:

- **Invitation Emails**: Personalized event invitations with RSVP links
- **Confirmation Emails**: Registration confirmation with QR code and calendar file
- **Plus-One Emails**: Separate confirmation for plus-one guests
- **Waitlist Emails**: Notification when event is at capacity

Email templates are customizable in `src/modules/email/email.service.ts`.

## Google Sheets Integration (Optional)

The system can sync attendee data to Google Sheets in real-time. Two methods are supported:

1. **Webhook Method** (Recommended): Uses Google Apps Script webhook
2. **Service Account Method**: Direct API integration

See [docs/GOOGLE_SHEETS_INTEGRATION.md](./docs/GOOGLE_SHEETS_INTEGRATION.md) for setup instructions.

## Development

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format
```

### Database Management

```bash
# Create a new migration
npx prisma migrate dev --name migration_name

# Reset database
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio
```

## Deployment

### Environment Configuration

1. Update `.env` with production values:
   - Set `NODE_ENV="production"`
   - Use strong `JWT_SECRET` (min 32 characters)
   - Change default `ADMIN_PASSWORD`
   - Update `FRONTEND_URL` and `ADMIN_URL` to production domains
   - Configure production database URL

2. Build the application:
   ```bash
   npm run build
   ```

3. Run database migrations:
   ```bash
   npx prisma migrate deploy
   ```

4. Start the production server:
   ```bash
   npm run start:prod
   ```

### Security Considerations

- Always use HTTPS in production
- Rotate JWT secrets regularly
- Use strong admin passwords
- Enable rate limiting (configured by default)
- Keep dependencies updated
- Never commit `.env` files

### Recommended Hosting

- **Backend**: Railway, Render, Heroku, AWS, DigitalOcean
- **Database**: Railway, Supabase, AWS RDS, DigitalOcean Managed Databases

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Yes | Secret for JWT tokens | `your-secret-key` |
| `ADMIN_EMAIL` | Yes | Admin login email | `admin@example.com` |
| `ADMIN_PASSWORD` | Yes | Admin login password | `secure-password` |
| `BREVO_API_KEY` | Yes | Brevo email API key | `xkeysib-...` |
| `FROM_EMAIL` | Yes | Sender email address | `noreply@yourdomain.com` |
| `FRONTEND_URL` | Yes | Public RSVP frontend URL | `https://rsvp.yourdomain.com` |
| `ADMIN_URL` | Yes | Admin dashboard URL | `https://admin.yourdomain.com` |
| `PORT` | No | Server port | `3002` |
| `NODE_ENV` | No | Environment mode | `development` or `production` |
| `GOOGLE_SHEETS_WEBHOOK_URL` | No | Google Sheets webhook | `https://script.google.com/...` |

## Troubleshooting

### Common Issues

**Database connection fails**
- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check firewall settings

**Emails not sending**
- Verify `BREVO_API_KEY` is valid
- Check `FROM_EMAIL` is verified in Brevo dashboard
- Review backend logs for errors

**CORS errors**
- Ensure `FRONTEND_URL` and `ADMIN_URL` match exactly
- Check for trailing slashes in URLs
- Verify CORS configuration in `src/main.ts`

**QR codes not generating**
- Check attendee has a valid `registrationId`
- Verify QR service is properly initialized
- Review error logs

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues, questions, or contributions, please open an issue on GitHub.

## Acknowledgments

- Built with [NestJS](https://nestjs.com/)
- Database management with [Prisma](https://www.prisma.io/)
- Email service by [Brevo](https://www.brevo.com/)
- QR code generation with [node-qrcode](https://github.com/soldair/node-qrcode)
