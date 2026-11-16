import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MapView from '../components/MapView';
import { CATEGORIES } from '../lib/products';
import { STATUS_CUSTOMER_LABEL, STORE } from '../lib/config';
import { createOrder, distanceKm, getStore, setStore } from '../lib/db';
import { useGeo, useLive, timeAgo } from '../lib/hooks';

const POPULAR_SUGGESTIONS = [
  { name: 'Milk 1L', emoji: '🥛' },
  { name: 'Bread', emoji: '🍞' },
  { name: 'Eggs (6)', emoji: '🥚' },
  { name: 'Wheat Atta 5kg', emoji: '🌾' },
  { name: 'Sugar 1kg', emoji: '🧂' },
  { name: 'Cooking Oil 1L', emoji: '🛢️' },
  { name: 'Tea 250g', emoji: '☕' },
  { name: 'Maggi Noodles', emoji: '🍜' },
  { name: 'Rice 5kg', emoji: '🍚' },
  { name: 'Amul Butter', emoji: '🧈' },
  { name: 'MilkyMist Ice Cream', emoji: '🍦' },
  { name: 'Colgate 100g', emoji: '🪥' },
  { name: 'Soap', emoji: '🧼' },
  { name: 'Biscuits', emoji: '🍪' },
  { name: 'Potatoes 1kg', emoji: '🥔' },
  { name: 'Onions 1kg', emoji: '🧅' },
];

