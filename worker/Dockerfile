FROM mcr.microsoft.com/playwright:v1.62.1-noble
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
CMD ["npm", "start"]
