#!/bin/sh

echo "Running database migrations..."
npx prisma migrate deploy

echo "Seeding database..."
#npm run db:seed

echo "Starting NestJS application..."
exec node dist/src/main
