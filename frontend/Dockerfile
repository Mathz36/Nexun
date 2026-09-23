FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm install
COPY shared shared
COPY frontend frontend
WORKDIR /app/frontend
EXPOSE 3027
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3027"]
