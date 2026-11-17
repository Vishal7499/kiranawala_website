import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'kirana.sqlite');
const LEGACY_JSON_FILE = path.join(DATA_DIR, 'db.json');

// Ensure directory exists
fs.mkdirSync(DATA_DIR, { recursive: true });

export const DEFAULT_STORE = {
  name: 'Kanifnath Super Market',
  tagline: 'MilkyMist Ice Cream · Kirana · Daily Essentials',
  address:
    'Shop 1, Vithal Rukhamani Mandir, Tower Line Rd, near Saubhagya Jewellers, Chikhali, Pune, Maharashtra 411062',
  landmark: 'Near Saubhagya Jewellers & Vitthal Rukmini Mandir (MilkyMist Ice Cream banner)',
  lat: 18.672498,
  lng: 73.791012,
  phone: '+919130295446',
  phoneDisplay: '+91 91302 95446',
  whatsapp: '+917499028909',
  whatsappDisplay: '+91 74990 28909',
  source: 'default',
  updatedAt: Date.now(),
};

// Initialize SQLite database with WAL mode for high concurrency
export const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS store_settings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tagline TEXT,
    address TEXT NOT NULL,
    landmark TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    phone TEXT,
    phone_display TEXT,
    source TEXT,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    items_json TEXT NOT NULL,
    note TEXT DEFAULT '',
    status TEXT DEFAULT 'received',
    delivery_lat REAL,
    delivery_lng REAL,
    delivery_accuracy REAL,
    delivery_at INTEGER,
    delivery_source TEXT,
    customer_live_lat REAL,
    customer_live_lng REAL,
    customer_live_accuracy REAL,
    customer_live_at INTEGER,
    customer_live_source TEXT,
    saler_opened_at INTEGER,
    unread_for_saler INTEGER DEFAULT 0,
    last_at INTEGER,
    last_from TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    from_role TEXT NOT NULL,
    text TEXT NOT NULL,
    at INTEGER NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_messages_order_at ON messages(order_id, at ASC);
