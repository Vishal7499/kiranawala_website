import { useState } from 'react';
import { STORE } from '../lib/config';

export default function QRCodeModal({ isOpen, onClose }) {
  const [copied, setCopied] = useState(false);
  const websiteUrl = 'https://www.kiranawala.shop';
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(websiteUrl)}`;

  if (!isOpen) return null;

  function copyLink() {
    navigator.clipboard?.writeText(websiteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      // fallback
      prompt('Copy website link:', websiteUrl);
    });
  }

  function downloadQR() {
    // Download through anchor with blob/data fetch
    fetch(qrImageUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kiranawala_shop_qr.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      })
      .catch(() => {
        window.open(qrImageUrl, '_blank');
      });
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="qr-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="qr-modal-container" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="qr-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        {/* Printable Standee Card */}
        <div className="printable-standee" id="printable-standee">
          <div className="standee-header">
            <img src="/logo/kanifnath-logo.png" alt="Kanifnath Maharaj Logo" className="standee-logo-img" />
            <span className="standee-store-badge">🏪 KANIFNATH SUPER MARKET</span>
            <h2 className="standee-title">Scan to Order Groceries</h2>
            <p className="standee-tagline">15-Min Quick Delivery · Daily Fresh Essentials</p>
          </div>

          <div className="standee-qr-frame">
            <img
              src={qrImageUrl}
              alt="Scan to open Kiranawala.shop"
              className="standee-qr-img"
              width={260}
              height={260}
              loading="eager"
            />
            <div className="standee-scan-pill">
              📷 Scan with Phone Camera / Google Lens / PhonePe / Paytm
            </div>
          </div>

          <div className="standee-footer">
            <div className="standee-url-box">
              <span className="standee-url-label">Website:</span>
              <strong className="standee-url">{websiteUrl}</strong>
            </div>
            <p className="standee-address">
              📍 Shop 1, Vitthal Rukmini Mandir, Tower Line Rd, Chikhali, Pune
            </p>
            <p className="standee-phone">
              📞 Call: {STORE.phoneDisplay} · 💬 WhatsApp: +91 74990 28909
            </p>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="qr-modal-actions no-print">
          <button type="button" className="qr-action-btn primary" onClick={downloadQR}>
            📥 Download QR Image
          </button>
          <button type="button" className="qr-action-btn print" onClick={handlePrint}>
            🖨️ Print Counter Standee
          </button>
          <button type="button" className="qr-action-btn ghost" onClick={copyLink}>
            {copied ? '✅ Link Copied!' : '📋 Copy Website URL'}
          </button>
        </div>

        <p className="qr-modal-note no-print">
          💡 <strong>Tip for Shop Owner:</strong> Print this standee and stick it on your shop counter or MilkyMist freezer so customers can scan and reorder from home anytime!
        </p>
      </div>
    </div>
  );
}

