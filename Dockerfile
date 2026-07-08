# Dockerfile for the Job Agent dashboard (Render / any container host).
# Installs a real Chromium so /api/approve can render the locked resume/cover
# templates to true vector PDFs (selectable text), which Vercel serverless can't.

FROM node:22-bookworm-slim

# We drive puppeteer's OWN bundled Chromium (downloaded during npm install), so
# we don't install Chromium from apt (Debian floats it to bleeding-edge builds
# puppeteer can't launch). We DO install Chromium's shared-library dependencies
# and the fonts the resume template expects (Carlito ≈ Calibri).
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      fonts-crosextra-carlito fonts-liberation fonts-dejavu-core \
      libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
      libdrm2 libxcb1 libxkbcommon0 libatspi2.0-0 libx11-6 libxcomposite1 \
      libxdamage1 libxext6 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
      libcairo2 libasound2 libxshmfence1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Let puppeteer download + cache its version-matched Chromium at npm install.
ENV PUPPETEER_CACHE_DIR=/root/.cache/puppeteer
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
