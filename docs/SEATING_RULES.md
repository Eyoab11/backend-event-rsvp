# Illuminate Life Gala - Seating Rules

## Overview
This document outlines the automated seating assignment rules for the Illuminate Life Gala booking system.

## Ticket Types

### 1. VIP Individual Tickets
- **Ticket Tier**: `VIP Individual`
- **Ticket Name**: `Visionary Collection`
- **Quantity**: 1 seat per booking
- **Price**: $2,500
- **Seating Rule**: Must be assigned to **front row tables only** (T1, T2, T3, or T4)

### 2. Circle of Illumination (Table Package)
- **Ticket Tier**: `Table of 10`
- **Ticket Name**: `Circle of Illumination`
- **Quantity**: 10 seats (full table)
- **Price**: $6,500
- **Seating Rule**: 
  - Purchases an **entire table** (10 seats from the same table)
  - Automatically assigns all 10 seats from a single table
  - Tables T5 and above are used for Circle of Illumination bookings
  - If no existing table with 10 available seats is found, a new table is created

### 3. Individual Tickets
- **Ticket Tier**: `Individual`
- **Ticket Name**: `Illuminator Experience`
- **Quantity**: 1 seat per booking
- **Price**: $750
- **Seating Rule**: 
  - Assigned to any available seat from T5 onwards
  - **Cannot** be assigned to T1-T4 (reserved for VIP Individual only)

## Seating Assignment Logic

### Auto-Assignment Flow
When a booking is marked as **CONFIRMED**:

1. **System checks ticket type**:
   - VIP Individual → Assigns from T1-T4 only
   - Circle of Illumination → Assigns entire table (10 seats from same table)
   - Individual → Assigns from T5+ only

2. **Seat provisioning**:
   - For **Circle of Illumination**: 
     - Searches for existing tables with 10+ available seats (T5+)
     - If found, assigns 10 consecutive seats from that table
     - If not found, creates a new table with 10 seats
   - For **Individual tickets**:
     - Uses existing available seats first
     - Creates virtual seats if inventory is insufficient

3. **Email confirmation**:
   - Email is sent **ONLY AFTER** seat assignment is complete
   - Email includes: QR code, calendar invite (.ics), seat numbers, table number

### Table Number Assignment
- Tables are numbered sequentially: T1, T2, T3, T4, T5, T6, ...
- T1-T4: Reserved for VIP Individual tickets
- T5+: Used for Circle of Illumination and Individual tickets
- System automatically finds the next available table number

## Email Flow

### Before Confirmation
- **Booking Received Email**: Sent immediately when booking is created (PENDING status)
- Contains: Booking ID, ticket details, no seat information

### After Confirmation + Seat Assignment
- **Confirmation Email**: Sent ONLY after seats are successfully assigned
- Contains: 
  - Seat numbers
  - Table number
  - QR code (attachment)
  - Calendar invite (attachment)
  - Event details

## Admin Manual Assignment

Admins can manually assign seats through the admin dashboard:

1. **For Circle of Illumination bookings**:
   - Must assign exactly 10 seats
   - All seats should be from the same table
   - System validates seat availability

2. **For Individual bookings**:
   - Can assign any available seat (respecting VIP rules)
   - System validates seat count matches booking quantity

3. **Email behavior**:
   - Email is sent automatically after manual seat assignment
   - Only sent if booking status is CONFIRMED

## Error Handling

### Circle of Illumination Errors
- **No available tables**: If no table with 10 available seats exists and table creation fails
- **Seat collision**: If attempting to create a table that already has some seats assigned

### VIP Individual Errors
- **No VIP seats available**: If T1-T4 are fully booked
- System will create virtual seats in T1-T4 range if needed

### General Errors
- **Seat already assigned**: If attempting to assign a seat that's already taken
- **Quantity mismatch**: If trying to assign more/fewer seats than booking quantity

## Database Schema

### Booking Model
```prisma
model Booking {
  ticketTier    String?  // 'Individual', 'Table of 10', 'VIP Individual'
  ticketName    String?  // Display name
  quantity      Int      // 1 for individual, 10 for table
  seatNumbers   String[] // Array of assigned seat numbers
  tableNumber   String?  // Table identifier (e.g., "5" for T5)
}
```

### Seat Model
```prisma
model Seat {
  seatNumber   String   // e.g., "T5-01", "T5-02"
  tableNumber  String?  // e.g., "5"
  seatType     SeatType // INDIVIDUAL, TABLE, VIP
  isAvailable  Boolean
  bookingId    String?
}
```

## Testing

### Test Scenarios
1. **VIP Individual booking** → Should assign from T1-T4
2. **Circle of Illumination booking** → Should assign 10 seats from same table (T5+)
3. **Individual booking** → Should assign from T5+, skip T1-T4
4. **Multiple Circle of Illumination bookings** → Each should get separate tables
5. **Email timing** → Should only send after seat assignment

### Manual Testing Steps
1. Create a booking with status PENDING
2. Mark booking as CONFIRMED
3. Verify seats are auto-assigned
4. Verify email is sent with seat information
5. Check that seat numbers match ticket type rules

## Future Enhancements

### Potential Features
- **Admin warning modal**: When Circle of Illumination booking can't be assigned due to lack of available tables
- **Table shuffling**: Allow admin to reorganize seat assignments
- **Seat preference**: Allow customers to request specific table locations
- **Waitlist**: Automatically assign seats when they become available
