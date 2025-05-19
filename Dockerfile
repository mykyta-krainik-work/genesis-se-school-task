FROM node:22-alpine AS base

FROM base AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /usr/src/app

COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# -------------------------------
FROM base AS builder

WORKDIR /usr/src/app

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .

RUN npm run build

RUN echo "--- [BUILDER STAGE] Listing /usr/src/app/dist after build ---" && \
    (if [ -d /usr/src/app/dist ]; then ls -AlR /usr/src/app/dist; else echo "/usr/src/app/dist does not exist or is not a directory in builder."; fi)

# -------------------------------
FROM base AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY --from=builder /usr/src/app/public ./public

COPY --from=builder /usr/src/app/dist ./dist

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./package.json

RUN echo "--- [RUNNER STAGE] Listing /usr/src/app/dist before CMD ---" && \
    (if [ -d /usr/src/app/dist ]; then ls -AlR /usr/src/app/dist; else echo "/usr/src/app/dist does not exist or is not a directory in runner."; fi)
EXPOSE 3000

CMD ["npm", "start"] 