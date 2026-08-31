# Deploy

Same pattern as this codebase author's other single-host deploys (`store`,
`mental-health-journal`, `derekgarnett.com`): each app is its own Docker
image, run with `network_mode: host` so it can reach the box's native
Postgres and coexist with everything else behind one shared nginx, which
terminates TLS via Let's Encrypt/Certbot. `client/` and `server/` here are
deployed independently but share one domain, split by path:

| App        | Container               | Host port | nginx route                          |
|------------|--------------------------|-----------|---------------------------------------|
| `client/`  | `ascii-empires-client`  | 6100      | `ascii-empires.derekgarnett.com/`     |
| `server/`  | `ascii-empires-server`  | 6101      | `ascii-empires.derekgarnett.com/api/` |

(Ports chosen to avoid every port already in use on the host — check
`grep -rhoE 'proxy_pass http://[^;]+;' /etc/nginx/sites-enabled/` before
reusing this pattern elsewhere.)

The client is a fully static SPA and doesn't call the server yet (see root
`CLAUDE.md`), so the `/api/` route is prepared but not required for the game
to work today.

## One-time host setup

Run these once, on the host, before the first deploy.

### 1. Postgres

The server's `.env` (`DB_HOST=localhost`, `DB_PORT=5432`) expects a native
Postgres role + database, matching every other app on this box:

```bash
sudo -u postgres psql -c "CREATE ROLE ascii_empires WITH LOGIN PASSWORD '<generate one>';"
sudo -u postgres psql -c "CREATE DATABASE ascii_empires OWNER ascii_empires;"
```

### 2. nginx

Create `/etc/nginx/sites-enabled/ascii-empires` (own file, like `crm`/
`midwestdaisy`, rather than appending to the shared `default`):

```nginx
server {
    server_name ascii-empires.derekgarnett.com;

    location /api/ {
        proxy_pass http://127.0.0.1:6101;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        proxy_pass http://127.0.0.1:6100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 3. TLS (after the app is actually up and serving on port 80 — see below)

```bash
sudo certbot --nginx -d ascii-empires.derekgarnett.com
```

Certbot rewrites the file above in place (adds the `listen 443 ssl` lines
and an HTTP→HTTPS redirect block), same as every other Certbot-managed site
on this host.

## Every deploy

```bash
# on the host
mkdir -p ~/sites/ascii-empires && cd ~/sites/ascii-empires
git clone git@github.com:drkgrntt/ascii-empires.git .   # first time only; `git pull` after

cd server
cp .env.example .env   # first time only — fill in DB_* (from step 1 above) and an RSA keypair, see the file's comments
docker compose up -d --build
docker compose run --rm web ./migrate   # first deploy, and again after any schema change

cd ../client
docker compose up -d --build
```

Then, first time only, do step 3 (Certbot) above.

## Redeploying after a change

```bash
cd ~/sites/ascii-empires && git pull
cd server && docker compose up -d --build
cd ../client && docker compose up -d --build
```
