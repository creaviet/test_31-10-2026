# Verimi-Mock — leichter Node-Basis-Image, keine nativen Abhängigkeiten
FROM node:24-alpine
WORKDIR /app
COPY src ./src
# users.json wird als Read-Only-Volume aus shared/users.json eingehängt (siehe docker-compose.yml)
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/server.js"]