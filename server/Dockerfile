# ---- build stage ----
FROM golang:1.26-alpine AS build
WORKDIR /src

RUN apk add --no-cache git

# Cache module downloads separately from source changes
COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 go build -trimpath -o /out/app ./cmd/api
# Migrations (GORM AutoMigrate) are a separate one-off binary, run manually
# via `docker compose run --rm web ./migrate` - see DEPLOY.md - not on
# every boot of the main app.
RUN CGO_ENABLED=0 go build -trimpath -o /out/migrate ./cmd/migrate

# ---- runtime stage ----
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata \
    && adduser -D -H appuser
WORKDIR /app
COPY --from=build /out/app ./app
COPY --from=build /out/migrate ./migrate
USER appuser

# wget comes from busybox in the base image, so no extra package is needed.
# PORT always comes in via env_file in prod (see docker-compose.yml), so
# it's set by the time this runs.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:$PORT/api/health" || exit 1

ENTRYPOINT ["./app"]
