# 🧱 Base image.
FROM node:22-alpine AS base

# 🛠️ Build stage
FROM base AS build
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# 🚀 Production stage
FROM base AS production
WORKDIR /app

COPY --from=build /app ./

EXPOSE 3000
CMD ["npm", "start"]
