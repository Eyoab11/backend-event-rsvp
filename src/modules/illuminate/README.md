# Illuminate Life Gala - Backend Module

Complete backend system for handling ticket bookings, sponsor inquiries, and branding requests with email notifications and comprehensive admin dashboard.

## Features

✅ **Ticket Booking System**
- Individual, Table, and VIP ticket bookings
- Seat assignment and management
- Dietary restrictions and special requests
- Email confirmations

✅ **Sponsor Management**
- Sponsor inquiry submission
- Multiple sponsorship tiers
- Logo upload and display
- Active sponsor public listing

✅ **Branding Opportunities**
- Branding inquiry submission
- Artwork upload
- Specifications management
- Status tracking

✅ **Seat Management**
- Seat inventory tracking
- Section-based organization
- Availability management
- Bulk seat creation
- Seat assignment to bookings

✅ **Admin Dashboard**
- Comprehensive statistics
- Revenue tracking
- Activity logging
- Export to CSV
- Real-time updates

✅ **Email System**
- Automated confirmations
- Seat assignment notifications
- Admin alerts
- Custom email sending

## Architecture

### Clean Architecture Layers

```
illuminate/
├── controllers/          # HTTP request handlers
│   ├── booking.controller.ts
│   ├── sponsor.controller.ts
│   ├── branding.controller.ts
│   ├── seat.controller.ts
│   └── dashboard.controller.ts
├── services/            # Business logic
│   ├── booking.service.ts
│   ├── sponsor.service.ts
│   ├── branding.service.ts
│   ├── seat.service.ts
│   ├── activity-log.service.ts
│   ├── dashboard.service.ts
│   └── illuminate-email.service.ts
├── dto/                 # Data transfer objects
│   ├── create-booking.dto.ts
│   ├── create-sponsor.dto.ts
│   └── create-seat.dto.ts
├── email-templates/     # HTML email templates
│   ├── ticket-confirmation.html
│   ├── seat-assignment.html
│   ├── sponsor-inquiry.html
│   ├── branding-inquiry.html
│   └── admin-notification.html
└── illuminate.module.ts # Module definition
```

## API Endpoints

### Public Endpoints (No Authentication)

#### POST `/illuminate/bookings/ticket`
Create a new ticket booking
```json
{
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerPhone": "(555) 123-4567",
  "ticketTier": "VIP Individual",
  "ticketName": "VIP Individual Ticket",
  "quantity": 2,
  "pricePerUnit": 2500,
  "totalAmount": 5000,
  "specialRequests": "Prefer front section",
  "dietaryRestrictions": "Vegetarian"
}
```

#### POST `/illuminate/bookings/sponsor`
Submit sponsor inquiry
```json
{
  "companyName": "TechCorp Inc",
  "contactName": "Sarah Johnson",
  "contactEmail": "sarah@techcorp.com",
  "contactPhone": "(555) 987-6543",
  "sponsorTier": "Beacon Gold Sponsor",
  "message": "Interested in logo placement"
}
```

#### POST `/illuminate/bookings/branding`
Submit branding inquiry
```json
{
  "companyName": "BrandCo",
  "contactName": "Mike Davis",
  "contactEmail": "mike@brandco.com",
  "contactPhone": "(555) 456-7890",
  "brandingType": "Banner Placement",
  "specifications": {
    "size": "10x20 feet",
    "location": "Main entrance"
  },
  "message": "Looking for prominent placement"
}
```

#### GET `/illuminate/bookings/:id/verify`
Verify booking exists

#### GET `/illuminate/sponsors/active`
Get list of active sponsors for public display

### Admin Endpoints (Authentication Required)

#### GET `/illuminate/admin/dashboard/stats`
Get comprehensive dashboard statistics

#### GET `/illuminate/bookings`
List all bookings with filters
- Query params: `type`, `status`, `search`, `page`, `limit`, `sortBy`, `sortOrder`

#### GET `/illuminate/bookings/:id`
Get single booking details with activity log

#### PATCH `/illuminate/bookings/:id`
Update booking (status, notes, follow-up date, etc.)

#### POST `/illuminate/bookings/:id/assign-seats`
Assign seats to a booking
```json
{
  "seatNumbers": ["VIP-A1", "VIP-A2"],
  "sectionName": "VIP Section",
  "tableNumber": "T1",
  "sendEmail": true
}
```

#### DELETE `/illuminate/bookings/:id`
Cancel/delete booking (releases seats)

#### GET `/illuminate/seats`
Get seat inventory with filters
- Query params: `sectionName`, `seatType`, `isAvailable`, `search`, `page`, `limit`

#### GET `/illuminate/seats/availability-overview`
Get seat availability overview by section

#### POST `/illuminate/seats`
Create single seat

#### POST `/illuminate/seats/bulk`
Bulk create seats
```json
{
  "seats": [
    {
      "seatNumber": "VIP-A1",
      "sectionName": "VIP Section",
      "seatType": "VIP"
    },
    {
      "seatNumber": "VIP-A2",
      "sectionName": "VIP Section",
      "seatType": "VIP"
    }
  ]
}
```

#### PATCH `/illuminate/seats/:id/release`
Release seat from booking

#### DELETE `/illuminate/seats/:id`
Delete seat (only if available)

#### GET `/illuminate/sponsors`
List all sponsors with filters

#### PATCH `/illuminate/sponsors/:id`
Update sponsor details

#### POST `/illuminate/sponsors/:id/logo`
Upload sponsor logo

#### DELETE `/illuminate/sponsors/:id`
Delete sponsor

