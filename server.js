// Storefront backend — shared, persistent storage for products/categories/settings,
// plus order intake with a WhatsApp notification via CallMeBot.
// Storage lives in a free JSONBin.io bin (see README) so the public store and the
// password-protected admin panel both read/write the same live data.
require('dotenv').config();
const express = require('express');

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json({ limit: '5mb' }));

const {
  CALLMEBOT_PHONE,
  CALLMEBOT_APIKEY,
  ADMIN_PASSWORD,
  JSONBIN_API_KEY,
  JSONBIN_BIN_ID,
  PORT = 3000,
} = process.env;

const DEFAULT_STORE = {
  products: [],
  categories: [],
  settings: { flow: 'whatsapp', contact: '', note: '' },
  orders: [],
};

async function loadStore() {
  if (!JSONBIN_API_KEY || !JSONBIN_BIN_ID) return { ...DEFAULT_STORE };
  const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
    headers: { 'X-Master-Key': JSONBIN_API_KEY },
  });
  if (!res.ok) return { ...DEFAULT_STORE };
  const data = await res.json();
  return { ...DEFAULT_STORE, ...(data.record || {}) };
}

async function saveStore(store) {
  if (!JSONBIN_API_KEY || !JSONBIN_BIN_ID) {
    throw new Error('Storage not configured (missing JSONBIN_API_KEY / JSONBIN_BIN_ID).');
  }
  const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY },
    body: JSON.stringify(store),
  });
  if (!res.ok) throw new Error('Failed to save to storage.');
}

function checkAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [, encoded] = header.split(' ');
  const decoded = encoded ? Buffer.from(encoded, 'base64').toString() : '';
  const [, password] = decoded.split(':');
  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).send('Authentication required.');
  }
  next();
}

// Public: what the storefront needs to render (no orders).
app.get('/api/public/data', async (req, res) => {
  try {
    const store = await loadStore();
    res.json({ products: store.products, categories: store.categories, settings: store.settings });
  } catch (err) {
    res.status(500).json({ error: 'Could not load store data.' });
  }
});

// Admin: full data including orders.
app.get('/api/admin/data', checkAuth, async (req, res) => {
  try {
    res.json(await loadStore());
  } catch (err) {
    res.status(500).json({ error: 'Could not load store data.' });
  }
});

// Admin: save products/categories/settings (orders are untouched here).
app.post('/api/admin/data', checkAuth, async (req, res) => {
  try {
    const { products, categories, settings } = req.body || {};
    const store = await loadStore();
    if (Array.isArray(products)) store.products = products;
    if (Array.isArray(categories)) store.categories = categories;
    if (settings && typeof settings === 'object') store.settings = { ...store.settings, ...settings };
    await saveStore(store);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Could not save.' });
  }
});

async function sendWhatsAppNotification(order) {
  if (!CALLMEBOT_PHONE || !CALLMEBOT_APIKEY) return;
  const lines = order.items.map((i) => `${i.name} x${i.qty} — ${i.price * i.qty} EGP`).join('\n');
  const text =
    `New order #${order.id}\n${lines}\nTotal: ${order.total} EGP\n\n` +
    `Customer: ${order.customerName || '-'}\nPhone: ${order.customerPhone || '-'}\nAddress: ${order.address || '-'}`;
  const url =
    `https://api.callmebot.com/whatsapp.php?phone=${CALLMEBOT_PHONE}` +
    `&text=${encodeURIComponent(text)}&apikey=${CALLMEBOT_APIKEY}`;
  try {
    await fetch(url);
  } catch (err) {
    console.error('WhatsApp notify failed:', err.message);
  }
}

// Public: place an order.
app.post('/api/order', async (req, res) => {
  const { items, customerName, customerPhone, address } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order has no items.' });
  }
  const total = items.reduce((sum, i) => sum + Number(i.price) * Number(i.qty), 0);
  const order = {
    id: Date.now().toString(36),
    items,
    customerName: customerName || '',
    customerPhone: customerPhone || '',
    address: address || '',
    total,
    createdAt: new Date().toISOString(),
  };
  try {
    const store = await loadStore();
    store.orders = store.orders || [];
    store.orders.unshift(order);
    store.orders = store.orders.slice(0, 500); // keep it bounded
    await saveStore(store);
  } catch (err) {
    console.error('Could not save order:', err.message);
  }
  sendWhatsAppNotification(order); // fire-and-forget
  res.json({ ok: true, orderId: order.id });
});

app.get('/', (req, res) => res.send('Storefront backend is running.'));

if (require.main === module) {
  app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
}

module.exports = app;
