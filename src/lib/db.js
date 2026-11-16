// Realtime data layer used by both customer and saler screens.
// Primary path: live server (Express + Socket.IO) so a phone and a laptop see the
// same requests instantly. If the server is unreachable we fall back to a local
// mirror (localStorage + BroadcastChannel) so a single browser still works.

import { io } from 'socket.io-client';
import { DEFAULT_STORE } from './config';

const MIRROR_KEY = 'ksm_state_mirror_v1';
const MY_KEY = 'ksm_my_orders_v1';
const SESSION_KEY = 'ksm_saler_session';
const CHANNEL = 'ksm-sync-v1';

let cache = { settings: { store: { ...DEFAULT_STORE, source: 'default', updatedAt: 0 } }, orders: [], messages: {} };
let online = false;

const listeners = new Set();

function emitAll() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* a bad listener must not block the others */
    }
  });
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function mirror() {
  writeLocal(MIRROR_KEY, JSON.stringify(cache));
}

function notify() {
  emitAll();
  if (channel) channel.postMessage({ at: Date.now() });
}

// ---- boot: restore last mirror so the UI has data before the socket answers ----
const saved = read(MIRROR_KEY, null);
if (saved?.orders) cache = saved;

let channel = null;
if (typeof BroadcastChannel !== 'undefined') {
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = () => {
    // Same browser, other tab: re-read the mirror.
    const other = read(MIRROR_KEY, null);
    if (!online && other?.orders) {
      cache = other;
      emitAll();
    }
  };
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === MIRROR_KEY && !online) {
      const other = read(MIRROR_KEY, null);
      if (other?.orders) {
        cache = other;
        emitAll();
      }
    }
  });
}

// ---- socket ----
const socket =
  typeof window === 'undefined'
    ? null
    : io({ autoConnect: true, reconnectionDelayMax: 4000, timeout: 2500 });

if (socket) {
  socket.on('connect', () => {
    online = true;
    emitAll();
  });
  socket.on('state', (next) => {
    online = true;
    if (next?.orders) {
      cache = next;
      mirror();
    }
    emitAll();
  });
  socket.on('disconnect', () => {
    online = false;
    emitAll();
  });
  socket.on('connect_error', () => {
    online = false;
    emitAll();
  });
}

function send(method, url, body) {
  if (!online) return;
  fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => {
    online = false;
    emitAll();
  });
}

export function isOnline() {
  return online;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOrders() {
  return cache.orders;
}

// Orders placed from this device, so the customer keeps a private history list.
export function getMyOrders() {
  const ids = read(MY_KEY, []);
  return cache.orders.filter((o) => ids.includes(o.id)).sort((a, b) => b.createdAt - a.createdAt);
}

export function getOrder(id) {
  return cache.orders.find((o) => o.id === id) || null;
}

export function getMessages(orderId) {
  return cache.messages[orderId] || [];
}

// ---- store location (shared, editable by the saler from their own GPS) ----
export function getStore() {
  return cache.settings?.store || { ...DEFAULT_STORE, source: 'default', updatedAt: 0 };
}

export function setStore(store) {
  cache = { ...cache, settings: { ...cache.settings, store } };
  mirror();
  notify();
  send('PUT', '/api/settings', { store });
  return store;
}

export function createOrder({ name, phone, items, note, location }) {
  const order = {
    id: uid(),
    name,
    phone,
    items,
    note: note || '',
    deliveryLocation: location, // Permanent drop destination where order was requested
    location, // Preserved as delivery location
    customerLivePos: location, // Live tracker that can update if customer moves
    status: 'new',
    createdAt: Date.now(),
    salerOpenedAt: null,
    unreadForSaler: 1,
  };
  cache = {
    ...cache,
    orders: [order, ...cache.orders],
    messages: { ...cache.messages, [order.id]: [] },
  };
  writeLocal(MY_KEY, [...read(MY_KEY, []), order.id]);
  mirror();
  notify();
  send('POST', '/api/orders', order);
  return order;
}

export function updateOrder(id, patch) {
  cache = { ...cache, orders: cache.orders.map((o) => (o.id === id ? { ...o, ...patch } : o)) };
  mirror();
  notify();
  send('PATCH', `/api/orders/${id}`, patch);
}

export function addMessage(orderId, from, text) {
  const msg = { id: uid(), from, text, at: Date.now() };
  cache = { ...cache, messages: { ...cache.messages, [orderId]: [...(cache.messages[orderId] || []), msg] } };
  cache = {
    ...cache,
    orders: cache.orders.map((o) => {
      if (o.id !== orderId) return o;
      // A saler reply also opens the chat, in case the inbox click flag was missed.
      const opened = from === 'saler' && !o.salerOpenedAt ? { salerOpenedAt: msg.at } : {};
      const unread = from === 'customer' ? { unreadForSaler: (o.unreadForSaler || 0) + 1 } : {};
      return { ...o, lastAt: msg.at, lastFrom: from, ...opened, ...unread };
    }),
  };
  mirror();
  notify();
  send('POST', `/api/orders/${orderId}/messages`, msg);
  return msg;
}

export function markSalerRead(orderId) {
  updateOrder(orderId, { unreadForSaler: 0 });
}

export function clearOrder(id) {
  cache = {
    ...cache,
    orders: cache.orders.filter((o) => o.id !== id),
    messages: { ...cache.messages, [id]: [] },
  };
  mirror();
  notify();
  send('DELETE', `/api/orders/${id}`);
}

export function getSalerSession() {
  return read(SESSION_KEY, null);
}

export function setSalerSession(session) {
  if (session) writeLocal(SESSION_KEY, session);
  else localStorage.removeItem(SESSION_KEY);
  notify();
}

// Haversine distance in km, used to show "store is X km from you".
export function distanceKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
