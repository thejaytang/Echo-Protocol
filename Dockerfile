FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY server/package.json server/package-lock.json ./server/
WORKDIR /app/server
RUN npm ci --omit=dev --ignore-scripts

COPY server ./ 
RUN mkdir -p /data && chown -R node:node /app/server /data

EXPOSE 8787
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "const port = process.env.PORT || 8787; fetch('http://127.0.0.1:' + port + '/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"
CMD ["npm", "start"]
