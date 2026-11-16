import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import cors from 'cors';
import {
  DEFAULT_STORE,
  createOrUpdateOrder,
  deleteOrder,
  getAllOrders,
  getFullSnapshot,
  getOrder,
  getStore,
  insertMessage,
  patchOrder,
  setStore,
} from './sqlite.js';

export { DEFAULT_STORE };

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, '..', 'dist');
const PORT = Number(process.env.PORT || 4000);

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });

// Broadcast latest SQLite state to all active client sockets
function push() {
  const state = getFullSnapshot();
  io.emit('state', state);
}

io.on('connection', (socket) => {
  socket.emit('state', getFullSnapshot());
  console.log(`[socket] ${socket.id} connected (${io.engine.clientsCount} live)`);
  socket.on('disconnect', () => console.log(`[socket] ${socket.id} left`));
});

// Health check with DB status
app.get('/api/health', (_req, res) => {
  const orders = getAllOrders();
  res.json({
    status: 'ok',
    database: 'sqlite (WAL mode)',
    ordersCount: orders.length,
    timestamp: new Date().toISOString(),
  });
});

// Full state snapshot
app.get('/api/state', (_req, res) => {
  res.json(getFullSnapshot());
});

// Create new order
app.post('/api/orders', (req, res) => {
  const order = req.body;
  if (!order?.id) return res.status(400).json({ error: 'order.id required' });
  const saved = createOrUpdateOrder(order);
  push();
  res.status(201).json(saved);
});

// Patch order (status update, live GPS, items check)
app.patch('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const existing = getOrder(id);
  if (!existing) return res.status(404).json({ error: 'Order not found' });
  const updated = patchOrder(id, req.body || {});
  push();
  res.json(updated);
});

// Post chat message
app.post('/api/orders/:id/messages', (req, res) => {
  const { id } = req.params;
  const existing = getOrder(id);
  if (!existing) return res.status(404).json({ error: 'Order not found' });
  const msg = req.body;
  if (!msg?.id || !msg?.from || !msg?.text) {
    return res.status(400).json({ error: 'id, from, text required' });
  }
  const saved = insertMessage(id, msg);
  push();
  res.status(201).json(saved);
});

// Delete order
app.delete('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const deleted = deleteOrder(id);
  if (!deleted) return res.status(404).json({ error: 'Order not found' });
  push();
  res.json({ ok: true, deleted: id });
});

// Update store settings (e.g. sync GPS location)
app.put('/api/settings', (req, res) => {
  const updated = setStore(req.body);
  push();
  res.json({ store: updated });
});

// Serve frontend SPA bundle when dist exists
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Kanifnath Production Server running on port ${PORT}`);
  console.log(`📦 Database: SQLite (better-sqlite3) with WAL journal mode`);
});
