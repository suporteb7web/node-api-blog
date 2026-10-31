FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
# package-lock.json foi gerado com npm 11. A imagem Node 22 traz npm 10, que recusa esse lockfile.
RUN npm install -g npm@11.11.0 && npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build \
  && npm prune --omit=dev \
  && npm cache clean --force

FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN mkdir -p uploads && chown node:node uploads

USER node

EXPOSE 3000

CMD ["node", "dist/server.js"]