#### GET `/illuminate/branding`
List all branding opportunities

#### PATCH `/illuminate/branding/:id`
Update branding opportunity

#### POST `/illuminate/branding/:id/artwork`
Upload branding artwork

#### DELETE `/illuminate/branding/:id`
Delete branding opportunity

#### GET `/illuminate/admin/activity-log`
Get activity log with filters

#### GET `/illuminate/admin/export/bookings`
Export bookings to CSV

## Database Schema

### Bookings Table
- Stores all ticket, sponsor, and branding bookings
- Tracks status, customer info, pricing, seat assignments
- Supports admin notes and follow-up dates

### Sponsors Table
- Linked to bookings
- Manages sponsor tiers, logos, website URLs
- Display order for public listing
- Active/inactive status

### Branding Opportunities Table
- Linked to bookings
- Stores branding type, specifications, artwork
- Status tracking (inquiry → approval → active)

### Seats Table
- Seat inventory management
- Section and table organization
- Availability tracking
- Booking assignment

### Admin Users Table
- Admin authentication
- Role-based access (admin, super_admin)
- Activity tracking

### Activity Logs Table
- Comprehensive audit trail
- Tracks all actions on entities
- User attribution and timestamps

## Setup Instructions

### 1. Add to Main App Module

```typescript
// src/app.module.ts
import { IlluminateModule } from './modules/illuminate/illuminate.module';

@Module({
  imports: [
    // ... other modules
    IlluminateModule,
  ],
})
export class AppModule {}
```

### 2. Run Database Migration

```bash
# Generate Prisma client
npx prisma generate

# Run migration
npx prisma migrate deploy

# Or for development
npx prisma migrate dev
```

### 3. Environment Variables

Add to `.env`:
```env
# Admin Dashboard
ADMIN_DASHBOARD_URL=http://localhost:3000/admin
ADMIN_NOTIFICATION_EMAIL=admin@illuminatelifegala.com

# Email Service (already configured)
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@illuminatelifegala.com
```

### 4. Create Initial Admin User

```typescript
// Run this script or add to seed.ts
import * as bcrypt from 'bcrypt';

const passwordHash = await bcrypt.hash('your_secure_password', 10);

await prisma.adminUser.create({
  data: {
    email: 'admin@illuminatelifegala.com',
    passwordHash,
    name: 'Admin User',
    role: 'SUPER_ADMIN',
    isActive: true,
  },
});
```

### 5. Seed Initial Seat Inventory

```typescript
// Example: Create VIP section seats
const vipSeats = [];
for (let i = 1; i <= 50; i++) {
  vipSeats.push({
    seatNumber: `VIP-A${i}`,
    sectionName: 'VIP Section',
    seatType: 'VIP',
  });
}

await prisma.seat.createMany({
  data: vipSeats,
});
```

## Email Templates

All email templates are located in `email-templates/` and use a simple variable replacement system:

- `{{variable}}` - Simple variable replacement
- `{{#if variable}}...{{/if}}` - Conditional blocks

### Available Templates

1. **ticket-confirmation.html** - Sent when ticket booking is created
2. **seat-assignment.html** - Sent when seats are assigned
3. **sponsor-inquiry.html** - Sent when sponsor inquiry is submitted
4. **branding-inquiry.html** - Sent when branding inquiry is submitted
5. **admin-notification.html** - Sent to admin for new bookings

## Testing

### Test Ticket Booking
```bash
curl -X POST http://localhost:3002/illuminate/bookings/ticket \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test User",
    "customerEmail": "test@example.com",
    "customerPhone": "(555) 123-4567",
    "ticketTier": "Individual",
    "ticketName": "Individual Ticket",
    "quantity": 1,
    "pricePerUnit": 750,
    "totalAmount": 750
  }'
```

### Test Admin Endpoints
```bash
# Login first to get token
curl -X POST http://localhost:3002/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@illuminatelifegala.com",
    "password": "your_password"
  }'

# Use token in subsequent requests
curl -X GET http://localhost:3002/illuminate/admin/dashboard/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Security Features

- JWT authentication for admin endpoints
- Role-based access control (RBAC)
- Input validation with class-validator
- SQL injection prevention via Prisma ORM
- Rate limiting (configure in main.ts)
- Activity logging for audit trail
- IP address tracking

## Best Practices

1. **Always use transactions** for operations that modify multiple tables
2. **Log all admin actions** using ActivityLogService
3. **Send emails asynchronously** to avoid blocking requests
4. **Validate seat availability** before assignment
5. **Release seats** when bookings are cancelled
6. **Use proper HTTP status codes** in responses
7. **Handle errors gracefully** with proper error messages

## Troubleshooting

### Emails not sending
- Check RESEND_API_KEY in .env
- Verify EMAIL_FROM domain is verified in Resend
- Check email service logs

### Seat assignment fails
- Verify seats exist in database
- Check seat availability status
- Ensure no duplicate seat numbers

### Authentication issues
- Verify JWT_SECRET is set
- Check token expiration
- Ensure admin user exists and is active

## Future Enhancements

- [ ] Payment integration (Stripe, PayPal)
- [ ] QR code generation for tickets
- [ ] Check-in system at venue
- [ ] Waitlist functionality
- [ ] SMS notifications
- [ ] Calendar invite generation
- [ ] PDF ticket generation
- [ ] Visual seating chart
- [ ] Multi-language support
- [ ] Advanced analytics

## Support

For issues or questions, contact the development team or refer to the main project documentation.
