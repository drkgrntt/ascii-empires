# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /src

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Pure static SPA - no backend calls yet (see CLAUDE.md), so no build-time
# API URL to bake in, unlike store/client's NEXT_PUBLIC_* args.
RUN npm run build

# ---- runtime stage ----
FROM nginx:1.27-alpine
COPY --from=build /src/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Port is baked in (nginx.conf), matching store/client's hardcoded
# `yarn start -p 3000` - nginx.conf can't read the host's .env, and
# network_mode: host means this has to be a fixed port anyway.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:6100/ || exit 1
