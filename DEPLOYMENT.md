# 🚀 Kiranawala Live Deployment Guide

Your application is now **100% production-ready** with a high-performance **SQLite (WAL mode)** database and a Node.js + Socket.IO real-time backend.

---

## ⚡ Option 1: Deploy on Render.com (Recommended & Easiest)

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Production ready with SQLite"
   git push origin main
   ```

2. **Create Web Service on Render:**
   - Go to [render.com](https://render.com) and click **New +** → **Web Service**.
   - Connect your GitHub repository.
   - Choose:
     - **Environment:** `Node`
     - **Build Command:** `npm install && npm run build`
     - **Start Command:** `node server/index.js`
     - **Instance Type:** Free or Starter.

3. **Attach Persistent Disk (Important for SQLite):**
   - In Render dashboard, go to your service → **Disks** → **Add Disk**.
   - **Name:** `kirana-data`
   - **Mount Path:** `/app/server/data`
   - **Size:** `1 GB` (Stores 100,000+ orders).
   - *This ensures your SQLite database is never wiped when you redeploy or restart!*

4. **Your App is Live:**
   - Render gives you a secure live URL: `https://kanifnath-super-market.onrender.com`.

---

## ⚡ Option 2: Deploy on Railway.app (1-Click Cloud)

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select this repository.
4. Add a **Persistent Volume**:
   - Click your service → **Volumes** → **Add Volume**.
   - **Mount Path:** `/app/server/data`
5. Railway will automatically build Vite, run `node server/index.js`, and generate a live HTTPS domain (e.g. `https://kanifnath.up.railway.app`).

---

## ⚡ Option 3: Deploy on a VPS (DigitalOcean / Hetzner / AWS Lightsail)

If you have a Linux server (Ubuntu):

1. **Clone & Install:**
   ```bash
   git clone <your-repo-url> /var/www/kiranawala
   cd /var/www/kiranawala
   npm install
   npm run build
   ```

2. **Run with PM2 (Auto-restart on reboot):**
   ```bash
   npm install -g pm2
   pm2 start server/index.js --name "kiranawala"
   pm2 save
   pm2 startup
   ```

3. **Set up Nginx & Free SSL (Let's Encrypt):**
   ```nginx
   server {
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:4000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

---

## 🔒 Verification & Health Check

You can test your live backend at any time:
- **Health Check:** `GET /api/health`
  Returns:
  ```json
  {
    "status": "ok",
    "database": "sqlite (WAL mode)",
    "ordersCount": 4,
    "timestamp": "2026-11-16T05:32:00.000Z"
  }
  ```
- **State Check:** `GET /api/state`

