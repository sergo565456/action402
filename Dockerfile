FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4021

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 4021

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node scripts/healthcheck.js

CMD ["npm", "start"]
