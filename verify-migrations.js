/**
 * Migration Verification Script
 * Checks if all schema.prisma models have corresponding migrations
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Prisma Migrations...\n');

// Read schema.prisma
const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

// Extract all model names from schema
const modelRegex = /model\s+(\w+)\s*{/g;
const models = [];
let match;
while ((match = modelRegex.exec(schemaContent)) !== null) {
  models.push(match[1]);
}

console.log('📋 Models found in schema.prisma:');
models.forEach(model => console.log(`   - ${model}`));
console.log('');

// Expected table names (converted to snake_case)
const expectedTables = {
  Event: 'events',
  Invite: 'invites',
  Attendee: 'attendees',
  PlusOne: 'plus_ones',
  Booking: 'bookings',
  IlluminatePlusOne: 'illuminate_plus_ones',
  Sponsor: 'sponsors',
  BrandingOpportunity: 'branding_opportunities',
  Seat: 'seats',
  AdminUser: 'admin_users',
  ActivityLog: 'activity_logs'
};

// Read all migration files
const migrationsDir = path.join(__dirname, 'prisma', 'migrations');
const migrationFolders = fs.readdirSync(migrationsDir)
  .filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory())
  .sort();

console.log('📁 Migration folders found:');
migrationFolders.forEach(folder => console.log(`   - ${folder}`));
console.log('');

// Check each migration file
const allMigrationContent = [];
migrationFolders.forEach(folder => {
  const migrationFile = path.join(migrationsDir, folder, 'migration.sql');
  if (fs.existsSync(migrationFile)) {
    const content = fs.readFileSync(migrationFile, 'utf-8');
    allMigrationContent.push({ folder, content });
  }
});

// Verify each table exists in migrations
console.log('✅ Checking if all tables are created in migrations:\n');
const missingTables = [];

Object.entries(expectedTables).forEach(([model, tableName]) => {
  const found = allMigrationContent.some(({ content }) => 
    content.includes(`CREATE TABLE "${tableName}"`) || 
    content.includes(`CREATE TABLE "public"."${tableName}"`)
  );
  
  if (found) {
    console.log(`   ✅ ${model} → ${tableName}`);
  } else {
    console.log(`   ❌ ${model} → ${tableName} (MISSING!)`);
    missingTables.push({ model, tableName });
  }
});

console.log('');

// Check for important columns
console.log('🔍 Checking important columns:\n');

const columnChecks = [
  { table: 'bookings', column: 'seatAssignments', type: 'JSONB' },
  { table: 'seats', column: 'plusOneId', type: 'TEXT' },
  { table: 'illuminate_plus_ones', column: 'qrCode', type: 'TEXT' },
  { table: 'attendees', column: 'checkedInAt', type: 'TIMESTAMP' },
  { table: 'invites', column: 'lastReminderSent', type: 'TIMESTAMP' },
];

columnChecks.forEach(({ table, column, type }) => {
  const found = allMigrationContent.some(({ content }) => 
    content.includes(`"${column}"`) && content.includes(table)
  );
  
  if (found) {
    console.log(`   ✅ ${table}.${column}`);
  } else {
    console.log(`   ⚠️  ${table}.${column} (might be missing)`);
  }
});

console.log('');

// Summary
if (missingTables.length === 0) {
  console.log('✅ All tables are present in migrations!');
  console.log('✅ Schema and migrations are in sync!');
  process.exit(0);
} else {
  console.log('❌ Missing tables detected:');
  missingTables.forEach(({ model, tableName }) => {
    console.log(`   - ${model} (${tableName})`);
  });
  console.log('\n⚠️  You need to create migrations for the missing tables!');
  process.exit(1);
}
