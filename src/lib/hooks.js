import { useCallback, useEffect, useRef, useState } from 'react';
import { getMessages, getMyOrders, getOrders, subscribe } from '../lib/db';

// Live snapshot of orders + messages, refreshed on every local/remote write.
export function useLive() {
  const [tick, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);
  void tick;
  return { orders: getOrders(), myOrders: getMyOrders(), refresh: () => setTick((t) => t + 1) };
}

export function useMessages(orderId) {
  const [tick, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);
  void tick;
  return orderId ? getMessages(orderId) : [];
}

// Real-time device GPS detection. watch=true streams live movement from the device.
export function useGeo({ watch = true } = {}) {
  const [pos, setPos] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setUnsupported(true);
      setLoading(false);
      setError('This browser does not support GPS location.');
      return;
    }
    let id = null;
    const onSuccess = (p) => {
      setLoading(false);
      setError(null);
      setPos({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        accuracy: Math.round(p.coords.accuracy),
        at: p.timestamp,
        source: 'device',
      });
    };
    const onError = (e) => {
      setLoading(false);
      setError(
        e.code === 1
          ? 'Location permission is blocked. Tap the lock/tune icon in your browser URL bar, set Location to "Allow", and tap Retry.'
          : 'Could not get device GPS fix. Please ensure device location is turned ON.',
      );
    };
    const opts = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };

    if (watch) {
      id = navigator.geolocation.watchPosition(onSuccess, onError, opts);
    } else {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, opts);
    }

    return () => {
      if (id !== null) navigator.geolocation.clearWatch(id);
    };
  }, [watch]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      setLoading(false);
      setError('Geolocation not supported on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLoading(false);
        setError(null);
        setPos({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: Math.round(p.coords.accuracy),
          at: p.timestamp,
          source: 'device',
        });
      },
      (e) => {
        setLoading(false);
        setError(
          e.code === 1
            ? 'Location permission blocked. Allow location for this site in your browser URL bar / settings and retry.'
            : 'Could not acquire GPS fix. Please check your device location settings.',
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  return { pos, error, loading, unsupported, retry };
}

// Auto-scroll a chat list to the newest message.
export function useScrollToEnd(dep) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [dep]);
  return ref;
}

export function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function clockTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
