// Single place to change shop details.
// Kanifnath Super Market — Shop 1, Vithal Rukhamani Mandir, Tower Line Rd, Chikhali, Pune
export const STORE = {
  name: 'Kanifnath Super Market',
  tagline: 'MilkyMist Ice Cream · Kirana · Daily Essentials',
  address:
    'Shop 1, Vithal Rukhamani Mandir, Tower Line Rd, near Saubhagya Jewellers, Chikhali, Pune, Maharashtra 411062',
  landmark: 'Near Saubhagya Jewellers & Vitthal Rukmini Mandir (MilkyMist Ice Cream banner)',
  lat: 18.672498,
  lng: 73.791012,
  phone: '+919130295446',
  phoneDisplay: '+91 91302 95446',
};

export const DEFAULT_STORE = {
  name: STORE.name,
  address: STORE.address,
  landmark: STORE.landmark,
  lat: STORE.lat,
  lng: STORE.lng,
  phone: STORE.phone,
  phoneDisplay: STORE.phoneDisplay,
};

export const SALER_CREDS = {
  username: 'saler',
  password: 'saler123',
};

export const STATUS_FLOW = ['new', 'packing', 'on_way', 'delivered'];

export const STATUS_LABEL = {
  new: '📥 Order Received',
  packing: '📦 Packed',
  on_way: '🚴 Out for Delivery',
  delivered: '✅ Delivered',
};

export const STATUS_CUSTOMER_LABEL = {
  new: 'Order received by Kanifnath Super Market',
  packing: 'Shopkeeper is packing your items',
  on_way: 'Out for delivery to your location',
  delivered: 'Order delivered! Thank you.',
};
