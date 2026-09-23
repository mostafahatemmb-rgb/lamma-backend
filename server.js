// Lamma order backend
// Receives orders from the store, saves them, and pings your WhatsApp via CallMeBot.
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// Allow the storefront (hosted elsewhere) to call this API from the browser.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json());

const ORDERS_FILE = path.join(__dirname, 'orders.json');
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');

function loadOrders() {
  return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
}
function saveOrders(list) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(list, null, 2));
}

const {
  CALLMEBOT_PHONE,   // your own WhatsApp number, e.g. 201001234567
  CALLMEBOT_APIKEY,  // from CallMeBot setup, see README
  ADMIN_PASSWORD,    // password to view /api/orders
  PORT = 3000,
} = process.env;

async function sendWhatsAppNotification(order) {
  if (!CALLMEBOT_PHONE || !CALLMEBOT_APIKEY) {
    console.log('CallMeBot not configured — skipping WhatsApp notification.');
    return;
  }
  const lines = order.items
    .map((i) => `${i.name} x${i.qty} — ${i.price * i.qty} EGP`)
    .join('\n');
  const text =
    `New Lamma order #${order.id}\n${lines}\n` +
    `Total: ${order.total} EGP\n\n` +
    `Customer: ${order.customerName || '-'}\n` +
    `Phone: ${order.customerPhone || '-'}\n` +
    `Address: ${order.address || '-'}`;

  const url =
    `https://api.callmebot.com/whatsapp.php?phone=${CALLMEBOT_PHONE}` +
    `&text=${encodeURIComponent(text)}&apikey=${CALLMEBOT_APIKEY}`;

  try {
    await fetch(url);
  } catch (err) {
    console.error('WhatsApp notify failed:', err.message);
  }
}

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

  const orders = loadOrders();
  orders.unshift(order);
  saveOrders(orders);

  sendWhatsAppNotification(order); // fire-and-forget, doesn't block the response

  res.json({ ok: true, orderId: order.id });
});

// Simple password-protected view of saved orders (backup if WhatsApp fails).
function checkAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [, encoded] = header.split(' ');
  const decoded = encoded ? Buffer.from(encoded, 'base64').toString() : '';
  const [, password] = decoded.split(':');
  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    res.set('WWW-Authenticate', 'Basic realm="Lamma Orders"');
    return res.status(401).send('Authentication required.');
  }
  next();
}

app.get('/api/orders', checkAuth, (req, res) => {
  res.json(loadOrders());
});

app.get('/', (req, res) => {
  res.send('Lamma order backend is running.');
});

app.listen(PORT, () => {
  console.log(`Lamma order backend listening on port ${PORT}`);
});
