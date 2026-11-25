FROM node:24-alpine
ENV NODE_ENV=production PORT=8080 CONTENT_DIR=/app/content MANIFEST_PATH=/app/manifest.json
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node server.mjs home-ui.css theme.css theme-script.txt manifest.json ./
COPY --chown=node:node content ./content
COPY --chown=node:node assets ./assets
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
