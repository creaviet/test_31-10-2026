# Portal-Mock — Node 24 (node:sqlite eingebaut, keine nativen Abhängigkeiten)
FROM node:24-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY src ./src
COPY public ./public
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/server.js"]