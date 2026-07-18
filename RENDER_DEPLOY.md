# 🚀 Deploy PLA to Render — Step-by-Step Guide

## Overview

Render is a cloud platform that makes deployment simple. With the `render.yaml` Blueprint file we created, you can deploy the **entire PLA stack** (backend API, frontend, PostgreSQL, Redis) with a few clicks.

**Cost:** Free tier available (spins down after 15 min of inactivity)  
**Paid tier:** ~$14/month for always-on services

---

## Prerequisites

1. A **GitHub account** with the PLA repository pushed
2. A **Render account** (free at [render.com](https://render.com))

---

## Step 1: Push Repository to GitHub

```bash
# If not already done:
cd PLA
git remote add origin https://github.com/YOUR_USERNAME/PLA.git
git push -u origin arena/019f4176-pla
```

---

## Step 2: Deploy via Render Blueprint

1. **Go to** [render.com/blueprints](https://render.com/blueprints)

2. **Click** "New Blueprint Instance"

3. **Connect** your GitHub account and select the `PLA` repository

4. **Select branch:** `arena/019f4176-pla` (or `main` after merging)

5. **Click** "Apply" — Render will read `render.yaml` and create:

   | Service | Type | Plan |
   |---------|------|------|
   | `pla-backend` | Web Service | Free |
   | `pla-web` | Static Site | Free |
   | `pla-postgres` | PostgreSQL 16 | Free |
   | `pla-redis` | Redis 7 | Free |

6. **Wait** 5-10 minutes for all services to build and deploy

---

## Step 3: Run Database Migration

After the PostgreSQL database is created, you need to seed it with the schema and demo data.

### Option A: Using Render Shell (Recommended)

1. Go to your `pla-backend` service in the Render dashboard
2. Click **"Shell"** tab
3. Run the migration:

```bash
# Install psql client first
apt-get update && apt-get install -y postgresql-client

# Run migration (uses the POSTGRES_* env vars already set)
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB < /opt/render/project/src/scripts/migrate-and-seed.sql
```

### Option B: Using a One-Off Job

1. Go to **Render Dashboard** → **New** → **Cron Job**
2. Set the command to:
   ```bash
   node scripts/migrate-and-seed.js
   ```
3. Set it to run **once**, then delete it

---

## Step 4: Verify Deployment

Once all services are green, check these URLs:

| Service | URL | Status |
|---------|-----|--------|
| **Frontend** | `https://pla-web.onrender.com` | Your main app URL |
| **Backend Health** | `https://pla-backend.onrender.com/health` | Should return `{"status":"ok"}` |
| **API Info** | `https://pla-backend.onrender.com/api` | Endpoint list |
| **Metrics** | `https://pla-backend.onrender.com/metrics` | Prometheus format |

---

## Step 5: Custom Domain (Optional)

### For the Frontend:
1. Go to `pla-web` → **Settings** → **Custom Domains**
2. Add your domain (e.g., `pla.yourdomain.com`)
3. Add the CNAME record to your DNS:
   ```
   pla.yourdomain.com → pla-web.onrender.com
   ```

### For the Backend:
1. Go to `pla-backend` → **Settings** → **Custom Domains**
2. Add `api.yourdomain.com`
3. Update the frontend's `CORS_ORIGIN` env var to include your custom domain

---

## Environment Variables Reference

All environment variables are auto-configured by `render.yaml`. Here's what they do:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Enables production optimizations |
| `PORT` | `5000` | Backend port (Render sets this automatically) |
| `JWT_SECRET` | Auto-generated | 64-char secure random string |
| `SESSION_SECRET` | Auto-generated | 64-char secure random string |
| `POSTGRES_*` | Auto-linked | Connected to `pla-postgres` database |
| `REDIS_*` | Auto-linked | Connected to `pla-redis` instance |
| `CORS_ORIGIN` | Auto-linked | Points to frontend URL |
| `TRUST_PROXY` | `true` | Required behind Render's load balancer |

---

## Troubleshooting

### Service won't start
- Check **Logs** tab in Render dashboard
- Common issue: PostgreSQL not ready yet → Render retries automatically

### "Cannot connect to database"
- Verify the database status is **Available** in Render dashboard
- Check that `POSTGRES_HOST` is set correctly in environment

### Frontend shows "Backend Offline"
- Backend free tier spins down after 15 min of inactivity
- First request takes ~30 seconds to wake up
- This is normal on the free tier

### Need to re-run migration
- Use Render Shell (see Step 3)

---

## Upgrading to Paid Tier

To eliminate cold starts and get more resources:

1. Go to each service → **Settings** → **Instance Type**
2. Upgrade to:
   - **Backend:** Starter ($7/month) — 512MB RAM, always on
   - **PostgreSQL:** Basic ($7/month) — 1GB storage, daily backups
   - **Redis:** Starter ($7/month) — 256MB, always on
   - **Frontend:** Free is fine for static sites

---

## Monitoring on Render

Render provides basic metrics out of the box:
- **CPU/Memory** graphs in the service dashboard
- **Request logs** in the Logs tab
- **Deploy history** with rollback capability

For advanced monitoring, the PLA backend exposes:
- `GET /metrics` — Prometheus-format metrics
- `GET /health` — Health check with uptime
- `GET /health/live` — Liveness probe
- `GET /health/ready` — Readiness probe

---

## Auto-Deploy

With `autoDeploy: true` in `render.yaml`, every push to your connected branch automatically triggers a new deployment. To disable:
1. Go to service → **Settings** → **Build & Deploy**
2. Toggle off "Auto Deploy"
