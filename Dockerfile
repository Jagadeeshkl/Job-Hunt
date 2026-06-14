# Dockerfile for the Job Agent dashboard (Render / any container host).
# Installs a real Chromium so /api/approve can render the locked resume/cover
# templates to true vector PDFs (selectable text), which Vercel serverless can't.

FROM node:22-bookworm-slim

# Chromium + the fonts the resume template expects (Carlito ≈ Calibri).
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-crosextra-carlito \
      fonts-liberation \
      fonts-dejavu-core \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# puppeteer-core uses this system Chromium (don't download one).
ENV CHROME_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Install workspace deps (root lockfile governs the monorepo).
COPY package.json package-lock.json ./
COPY agents/package.json ./agents/package.json
COPY dashboard/package.json ./dashboard/package.json
RUN npm install

# Build the dashboard.
COPY . .
RUN cd dashboard && npx next build

ENV NODE_ENV=production
EXPOSE 10000
# Render provides $PORT; Next must bind to it.
CMD ["sh", "-c", "cd dashboard && npx next start -p ${PORT:-10000} -H 0.0.0.0"]
