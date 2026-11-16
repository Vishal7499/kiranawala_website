import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import MapView from '../components/MapView';
import { STATUS_CUSTOMER_LABEL, STORE } from '../lib/config';
import { addMessage, distanceKm, getStore, updateOrder } from '../lib/db';
import { clockTime, useGeo, useLive, useMessages, useScrollToEnd } from '../lib/hooks';

export default function CustomerChat() {
  const { id } = useParams();
  const nav = useNavigate();
  const geo = useGeo({ watch: true });
  const msgs = useMessages(id);
  const store = getStore();
  // Subscribe to every write so saler status/replies appear without a refresh.
  const { orders } = useLive();
  const order = orders.find((o) => o.id === id) || null;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const boxRef = useScrollToEnd(msgs.length + (order?.status || ''));
  const lastPushed = useRef(null);

  // Update customer live position for real-time tracking,
  // but keep order.deliveryLocation FIXED as the destination where order was requested.
  useEffect(() => {
    if (!geo.pos || !order) return;
    const old = order.customerLivePos;
    if (!old || distanceKm(old, geo.pos) * 1000 > 40) {
      if (lastPushed.current !== geo.pos.at) {
        lastPushed.current = geo.pos.at;
        updateOrder(id, { customerLivePos: geo.pos });
      }
    }
  }, [geo.pos, id, order]);

  if (!order) {
    return (
      <div className="card">
        <h2>Order not found</h2>
        <p className="muted">This request was removed from this device.</p>
        <Link className="primary link" to="/">Back to store</Link>
      </div>
    );
  }

  const open = Boolean(order.salerOpenedAt);

  function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    addMessage(id, 'customer', body);
    setText('');
    setSending(false);
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <h2>Request #{id.slice(-4)}</h2>
          <span className={`badge ${open ? 'live' : 'wait'}`}>
            {open ? 'Chat open · saler connected' : 'Waiting for saler…'}
          </span>
        </div>
        <p className="status-line">{STATUS_CUSTOMER_LABEL[order.status] || order.status}</p>

        <div className="kv">
          <div>
            <strong>{order.name}</strong>
            <em>{order.phone}</em>
          </div>
          <div className="items">
            {order.items.map((it) => (
              <span key={it} className="pill">{it}</span>
            ))}
          </div>
          {order.note && <p className="muted">Note: {order.note}</p>}
        </div>

        <div className="row-btns">
          <a className="call" href={`tel:${STORE.phone}`}>📞 Call shop</a>
          <a
            className="btn-directions"
            href={
              geo.pos
                ? `https://www.google.com/maps/dir/?api=1&origin=${geo.pos.lat},${geo.pos.lng}&destination=${STORE.lat},${STORE.lng}`
                : `https://www.google.com/maps/dir/?api=1&destination=${STORE.lat},${STORE.lng}`
            }
            target="_blank"
            rel="noreferrer"
          >
            🧭 Directions to store
          </a>
        </div>
      </section>

      <section className="card">
        <h3>Live map — you and the store</h3>
        <p className="tiny">
          {geo.pos
            ? `Sharing live position · store is ${distanceKm(geo.pos, store).toFixed(2)} km away`
            : 'Location signal lost, tap your browser address bar to allow location again.'}
        </p>
        <MapView
          height={260}
          connect
          points={[
            { id: 'store', lat: store.lat, lng: store.lng, kind: 'store', short: 'Shop', label: store.name },
            ...(geo.pos
              ? [{ id: 'me', lat: geo.pos.lat, lng: geo.pos.lng, kind: 'me', short: 'You', label: 'You are here' }]
              : []),
          ]}
          showAccuracy={geo.pos ? [geo.pos] : []}
        />
      </section>

      <section className="card chat">
        <h3>Chat with saler</h3>
        <div className="thread" ref={boxRef}>
          <p className="sys">
            Your request was sent with {order.items.length} item{order.items.length > 1 ? 's' : ''}
            {' '}{clockTime(order.createdAt)}. The saler sees your items and your map pin.
          </p>
          {msgs.length === 0 && <p className="sys">No reply yet. You can send a message here.</p>}
          {msgs.map((m) => (
            <div key={m.id} className={`msg ${m.from}`}>
              <span className="who">{m.from === 'saler' ? 'Saler' : 'You'}</span>
              <p>{m.text}</p>
              <time>{clockTime(m.at)}</time>
            </div>
          ))}
        </div>
        <form className="composer" onSubmit={send}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your product or question…"
          />
          <button type="submit" className="primary" disabled={!text.trim() || sending}>
            Send
          </button>
        </form>
        <button type="button" className="ghost small" onClick={() => nav('/')}>
          New order
        </button>
      </section>
    </div>
  );
}
