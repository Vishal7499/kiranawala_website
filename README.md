# 🏪 Kanifnath Super Market - Kirana Delivery Web App

A modern, mobile-first hyperlocal Kirana delivery application with real-time GPS tracking, 1-tap customer ordering, shopkeeper order management inbox, and in-app chat.

---

## ✨ Features

- **📱 Hyperlocal Real-Time GPS Tracking:** Uses device GPS to map distance and driving directions to the shop.
- **🛒 Instant Order Modal:** Quick-tap grocery chips, item suggestions, custom item search, and visual basket summary.
- **📜 Customer Order History:** Track previous orders and jump directly into live order tracking & chat.
- **🏪 Shopkeeper Inbox (WhatsApp style):** Compact mobile interface for managing 20+ incoming orders with 1-tap calling and chat.
- **✅ 4-Stage Delivery Timeline:** `Order Received` → `Packed` → `Out for Delivery` → `Delivery Done`.
- **🚚 Fixed Drop Location Navigation:** Fixed destination coordinates with 1-tap Google Maps road navigation.
- **⚡ Real-Time Live Sync:** Powered by WebSockets (`Socket.IO`) for instantaneous two-way updates.
- **🗄️ SQLite Database:** Backed by SQLite (`better-sqlite3`) in WAL journal mode for microsecond performance and ACID reliability.

---

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite, React-Leaflet, OpenStreetMap, OSRM Routing.
- **Backend:** Node.js, Express, Socket.IO.
- **Database:** SQLite 3 (`better-sqlite3` with WAL mode).

---

## 🚀 Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Build for production
```bash
npm run build
```

### 3. Start the server
```bash
npm start
```
Visit `http://localhost:4000` on your browser or phone on the same Wi-Fi network.

### 🔑 Saler Login Credentials
- **Username:** `saler`
- **Password:** `saler123`
- **URL:** `/saler`

---

## 🌐 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for full instructions on deploying to **Render**, **Railway**, or any **VPS**.

