# ASCII Empires — multiplayer server

A Go/Fiber/Postgres backend for networked multiplayer, built as a separate
service from the `../client/` solo game (which needs no backend of its own).
Patterns here follow this codebase's other Go services (`mental-health-journal`,
`jellyfish/server`): `internal/{server,controllers,models,middleware,database,
utils,logger}`, a self-registering `Controller` interface, RS256-JWT-in-a-cookie
auth, and the same `Makefile`/`.air.toml` dev workflow.

## Status

- **Auth + lobby (done, tested end-to-end):** accounts, and game rooms — create a
  game, get a short room code, others join by code.
- **Rules engine (done, tested):** `internal/engine/` is a full 1:1 Go port of
  the client's `src/engine/` — same `GameState`, same `GameReducer`, verified
  behavioral parity (see `internal/engine/*_test.go`). JSON field names match
  the TS types exactly, so it's the wire format for free once sync exists.
  Still to do: `gofiber/contrib/websocket` (not a dependency yet), a per-game
  connection hub, seeding `GamePlayer.EmpireState` at game start, and the
  Reach/opponent-targeted-action rules that only make sense with real opponents.

## Running it

All commands below run from this directory (`server/`):

```bash
cp .env.example .env   # then fill in DB_* and a generated RSA keypair — see the file's comments
make docker-run        # local Postgres (or point DB_* at one you already have)
make migrate
make run                # or `make watch` for live reload via air
```

`make test` runs the engine's Go test suite.

## Deploy

`Dockerfile` + `docker-compose.yml` (prod, distinct from `docker-compose.dev.yml`'s
containerized Postgres) — see the repo root's `DEPLOY.md`.
