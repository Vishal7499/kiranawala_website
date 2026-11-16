import { Link, Route, Routes, useLocation } from 'react-router-dom';
import CustomerHome from './pages/CustomerHome';
import CustomerChat from './pages/CustomerChat';
import SalerArea from './pages/SalerArea';
import { STORE } from './lib/config';

export default function App() {
  const { pathname } = useLocation();
  const isSaler = pathname.startsWith('/saler');
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
        <Link to={isSaler ? '/' : '/saler'} className="switch-link">
          {isSaler ? 'Customer app' : 'Saler login'}
        </Link>
      </header>

      <main className="page">
        <Routes>
          <Route path="/" element={<CustomerHome />} />
          <Route path="/order/:id" element={<CustomerChat />} />
          <Route path="/saler" element={<SalerArea />} />
          <Route path="/saler/order/:id" element={<SalerArea />} />
          <Route path="*" element={<CustomerHome />} />
        </Routes>
      </main>
    </div>
  );
}
