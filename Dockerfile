# -------- BUILD STAGE --------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm i

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build NestJS app
RUN npm run build

# -------- PRODUCTION STAGE --------
FROM node:20-slim as runner

WORKDIR /app

# This line fixes your exact error
RUN apt-get update -y && apt-get install -y openssl

# Required for Prisma
#RUN apk add --no-cache openssl libssl1.1

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

RUN npm i

RUN npx prisma generate

# Copy entrypoint script
COPY entrypoint.sh ./entrypoint.sh

RUN chmod +x entrypoint.sh

EXPOSE 3000

CMD ["./entrypoint.sh"]
