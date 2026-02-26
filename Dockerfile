# -------- BUILD STAGE --------
FROM node:20-slim AS builder

WORKDIR /app

# 1️⃣ Copy package files first (better caching)
COPY package*.json ./

RUN npm ci

# 2️⃣ Copy source code
COPY . .

# 3️⃣ Generate Prisma client
RUN npx prisma generate

# 4️⃣ Build NestJS app
RUN npm run build


# -------- PRODUCTION STAGE --------
FROM node:20-slim AS runner

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

# 5️⃣ Copy only necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Copy entrypoint
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

ENV NODE_ENV=production

EXPOSE 3000

CMD ["./entrypoint.sh"]