export default function CustomerHome() {
  const geo = useGeo({ watch: true });
  const { myOrders } = useLive();
  const nav = useNavigate();
  const store = getStore();

  const [buying, setBuying] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [name, setName] = useState(() => localStorage.getItem('kirana_cust_name') || '');
  const [phone, setPhone] = useState(() => localStorage.getItem('kirana_cust_phone') || '');
  const [picked, setPicked] = useState([]);
  const [customInput, setCustomInput] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [storeMsg, setStoreMsg] = useState('');

  const km = geo.pos ? distanceKm(geo.pos, store) : null;
  const activeOrders = useMemo(
    () => myOrders.filter((o) => o.status !== 'delivered'),
    [myOrders]
  );
  const latestActive = activeOrders[0] || null;

  function lockDeviceAsShop() {
    if (!geo.pos) {
      geo.retry();
      setStoreMsg('Please wait for device GPS detection, then tap again.');
      return;
    }
    const updated = {
      ...store,
      lat: geo.pos.lat,
      lng: geo.pos.lng,
      source: 'device_gps',
      updatedAt: Date.now(),
    };
    setStore(updated);
    setStoreMsg(`✅ Shop location locked to: ${geo.pos.lat.toFixed(6)}, ${geo.pos.lng.toFixed(6)}`);
    setTimeout(() => setStoreMsg(''), 8000);
  }

  const toggleItem = (item) => {
    setPicked((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
  };

  const removeItem = (item) => {
    setPicked((prev) => prev.filter((x) => x !== item));
  };

  const handleAddCustom = (e) => {
    if (e) e.preventDefault();
    const val = customInput.trim();
    if (!val) return;
    if (!picked.includes(val)) {
      setPicked((prev) => [...prev, val]);
    }
    setCustomInput('');
  };

  function submit(e) {
    e.preventDefault();
    // Also include whatever is typed in customInput if user forgot to click + Add
    let finalItems = [...picked];
    if (customInput.trim() && !finalItems.includes(customInput.trim())) {
      finalItems.push(customInput.trim());
    }

    if (!name.trim()) return setErr('Please enter your full name.');
    if (!/^[0-9]{10}$/.test(phone.replace(/\D/g, ''))) return setErr('Enter a valid 10-digit mobile number.');
    if (finalItems.length === 0) return setErr('Please select or add at least one kirana item.');
    if (!geo.pos) return setErr('Location permission is required for delivery destination.');
    setErr('');

    // Remember name and phone for next time
    localStorage.setItem('kirana_cust_name', name.trim());
    localStorage.setItem('kirana_cust_phone', phone.replace(/\D/g, ''));

    const order = createOrder({
      name: name.trim(),
      phone: phone.replace(/\D/g, ''),
      items: finalItems,
      note: note.trim(),
      location: geo.pos,
    });
    setBuying(false);
    setPicked([]);
    setCustomInput('');
    nav(`/order/${order.id}`);
  }

  return (
    <div className="compact-home-container">
      {/* 1. Ultra-Compact Top Bar: Store Name, Live Distance Badge, Refresh Button & Info Dropdown */}
      <div className="compact-top-card">
        <div className="compact-top-row">
          <div className="compact-store-meta">
            <h1 className="compact-store-title">
              <span className="store-emoji">🏪</span>
              <span className="store-title-text">{store.name}</span>
            </h1>

            {/* Small box distance badge */}
            <div className="compact-distance-box">
              {geo.loading ? (
                <span className="dist-chip loading">⏳ Finding GPS…</span>
              ) : geo.pos ? (
                <span className="dist-chip ready">
                  📍 {km != null ? (km < 0.03 ? 'At Shop (0 km)' : `${km.toFixed(2)} km away`) : '0.00 km'}
                </span>
              ) : (
                <span className="dist-chip warning" onClick={geo.retry}>
                  ⚠️ Allow GPS
                </span>
              )}
            </div>
          </div>

          <div className="compact-top-actions">
            {/* Small refresh button */}
            <button
              type="button"
              className="compact-refresh-btn"
              onClick={geo.retry}
              title="Refresh device GPS location"
              aria-label="Refresh location"
            >
              🔄
            </button>

            {/* Dropdown toggle for address & store info */}
            <button
              type="button"
              className={`compact-dropdown-btn ${showDetails ? 'open' : ''}`}
              onClick={() => setShowDetails((d) => !d)}
              title="Show store details & address"
            >
              <span>ℹ️ Details</span>
              <span className="dropdown-arrow">{showDetails ? '▲' : '▼'}</span>
            </button>
          </div>
        </div>

        {/* Expandable Dropdown: Store Address, Landmark, Coords & GPS Lock */}
        {showDetails && (
          <div className="compact-dropdown-content">
            <p className="dropdown-address">
              <strong>📍 Address:</strong> {store.address}
            </p>
            <p className="dropdown-landmark">
              <strong>🏷️ Landmark:</strong> {store.landmark || STORE.landmark}
            </p>
            <div className="dropdown-coords-row">
              <span className="dropdown-coords">
                📌 GPS: ({store.lat.toFixed(6)}, {store.lng.toFixed(6)})
              </span>
              {geo.pos && (
                <span className="dropdown-accuracy">
                  📱 Device GPS accuracy: ±{geo.pos.accuracy}m
                </span>
              )}
            </div>
            <div className="dropdown-actions">
              <button
                type="button"
                className="compact-lock-btn"
                onClick={lockDeviceAsShop}
                title="Lock current device GPS as shop location"
              >
                📍 Set My Current Location as Shop
              </button>
            </div>
            {storeMsg && <p className="success-msg">{storeMsg}</p>}
          </div>
        )}

        {/* Location needed alert (only when location not yet granted) */}
        {!geo.pos && !geo.loading && (
          <div className="compact-alert-row">
            <span>📍 Location needed so shopkeeper can deliver to you.</span>
            <button type="button" className="compact-allow-btn" onClick={geo.retry}>
              Allow / Retry
            </button>
          </div>
        )}
      </div>

      {/* 2. Active Order Notice Banner (if customer has pending orders) */}
      {latestActive && (
        <div
          className="compact-active-banner"
          onClick={() => nav(`/order/${latestActive.id}`)}
          title="Track active order"
        >
          <span className="active-pulse-dot"></span>
          <div className="active-banner-text">
            <strong>Active Request #{latestActive.id.slice(-4)}:</strong>{' '}
            <span>{STATUS_CUSTOMER_LABEL[latestActive.status] || latestActive.status}</span>
          </div>
          <span className="active-banner-arrow">Track & Chat →</span>
        </div>
      )}

      {/* 3. Map View: Fits on screen without scrolling */}
      <div className="compact-map-wrapper">
        <MapView
          height={210}
          connect
          showRouteInfo={true}
          showNavButton={false}
          points={[
            {
              id: 'store',
              lat: store.lat,
              lng: store.lng,
              kind: 'store',
              short: 'Shop',
              label: `${store.name} (Shop 1 · Near Saubhagya Jewellers)`,
            },
            ...(geo.pos
              ? [
                  {
                    id: 'me',
                    lat: geo.pos.lat,
                    lng: geo.pos.lng,
                    kind: 'me',
                    short: 'Your Device',
                    label: `Your Device Live Location (±${geo.pos.accuracy}m)`,
                  },
                ]
              : []),
          ]}
          showAccuracy={geo.pos ? [geo.pos] : []}
        />
      </div>

      {/* 4. Action Buttons Row: Fits cleanly right below the map without scrolling */}
      <div className="compact-action-row">
        <button
          type="button"
          className="action-btn-order"
          disabled={!geo.pos}
          onClick={() => setBuying(true)}
          title="Open Kirana Order Form"
        >
          <span className="btn-icon">🛒</span>
          <span className="btn-label">Shop Now</span>
        </button>

        <button
          type="button"
          className="action-btn-history"
          onClick={() => setShowHistory(true)}
          title="View previous orders placed from this device"
        >
          <span className="btn-icon">📜</span>
          <span className="btn-label">
            Orders {myOrders.length > 0 ? `(${myOrders.length})` : ''}
          </span>
        </button>

        <a className="action-btn-call" href={`tel:${store.phone || STORE.phone}`}>
          <span className="btn-icon">📞</span>
          <span className="btn-label">Call</span>
        </a>

        {geo.pos && (
          <a
            className="action-btn-nav"
            href={`https://www.google.com/maps/dir/?api=1&origin=${geo.pos.lat},${geo.pos.lng}&destination=${store.lat},${store.lng}`}
            target="_blank"
            rel="noreferrer"
            title="Open Google Maps Route Navigation"
          >
            <span className="btn-icon">🧭</span>
            <span className="btn-label">Nav</span>
          </a>
        )}
      </div>

      {/* 5. Order Request Bottom-Sheet / Modal (When tapping 'Shop Now') */}
      {buying && (
        <div className="mobile-modal-overlay" onClick={() => setBuying(false)}>
          <div className="mobile-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-sheet-header">
              <div className="modal-header-titles">
                <h2 className="modal-title">🛒 Shop Kirana Now</h2>
                <p className="modal-subtitle">Direct delivery from {store.name}</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setBuying(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form className="modal-form" onSubmit={submit}>
              {/* Customer Contact Details */}
              <div className="form-row-grid">
                <label className="field-label">
                  <span>👤 Your Name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Vishal Markad"
                    autoFocus
                  />
                </label>
                <label className="field-label">
                  <span>📱 Mobile Number</span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10 digit mobile"
                  />
                </label>
              </div>

              {/* Scrollable Popular Items Suggestions */}
              <div className="modal-section-block">
                <div className="section-head-title">
                  <span>⚡ Quick Item Suggestions (Tap to add)</span>
                </div>
                <div className="scrollable-suggestions-row">
                  {POPULAR_SUGGESTIONS.map((item) => {
                    const isPicked = picked.includes(item.name);
                    return (
                      <button
                        type="button"
                        key={item.name}
                        className={`suggestion-chip ${isPicked ? 'is-selected' : ''}`}
                        onClick={() => toggleItem(item.name)}
                      >
                        <span className="chip-emoji">{item.emoji}</span>
                        <span className="chip-text">{item.name}</span>
                        {isPicked && <span className="chip-check">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Item Input with + Add Button */}
              <div className="custom-item-bar">
                <input
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustom();
                    }
                  }}
                  placeholder="Type any other product (e.g. 2 Dairy Milk, Surf Excel)..."
                />
                <button
                  type="button"
                  className="add-item-btn"
                  onClick={handleAddCustom}
                  disabled={!customInput.trim()}
                >
                  + Add
                </button>
              </div>

              {/* Full Catalog Accordion */}
              <details className="cats modal-categories">
                <summary>📋 Full Kirana Catalog ({CATEGORIES.length} sections) ▾</summary>
                <div className="cat-scroll-area">
                  {CATEGORIES.map((c) => (
                    <div key={c.name} className="cat-block">
                      <h4>{c.name}</h4>
                      <div className="chips">
                        {c.items.map((it) => {
                          const isPicked = picked.includes(it);
                          return (
                            <button
                              type="button"
                              key={it}
                              className={`chip ${isPicked ? 'on' : ''}`}
                              onClick={() => toggleItem(it)}
                            >
                              {isPicked ? `✓ ${it}` : it}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </details>

              {/* Interactive Selected Basket Preview */}
              {picked.length > 0 && (
                <div className="interactive-basket-box">
                  <div className="basket-header">
                    <strong>🛒 Your Basket ({picked.length} item{picked.length > 1 ? 's' : ''}):</strong>
                  </div>
                  <div className="basket-pills-list">
                    {picked.map((it) => (
                      <span key={it} className="basket-removable-pill">
                        {it}
                        <button
                          type="button"
                          className="remove-pill-btn"
                          onClick={() => removeItem(it)}
                          title={`Remove ${it}`}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery Note */}
              <label className="field-label">
                <span>📝 Order Note / Landmark (Optional)</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Brand preference, building name, flat number..."
                />
              </label>

              {err && <p className="error" style={{ margin: '4px 0' }}>{err}</p>}

              <button type="submit" className="primary big submit-order-btn">
                🚀 Send Kirana Request ({picked.length + (customInput.trim() ? 1 : 0)} items) →
              </button>

              {geo.pos && (
                <p className="tiny modal-geo-note">
                  📍 Delivery destination locked to your device GPS: ({geo.pos.lat.toFixed(5)}, {geo.pos.lng.toFixed(5)})
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* 6. Previous Orders Drawer / Modal (When tapping 'Orders') */}
      {showHistory && (
        <div className="mobile-modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="mobile-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-sheet-header">
              <div className="modal-header-titles">
                <h2 className="modal-title">📜 Previous Orders ({myOrders.length})</h2>
                <p className="modal-subtitle">Orders placed from this device</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowHistory(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="history-list-container">
              {myOrders.length === 0 ? (
                <div className="empty-history-box">
                  <p className="muted">No orders placed yet from this device.</p>
                  <button
                    type="button"
                    className="primary small"
                    onClick={() => {
                      setShowHistory(false);
                      setBuying(true);
                    }}
                  >
                    Place First Order 🛒
                  </button>
                </div>
              ) : (
                <ul className="history-order-list">
                  {myOrders.map((o) => (
                    <li key={o.id} className="history-order-card" onClick={() => nav(`/order/${o.id}`)}>
                      <div className="history-card-header">
                        <div>
                          <strong className="history-order-id">#{o.id.slice(-4)}</strong>
                          <span className="history-time">{timeAgo(o.createdAt)}</span>
                        </div>
                        <span className={`tag ${o.status}`}>
                          {STATUS_CUSTOMER_LABEL[o.status] || o.status}
                        </span>
                      </div>
                      <div className="history-items">
                        {o.items.slice(0, 4).join(', ')}
                        {o.items.length > 4 ? ` +${o.items.length - 4} more` : ''}
                      </div>
                      <div className="history-card-footer">
                        <span className="history-phone">📞 {o.phone}</span>
                        <span className="history-open-link">
                          {o.salerOpenedAt ? '💬 Chat Open' : 'Track Order →'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