`);

// Auto-migrate legacy db.json if table is empty
function autoMigrateLegacyJson() {
  const storeCount = db.prepare('SELECT COUNT(*) AS count FROM store_settings').get().count;
  if (storeCount === 0 && fs.existsSync(LEGACY_JSON_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(LEGACY_JSON_FILE, 'utf8'));
      console.log('📦 Migrating legacy db.json data into SQLite...');

      const initialStore = raw.settings?.store || DEFAULT_STORE;
      db.prepare(`
        INSERT OR REPLACE INTO store_settings 
        (id, name, tagline, address, landmark, lat, lng, phone, phone_display, source, updated_at)
        VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        initialStore.name,
        initialStore.tagline || '',
        initialStore.address,
        initialStore.landmark || '',
        initialStore.lat,
        initialStore.lng,
        initialStore.phone || '',
        initialStore.phoneDisplay || '',
        initialStore.source || 'default',
        initialStore.updatedAt || Date.now()
      );

      if (Array.isArray(raw.orders)) {
        const insertOrder = db.prepare(`
          INSERT OR REPLACE INTO orders (
            id, name, phone, items_json, note, status,
            delivery_lat, delivery_lng, delivery_accuracy, delivery_at, delivery_source,
            customer_live_lat, customer_live_lng, customer_live_accuracy, customer_live_at, customer_live_source,
            saler_opened_at, unread_for_saler, last_at, last_from, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const o of raw.orders) {
          const dLoc = o.deliveryLocation || o.location || {};
          const cLive = o.customerLivePos || {};
          insertOrder.run(
            o.id,
            o.name,
            o.phone,
            JSON.stringify(o.items || []),
            o.note || '',
            o.status || 'received',
            dLoc.lat || null,
            dLoc.lng || null,
            dLoc.accuracy || null,
            dLoc.at || null,
            dLoc.source || null,
            cLive.lat || null,
            cLive.lng || null,
            cLive.accuracy || null,
            cLive.at || null,
            cLive.source || null,
            o.salerOpenedAt || null,
            o.unreadForSaler || 0,
            o.lastAt || null,
            o.lastFrom || null,
            o.createdAt || Date.now(),
            o.updatedAt || Date.now()
          );
        }
      }

      if (raw.messages && typeof raw.messages === 'object') {
        const insertMsg = db.prepare(`
          INSERT OR IGNORE INTO messages (id, order_id, from_role, text, at)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const [orderId, msgList] of Object.entries(raw.messages)) {
          if (Array.isArray(msgList)) {
            for (const m of msgList) {
              insertMsg.run(m.id, orderId, m.from, m.text, m.at);
            }
          }
        }
      }
      console.log('✅ SQLite migration complete!');
    } catch (err) {
      console.error('Migration from db.json error:', err.message);
    }
  } else if (storeCount === 0) {
    // Seed default store
    db.prepare(`
      INSERT OR REPLACE INTO store_settings 
      (id, name, tagline, address, landmark, lat, lng, phone, phone_display, source, updated_at)
      VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      DEFAULT_STORE.name,
      DEFAULT_STORE.tagline,
      DEFAULT_STORE.address,
      DEFAULT_STORE.landmark,
      DEFAULT_STORE.lat,
      DEFAULT_STORE.lng,
      DEFAULT_STORE.phone,
      DEFAULT_STORE.phoneDisplay,
      DEFAULT_STORE.source,
      DEFAULT_STORE.updatedAt
    );
  }
}

autoMigrateLegacyJson();

// Convert a database row to standard frontend order format
function formatOrderRow(row) {
  if (!row) return null;
  let items = [];
  try {
    items = JSON.parse(row.items_json);
  } catch {
    items = [];
  }

  const dLoc = row.delivery_lat != null ? {
    lat: row.delivery_lat,
    lng: row.delivery_lng,
    accuracy: row.delivery_accuracy,
    at: row.delivery_at,
    source: row.delivery_source || 'device',
  } : null;

  const cLive = row.customer_live_lat != null ? {
    lat: row.customer_live_lat,
    lng: row.customer_live_lng,
    accuracy: row.customer_live_accuracy,
    at: row.customer_live_at,
    source: row.customer_live_source || 'device',
  } : null;

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    items,
    note: row.note || '',
    status: row.status,
    deliveryLocation: dLoc,
    location: dLoc,
    customerLivePos: cLive,
    salerOpenedAt: row.saler_opened_at,
    unreadForSaler: row.unread_for_saler || 0,
    lastAt: row.last_at,
    lastFrom: row.last_from,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getStore() {
  const row = db.prepare("SELECT * FROM store_settings WHERE id = 'default'").get();
  if (!row) return DEFAULT_STORE;
  return {
    name: row.name,
    tagline: row.tagline,
    address: row.address,
    landmark: row.landmark,
    lat: row.lat,
    lng: row.lng,
    phone: row.phone,
    phoneDisplay: row.phone_display,
    source: row.source,
    updatedAt: row.updated_at,
  };
}

export function setStore(patch) {
  const current = getStore();
  const next = { ...current, ...patch, updatedAt: Date.now() };
  db.prepare(`
    INSERT OR REPLACE INTO store_settings 
    (id, name, tagline, address, landmark, lat, lng, phone, phone_display, source, updated_at)
    VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    next.name,
    next.tagline || '',
    next.address,
    next.landmark || '',
    next.lat,
    next.lng,
    next.phone || '',
    next.phoneDisplay || '',
    next.source || 'saler_device',
    next.updatedAt
  );
  return next;
}

export function getAllOrders() {
  const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  return rows.map(formatOrderRow);
}

export function getOrder(id) {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  return formatOrderRow(row);
}

