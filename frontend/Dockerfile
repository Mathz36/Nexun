FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm install --workspace frontend
COPY shared shared
COPY frontend frontend
RUN npm run build --workspace frontend

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/frontend/dist ./dist
EXPOSE 4321
CMD ["serve", "-s", "dist", "-l", "4321"]
