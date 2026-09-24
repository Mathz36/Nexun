FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm install
COPY shared shared
COPY backend backend
COPY frontend frontend
RUN npm run build --workspace backend

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend ./backend
COPY --from=build /app/frontend ./frontend
COPY --from=build /app/shared ./shared
WORKDIR /app/backend
EXPOSE 3026
CMD ["node", "dist/backend/src/server.js"]
