import { useEffect, useState } from 'react';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

function createIcon(kind) {
  if (kind === 'me') {
    return L.divIcon({
      className: 'device-location-marker-wrap',
      html: `
        <div class="device-dot" title="Your Device Location">
          <div class="device-pulse"></div>
          <div class="device-circle">📱</div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
  }
  if (kind === 'store') {
    return L.divIcon({
      className: 'store-location-marker-wrap',
      html: `
        <div class="store-pin" title="Kanifnath Super Market">
          <div class="store-icon-bubble">🏪</div>
          <div class="store-pin-point"></div>
        </div>
      `,
      iconSize: [36, 44],
      iconAnchor: [18, 42],
      popupAnchor: [0, -42],
    });
  }
  return L.divIcon({
    className: 'cust-location-marker-wrap',
    html: `
      <div class="cust-pin" title="Customer Delivery Location">
        <div class="cust-icon-bubble">👤</div>
        <div class="cust-pin-point"></div>
      </div>
    `,
    iconSize: [30, 38],
    iconAnchor: [15, 36],
    popupAnchor: [0, -36],
  });
}

function Fit({ points, routeCoords, sig }) {
  const map = useMap();
  useEffect(() => {
    const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (valid.length >= 2) {
      const bounds = L.latLngBounds(valid.map((p) => [p.lat, p.lng]));
      if (routeCoords && routeCoords.length > 0) {
        routeCoords.forEach(([lat, lng]) => bounds.extend([lat, lng]));
      }
      map.fitBounds(bounds.pad(0.2), { maxZoom: 17 });
    } else if (valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], 16);
    }
  }, [sig, routeCoords]);
  return null;
}

export default function MapView({
  points = [],
  showAccuracy = [],
  connect = false,
  zoom,
  height = 320,
  showRouteInfo = true,
  showNavButton = false,
}) {
  const first = points.find((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const sig = points.map((p) => `${p.id || ''}:${p.lat?.toFixed(5)}:${p.lng?.toFixed(5)}`).join('|');

  const storePoint = points.find((p) => p.kind === 'store');
  const userPoint = points.find((p) => p.kind === 'me' || p.kind === 'cust');

  const [routeData, setRouteData] = useState(null);

  // Check if user is literally at or right next to the store (< 30 meters)
  const isAtStore =
    userPoint &&
    storePoint &&
    Math.hypot(userPoint.lat - storePoint.lat, userPoint.lng - storePoint.lng) < 0.00035;

  useEffect(() => {
    if (!connect || !storePoint || !userPoint || isAtStore) {
      setRouteData(null);
      return;
    }
    let cancelled = false;
    const url = `https://router.project-osrm.org/route/v1/driving/${userPoint.lng},${userPoint.lat};${storePoint.lng},${storePoint.lat}?overview=full&geometries=geojson`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Route request failed');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data.code === 'Ok' && data.routes?.[0]) {
          const route = data.routes[0];
          const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          setRouteData({
            coordinates: coords,
            distanceKm: (route.distance / 1000).toFixed(2),
            durationMins: Math.max(1, Math.round(route.duration / 60)),
          });
        } else {
          setRouteData(null);
        }
      })
      .catch(() => {
        if (!cancelled) setRouteData(null);
      });

    return () => {
      cancelled = true;
    };
  }, [connect, storePoint?.lat, storePoint?.lng, userPoint?.lat, userPoint?.lng, isAtStore]);

  const defaultCenter = [18.672498, 73.791012];

  return (
    <div className="map-wrapper">
      <div className="map-box" style={{ height }}>
        <MapContainer
          center={first ? [first.lat, first.lng] : defaultCenter}
          zoom={zoom ?? 16}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Fit points={points} routeCoords={routeData?.coordinates} sig={sig} />

          {/* Road driving route when distance is more than 30m */}
          {connect && !isAtStore && routeData?.coordinates && (
            <>
              <Polyline
                positions={routeData.coordinates}
                pathOptions={{ color: '#1e40af', weight: 6, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }}
              />
              <Polyline
                positions={routeData.coordinates}
                pathOptions={{ color: '#38bdf8', weight: 3.5, opacity: 1, lineCap: 'round', lineJoin: 'round' }}
              />
            </>
          )}

          {connect && !isAtStore && !routeData?.coordinates && userPoint && storePoint && (
            <Polyline
              positions={[[userPoint.lat, userPoint.lng], [storePoint.lat, storePoint.lng]]}
              pathOptions={{ color: '#16a34a', dashArray: '6 8', weight: 3.5 }}
            />
          )}

          {points.map((p) => (
            <Marker
              key={p.id || `${p.lat}-${p.lng}`}
              position={[p.lat, p.lng]}
              icon={createIcon(p.kind)}
              zIndexOffset={p.kind === 'store' ? 1000 : 500}
            >
              {p.label && <Popup>{p.label}</Popup>}
            </Marker>
          ))}

          {showAccuracy.map((p) =>
            Number.isFinite(p.lat) ? (
              <Circle
                key={`acc-${p.id || p.lat}`}
                center={[p.lat, p.lng]}
                radius={Math.max(25, p.accuracy || 35)}
                pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.08 }}
              />
            ) : null,
          )}
        </MapContainer>
      </div>

      {showRouteInfo && userPoint && storePoint && (
        <div className="map-route-card compact">
          <div className="route-info-text">
            {isAtStore ? (
              <span>
                📍 <strong>You are right at Kanifnath Super Market</strong>
              </span>
            ) : (
              <span>
                🚗 Road to Shop:{' '}
                <strong>
                  {routeData
                    ? `${routeData.distanceKm} km (~${routeData.durationMins} min)`
                    : 'Direct'}
                </strong>
              </span>
            )}
          </div>
          {showNavButton && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&origin=${userPoint.lat},${userPoint.lng}&destination=${storePoint.lat},${storePoint.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-nav-compact"
              title="Open Navigation in Google Maps"
            >
              🧭 Nav
            </a>
          )}
        </div>
      )}
    </div>
  );
}
