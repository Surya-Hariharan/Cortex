FROM node:20-alpine AS deps
WORKDIR /app
COPY app/package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY app/src ./src
COPY supabase ./supabase
EXPOSE 8080
CMD ["node", "src/index.js"]
