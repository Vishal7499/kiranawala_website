import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import MapView from '../components/MapView';
import { SALER_CREDS, STATUS_FLOW, STATUS_LABEL, STORE } from '../lib/config';
import {
  addMessage,
  clearOrder,
  distanceKm,
  getOrder,
  getSalerSession,
  getStore,
  markSalerRead,
  setSalerSession,
  setStore,
  updateOrder,
} from '../lib/db';
import { clockTime, timeAgo, useGeo, useLive, useMessages, useScrollToEnd } from '../lib/hooks';

function Login({ onLoginSuccess }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState('');
  return (
    <form
      className="card form narrow"
      onSubmit={(e) => {
        e.preventDefault();
        if (u.trim() === SALER_CREDS.username && p === SALER_CREDS.password) {
          const sess = { name: u.trim(), at: Date.now() };
          setSalerSession(sess);
          onLoginSuccess(sess);
        } else {
          setErr('Wrong user or password.');
        }
      }}
    >
      <h2>Saler login</h2>
      <p className="muted">Shop panel for {STORE.name}. Demo user: {SALER_CREDS.username} / {SALER_CREDS.password}</p>
      <label>
        User name
        <input value={u} onChange={(e) => setU(e.target.value)} placeholder="saler" autoFocus />
      </label>
      <label>
        Password
        <div className="password-input-wrap">
          <input
            type={showPass ? 'text' : 'password'}
            value={p}
            onChange={(e) => setP(e.target.value)}
            placeholder="••••••"
          />
          <button
            type="button"
            className="toggle-password-btn"
            onClick={() => setShowPass((s) => !s)}
            title={showPass ? 'Hide password' : 'Show password'}
          >
            {showPass ? '🙈 Hide' : '👁️ Show'}
          </button>
        </div>
      </label>
      {err && <p className="error">{err}</p>}
      <button type="submit" className="primary big">Open shop panel</button>
      <Link to="/" className="ghost small" style={{ marginTop: '8px', textAlign: 'center' }}>
        ← Back to Customer Home
      </Link>
    </form>
  );
}

