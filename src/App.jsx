import { useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import CustomerHome from './pages/CustomerHome';
import CustomerChat from './pages/CustomerChat';
import SalerArea from './pages/SalerArea';
import QRCodeModal from './components/QRCodeModal';
import { STORE } from './lib/config';

export default function App() {
  const { pathname } = useLocation();
  const isSaler = pathname.startsWith('/saler');
  const [showQR, setShowQR] = useState(false);

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-logo">🏪</span>
          <span>
            <strong>{STORE.name}</strong>
            <em>Kirana · 15 min delivery</em>
          </span>
        </Link>
        <div className="topbar-right">
          <button
            type="button"
            className="qr-header-btn"
            onClick={() => setShowQR(true)}
            title="View & Download Shop QR Code Standee"
          >
            📱 Shop QR
          </button>
          <Link to={isSaler ? '/' : '/saler'} className="switch-link">
            {isSaler ? 'Customer app' : 'Saler login'}
          </Link>
        </div>
      </header>

      <main className="page">
        <Routes>
          <Route path="/" element={<CustomerHome onOpenQR={() => setShowQR(true)} />} />
          <Route path="/order/:id" element={<CustomerChat onOpenQR={() => setShowQR(true)} />} />
          <Route path="/saler" element={<SalerArea onOpenQR={() => setShowQR(true)} />} />
          <Route path="/saler/order/:id" element={<SalerArea onOpenQR={() => setShowQR(true)} />} />
          <Route path="*" element={<CustomerHome onOpenQR={() => setShowQR(true)} />} />
        </Routes>
      </main>

      <QRCodeModal isOpen={showQR} onClose={() => setShowQR(false)} />
    </div>
  );
}