export function createOrUpdateOrder(o) {
  const now = Date.now();
  const existing = getOrder(o.id);
  const itemsJson = JSON.stringify(o.items || (existing ? existing.items : []));
  const dLoc = o.deliveryLocation || o.location || existing?.deliveryLocation || {};
  const cLive = o.customerLivePos || existing?.customerLivePos || {};

  const name = o.name ?? existing?.name ?? '';
  const phone = o.phone ?? existing?.phone ?? '';
  const note = o.note ?? existing?.note ?? '';
  const status = o.status ?? existing?.status ?? 'received';
  const salerOpenedAt = o.salerOpenedAt ?? existing?.salerOpenedAt ?? null;
  const unreadForSaler = o.unreadForSaler ?? existing?.unreadForSaler ?? 0;
  const lastAt = o.lastAt ?? existing?.lastAt ?? null;
  const lastFrom = o.lastFrom ?? existing?.lastFrom ?? null;
  const createdAt = o.createdAt ?? existing?.createdAt ?? now;

  db.prepare(`
    INSERT OR REPLACE INTO orders (
      id, name, phone, items_json, note, status,
      delivery_lat, delivery_lng, delivery_accuracy, delivery_at, delivery_source,
      customer_live_lat, customer_live_lng, customer_live_accuracy, customer_live_at, customer_live_source,
      saler_opened_at, unread_for_saler, last_at, last_from, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    o.id,
    name,
    phone,
    itemsJson,
    note,
    status,
    dLoc.lat || null,
    dLoc.lng || null,
    dLoc.accuracy || null,
    dLoc.at || null,
    dLoc.source || null,
    cLive.lat || null,
    cLive.lng || null,
    cLive.accuracy || null,
    cLive.at || null,
    cLive.source || null,
    salerOpenedAt,
    unreadForSaler,
    lastAt,
    lastFrom,
    createdAt,
    now
  );

  return getOrder(o.id);
}

export function patchOrder(id, patch) {
  const existing = getOrder(id);
  if (!existing) return null;
  const merged = { ...existing, ...patch, updatedAt: Date.now() };
  return createOrUpdateOrder(merged);
}

export function deleteOrder(id) {
  const info = db.prepare('DELETE FROM orders WHERE id = ?').run(id);
  return info.changes > 0;
}

export function getAllMessages() {
  const rows = db.prepare('SELECT * FROM messages ORDER BY at ASC').all();
  const map = {};
  for (const r of rows) {
    if (!map[r.order_id]) map[r.order_id] = [];
    map[r.order_id].push({
      id: r.id,
      from: r.from_role,
      text: r.text,
      at: r.at,
    });
  }
  return map;
}

export function getOrderMessages(orderId) {
  const rows = db.prepare('SELECT * FROM messages WHERE order_id = ? ORDER BY at ASC').all(orderId);
  return rows.map((r) => ({
    id: r.id,
    from: r.from_role,
    text: r.text,
    at: r.at,
  }));
}

export function insertMessage(orderId, msg) {
  db.prepare(`
    INSERT INTO messages (id, order_id, from_role, text, at)
    VALUES (?, ?, ?, ?, ?)
  `).run(msg.id, orderId, msg.from, msg.text, msg.at);

  // Update order last activity and unread count
  const updates = { lastAt: msg.at, lastFrom: msg.from };
  if (msg.from === 'customer') {
    const o = getOrder(orderId);
    updates.unreadForSaler = (o?.unreadForSaler || 0) + 1;
  }
  if (msg.from === 'saler') {
    const o = getOrder(orderId);
    if (!o?.salerOpenedAt) updates.salerOpenedAt = msg.at;
  }
  patchOrder(orderId, updates);

  return msg;
}

// Return snapshot of entire app state in the format the frontend expects
export function getFullSnapshot() {
  return {
    settings: { store: getStore() },
    orders: getAllOrders(),
    messages: getAllMessages(),
  };
}