export default function SalerArea() {
  const [session, setSession] = useState(() => getSalerSession());
  const { orders } = useLive();
  const { id } = useParams();
  const nav = useNavigate();
  const store = getStore();
  // Call all hooks unconditionally at top level
  const salerGeo = useGeo({ watch: true });

  const [tab, setTab] = useState('pending'); // 'pending' or 'done'
  const [salerView, setSalerView] = useState('inbox'); // 'inbox' or 'map'
  const [text, setText] = useState('');
  const [packedItems, setPackedItems] = useState({});
  const [showChatModal, setShowChatModal] = useState(false);
  const [storeMsg, setStoreMsg] = useState('');

  const msgs = useMessages(id);
  const boxRef = useScrollToEnd(msgs.length + (id || ''));

  const pending = useMemo(() => orders.filter((o) => o.status !== 'delivered'), [orders]);
  const done = useMemo(() => orders.filter((o) => o.status === 'delivered'), [orders]);
  const current = id ? getOrder(id) : null;
  const threadPreview = msgs.length ? msgs[msgs.length - 1] : null;

  function handleLogout() {
    setSalerSession(null);
    setSession(null);
    nav('/', { replace: true });
  }

  if (!session) {
    return <Login onLoginSuccess={(sess) => setSession(sess)} />;
  }

  const deliveryLoc = current ? (current.deliveryLocation || current.location) : null;

  // Real-time map points when viewing an order
  const orderMapPoints = current
    ? [
        {
          id: 'store',
          lat: store.lat,
          lng: store.lng,
          kind: 'store',
          short: 'Shop',
          label: `${store.name} (Shop)`,
        },
        ...(deliveryLoc
          ? [
              {
                id: 'delivery',
                lat: deliveryLoc.lat,
                lng: deliveryLoc.lng,
                kind: 'delivery',
                short: 'Drop Spot',
                label: `📦 Deliver Here: ${current.name} · 📞 ${current.phone}`,
              },
            ]
          : []),
        ...(salerGeo.pos && Math.hypot(salerGeo.pos.lat - store.lat, salerGeo.pos.lng - store.lng) > 0.0004
          ? [
              {
                id: 'salerLive',
                lat: salerGeo.pos.lat,
                lng: salerGeo.pos.lng,
                kind: 'me',
                short: 'You (Saler)',
                label: '🚴 Your Live GPS Location (Delivering)',
              },
            ]
          : []),
      ]
    : [];

  const allPendingMapPoints = [
    { id: 'store', lat: store.lat, lng: store.lng, kind: 'store', short: 'Shop', label: store.name },
    ...pending
      .filter((o) => o.deliveryLocation || o.location)
      .map((o) => {
        const loc = o.deliveryLocation || o.location;
        return {
          id: o.id,
          lat: loc.lat,
          lng: loc.lng,
          kind: 'cust',
          short: o.name.split(' ')[0],
          label: `${o.name} · ${o.phone} · ${o.items.slice(0, 2).join(', ')}`,
        };
      }),
  ];

  function updateShopLocation() {
    if (!salerGeo.pos) {
      salerGeo.retry();
      setStoreMsg('Detecting device location... please tap again in a moment.');
      return;
    }
    setStore({
      ...store,
      lat: salerGeo.pos.lat,
      lng: salerGeo.pos.lng,
      source: 'saler_device',
      updatedAt: Date.now(),
    });
    setStoreMsg(`✅ Shop location updated to: ${salerGeo.pos.lat.toFixed(6)}, ${salerGeo.pos.lng.toFixed(6)}`);
    setTimeout(() => setStoreMsg(''), 6000);
  }

  function openOrder(orderId) {
    const o = getOrder(orderId);
    if (o && !o.salerOpenedAt) updateOrder(orderId, { salerOpenedAt: Date.now() });
    markSalerRead(orderId);
    nav(`/saler/order/${orderId}`);
  }

  function markDelivered(orderId) {
    updateOrder(orderId, { status: 'delivered' });
    setTab('done');
  }

  function setOrderStatus(newStatus) {
    if (!id || !current) return;
    updateOrder(id, { status: newStatus });
    if (newStatus === 'delivered') {
      setTab('done');
    }
  }

  function send(e) {
    if (e) e.preventDefault();
    const body = text.trim();
    if (!body || !id) return;
    if (!current?.salerOpenedAt) updateOrder(id, { salerOpenedAt: Date.now() });
    addMessage(id, 'saler', body);
    setText('');
    markSalerRead(id);
  }

  const quickReplies = [
    '📦 Your kirana order is being packed now!',
    '🚴 Out for delivery! Reaching you shortly.',
    '📍 Reached at your delivery location.',
    '✅ Order delivered! Thank you for choosing Kanifnath Super Market.',
  ];

  function sendQuickReply(msgText) {
    if (!id || !current) return;
    if (!current.salerOpenedAt) updateOrder(id, { salerOpenedAt: Date.now() });
    addMessage(id, 'saler', msgText);
    markSalerRead(id);
  }

  function togglePacked(index) {
    setPackedItems((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  const currentDisplayList = tab === 'pending' ? pending : done;

  return (
    <div className="stack saler">
      {!id && (
        <>
          {/* Top Shop Control Bar */}
          <section className="card saler-header-card">
            <div className="card-head">
              <div>
                <h2 style={{ margin: 0, fontSize: '16px' }}>Shop Panel</h2>
                <p className="tiny" style={{ margin: '2px 0 0', color: 'var(--green-d)' }}>
                  🏪 Kanifnath · ({store.lat.toFixed(4)}, {store.lng.toFixed(4)})
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="ghost small"
                  onClick={updateShopLocation}
                  title="Lock store location to current device GPS"
                >
                  📍 Sync GPS
                </button>
                <button
                  type="button"
                  className="ghost small"
                  onClick={handleLogout}
                  title="Logout from Saler and return to customer view"
                >
                  Logout 🚪
                </button>
              </div>
            </div>
            {storeMsg && <p className="success" style={{ margin: '8px 0', fontWeight: 'bold' }}>{storeMsg}</p>}

            {/* View Mode Switcher: Inbox vs Map */}
            <div className="saler-view-toggle">
              <button
                type="button"
                className={`saler-toggle-btn ${salerView === 'inbox' ? 'active' : ''}`}
                onClick={() => setSalerView('inbox')}
              >
                📋 Orders Inbox ({pending.length})
              </button>
              <button
                type="button"
                className={`saler-toggle-btn ${salerView === 'map' ? 'active' : ''}`}
                onClick={() => setSalerView('map')}
              >
                🗺️ Area Map ({allPendingMapPoints.length - 1})
              </button>
            </div>

            {salerView === 'map' && (
              <div style={{ marginTop: '10px' }}>
                <MapView height={240} points={allPendingMapPoints} zoom={pending.length ? undefined : 16} />
              </div>
            )}
          </section>

          {/* Requests Inbox (WhatsApp-style Chat List for 20+ requests) */}
          <section className="card">
            <div className="tabs-header">
              <button
                type="button"
                className={`tab-btn ${tab === 'pending' ? 'active' : ''}`}
                onClick={() => setTab('pending')}
              >
                <span>⏳ Pending Requests</span>
                <span className="tab-count">{pending.length}</span>
              </button>
              <button
                type="button"
                className={`tab-btn ${tab === 'done' ? 'active' : ''}`}
                onClick={() => setTab('done')}
              >
                <span>✅ Done / Delivered</span>
                <span className="tab-count">{done.length}</span>
              </button>
            </div>

            {currentDisplayList.length === 0 && (
              <p className="muted" style={{ textAlign: 'center', padding: '24px 12px' }}>
                {tab === 'pending'
                  ? 'No pending requests right now. New customer orders will show up here instantly.'
                  : 'No delivered orders in history yet.'}
              </p>
            )}

            <div className="inbox-card-list">
              {currentDisplayList.map((o) => {
                const oLoc = o.deliveryLocation || o.location;
                const dist = oLoc ? distanceKm(store, oLoc) : null;
                const cleanPhone = (o.phone || '').replace(/\D/g, '');
                const isDelivered = o.status === 'delivered';
                return (
                  <div key={o.id} className={`inbox-order-card ${isDelivered ? 'is-done' : ''}`}>
                    {/* Header: Avatar, Customer Name, Phone, and Time */}
                    <div className="order-card-head" onClick={() => openOrder(o.id)}>
                      <div className="order-avatar">
                        <span>{o.name ? o.name.charAt(0).toUpperCase() : '👤'}</span>
                        {o.unreadForSaler > 0 && <span className="avatar-unread-dot" title="New customer message"></span>}
                      </div>

                      <div className="order-header-info">
                        <div className="order-title-row">
                          <strong className="order-customer-name">{o.name}</strong>
                          <span className="order-time-chip">{timeAgo(o.createdAt)}</span>
                        </div>
                        <div className="order-sub-row">
                          <span className="order-phone-link">📞 {o.phone}</span>
                          {dist != null && (
                            <span className="order-dist-badge">📍 {dist.toFixed(1)} km away</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Items List: Clean & Easy to Read on Mobile */}
                    <div className="order-items-preview-box" onClick={() => openOrder(o.id)}>
                      <div className="order-items-headline">
                        <span className="items-icon">🛒</span>
                        <span className="items-summary">
                          <strong>{o.items.length} item{o.items.length > 1 ? 's' : ''}:</strong>{' '}
                          {o.items.join(', ')}
                        </span>
                      </div>
                      {o.note && <p className="order-note-text">📝 Note: “{o.note}”</p>}
                    </div>

                    {/* Actions & Delivery Done Button */}
                    <div className="order-card-bottom">
                      <span className={`tag ${o.status}`} onClick={() => openOrder(o.id)}>
                        {STATUS_LABEL[o.status] || o.status}
                      </span>

                      <div className="order-btn-actions">
                        <a
                          className="card-action-btn btn-call-sm"
                          href={`tel:${cleanPhone}`}
                          onClick={(e) => e.stopPropagation()}
                          title={`Call ${o.name} (${o.phone})`}
                        >
                          📞 Call
                        </a>
                        <button
                          type="button"
                          className="card-action-btn btn-chat-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openOrder(o.id);
                            setShowChatModal(true);
                          }}
                          title="Chat with customer"
                        >
                          💬 Chat
                        </button>
                        {!isDelivered ? (
                          <button
                            type="button"
                            className="card-action-btn btn-done-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              markDelivered(o.id);
                            }}
                            title="Mark delivery done and move to Done"
                          >
                            ✅ Delivery Done
                          </button>
                        ) : (
                          <span className="done-check-label">✓ Done</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {id && current && (
        <>
          {/* Order Detail Header */}
          <section className="card">
            <div className="card-head">
              <div>
                <button
                  type="button"
                  className="ghost small"
                  style={{ marginBottom: '8px', padding: '6px 12px' }}
                  onClick={() => nav('/saler')}
                >
                  ← Back to Inbox
                </button>
                <h2 style={{ margin: '0' }}>{current.name}</h2>
                <p className="muted" style={{ margin: '2px 0 0', fontSize: '14px' }}>
                  <strong>📞 {current.phone}</strong> · Order #{current.id.slice(-4)}
                </p>
              </div>
              <span className={`tag ${current.status}`} style={{ fontSize: '13px', padding: '5px 12px' }}>
                {STATUS_LABEL[current.status] || current.status}
              </span>
            </div>

            {/* Quick 1-tap mobile action grid */}
            <div className="mobile-action-grid">
              <a className="mobile-action-btn btn-call" href={`tel:${current.phone}`}>
                <span className="btn-icon">📞</span>
                <span>Call ({current.phone})</span>
              </a>
              <button
                type="button"
                className="mobile-action-btn btn-nav-blue"
                onClick={() => setShowChatModal(true)}
              >
                <span className="btn-icon">💬</span>
                <span>Chat with Customer</span>
              </button>
              <a
                className="mobile-action-btn btn-whatsapp"
                href={`https://wa.me/91${current.phone.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(current.name)},%20Kanifnath%20Super%20Market%20received%20your%20kirana%20order!`}
                target="_blank"
                rel="noreferrer"
              >
                <span className="btn-icon">🟢</span>
                <span>WhatsApp</span>
              </a>
            </div>
          </section>

          {/* Timeline Status Flow Bar */}
          <section className="card">
            <h3 style={{ margin: '0 0 6px', fontSize: '14px' }}>Order Delivery Timeline:</h3>
            <div className="timeline-bar">
              {STATUS_FLOW.map((s) => {
                const isActive = current.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    className={`timeline-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setOrderStatus(s)}
                  >
                    <span>{STATUS_LABEL[s]}</span>
                    {isActive && <small style={{ color: 'var(--green-d)' }}>✓ Active</small>}
                  </button>
                );
              })}
            </div>

            {current.status !== 'delivered' && (
              <button
                type="button"
                className="primary big mark-done-btn"
                style={{ marginTop: '12px', background: '#16a34a', borderColor: '#16a34a', fontSize: '15px' }}
                onClick={() => {
                  setOrderStatus('delivered');
                  nav('/saler');
                }}
              >
                ✅ Mark Delivery Done (Move to Done)
              </button>
            )}
          </section>

          {/* Fixed Customer Delivery Location & Route Map */}
          <section className="card">
            <div className="card-head">
              <div>
                <h3 style={{ margin: '0' }}>📦 Fixed Customer Delivery Location</h3>
                <p className="tiny" style={{ margin: '2px 0 0', color: 'var(--green-d)' }}>
                  Customer ordered to this fixed spot.
                  {deliveryLoc && ` (~${distanceKm(salerGeo.pos || store, deliveryLoc)?.toFixed(2)} km from your current location)`}
                </p>
              </div>
            </div>

            {deliveryLoc ? (
              <>
                <MapView height={280} connect points={orderMapPoints} />
                <div style={{ marginTop: '10px' }}>
                  <a
                    className="btn-directions"
                    style={{ width: '100%', justifyContent: 'center', boxSizing: 'border-box' }}
                    href={`https://www.google.com/maps/dir/?api=1&origin=${salerGeo.pos?.lat || store.lat},${salerGeo.pos?.lng || store.lng}&destination=${deliveryLoc.lat},${deliveryLoc.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    🚚 Start GPS Navigation to Customer Delivery Destination
                  </a>
                </div>
              </>
            ) : (
              <p className="tiny muted">No GPS location attached to this request.</p>
            )}
          </section>

          {/* Items Checklist for Packing */}
          <section className="card">
            <div className="card-head">
              <h3>🛒 Items to Pack ({current.items.length})</h3>
              <span className="tiny muted">Tap to check off</span>
            </div>
            {current.note && (
              <p className="muted" style={{ margin: '4px 0 8px', fontStyle: 'italic', fontSize: '13px' }}>
                Note: “{current.note}”
              </p>
            )}
            <div className="pack-items-list">
              {current.items.map((it, idx) => {
                const isPacked = packedItems[idx];
                return (
                  <div
                    key={idx}
                    className={`pack-item-row ${isPacked ? 'done' : ''}`}
                    onClick={() => togglePacked(idx)}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(isPacked)}
                      onChange={() => togglePacked(idx)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span>{it}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="ghost small danger"
                onClick={() => {
                  if (window.confirm('Delete this request?')) {
                    clearOrder(current.id);
                    nav('/saler');
                  }
                }}
              >
                Remove Request
              </button>
            </div>
          </section>

          {/* Small Popup Modal Chat Box */}
          {showChatModal && (
            <div className="chat-modal-overlay" onClick={() => setShowChatModal(false)}>
              <div className="chat-modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="chat-modal-header">
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>💬 Chat: {current.name}</h3>
                    <small className="muted">📞 {current.phone}</small>
                  </div>
                  <button
                    type="button"
                    className="chat-modal-close"
                    onClick={() => setShowChatModal(false)}
                  >
                    ✕
                  </button>
                </div>

                <div className="quick-replies">
                  {quickReplies.map((qr, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="quick-chip"
                      onClick={() => sendQuickReply(qr)}
                    >
                      {qr}
                    </button>
                  ))}
                </div>

                <div className="thread" ref={boxRef} style={{ maxHeight: '280px', minHeight: '140px', overflowY: 'auto' }}>
                  {msgs.length === 0 && (
                    <p className="sys">No messages yet. Send a message or tap a quick reply above.</p>
                  )}
                  {msgs.map((m) => (
                    <div key={m.id} className={`msg ${m.from}`}>
                      <span className="who">{m.from === 'saler' ? 'You' : current.name}</span>
                      <p>{m.text}</p>
                      <time>{clockTime(m.at)}</time>
                    </div>
                  ))}
                </div>

                <form className="composer" onSubmit={send}>
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type reply to customer…"
                    autoFocus
                  />
                  <button type="submit" className="primary" disabled={!text.trim()}>
                    Send
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {id && !current && (
        <section className="card">
          <h2>Request missing or delivered</h2>
          <button type="button" className="primary link" onClick={() => nav('/saler')}>
            ← Back to Requests Inbox
          </button>
        </section>
      )}
    </div>
  );
}
