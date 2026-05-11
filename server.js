const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const EMPLOYEE_CODE = process.env.EMPLOYEE_CODE || 'riverbar2026';
const BOSS_CODE = process.env.BOSS_CODE || 'bossriver2026';
const ORDERS_FILE = path.join(__dirname, 'orders.json');
const MENU_FILE = path.join(__dirname, 'menu.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const defaultMenu = [
  { id: 'cafe', name: 'Café', price: 8, discount: 0, active: true },
  { id: 'the-glace', name: 'Thé glacé', price: 10, discount: 0, active: true },
  { id: 'cocktail', name: 'Cocktail sans alcool', price: 16, discount: 0, active: true },
  { id: 'sandwich', name: 'Sandwich', price: 18, discount: 0, active: true },
  { id: 'planche-apero', name: 'Planche apéro', price: 25, discount: 0, active: true },
  { id: 'dessert', name: 'Dessert maison', price: 12, discount: 0, active: true }
];

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8') || JSON.stringify(fallback)); }
  catch { return fallback; }
}
function writeJson(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
function readOrders() { return readJson(ORDERS_FILE, []); }
function writeOrders(orders) { writeJson(ORDERS_FILE, orders); }
function readMenu() {
  const menu = readJson(MENU_FILE, defaultMenu);
  if (!fs.existsSync(MENU_FILE)) writeJson(MENU_FILE, menu);
  return menu;
}
function writeMenu(menu) { writeJson(MENU_FILE, menu); }
function getRole(code) {
  if (code === BOSS_CODE) return 'boss';
  if (code === EMPLOYEE_CODE) return 'employee';
  return null;
}
function requireStaff(req, res, next) {
  const role = getRole(req.headers['x-admin-code']);
  if (!role) return res.status(401).json({ error: 'Code incorrect.' });
  req.role = role;
  next();
}
function requireBoss(req, res, next) {
  const role = getRole(req.headers['x-admin-code']);
  if (role !== 'boss') return res.status(403).json({ error: 'Accès patron uniquement.' });
  req.role = role;
  next();
}
function finalPrice(item) {
  const discount = Math.min(100, Math.max(0, Number(item.discount) || 0));
  return Math.round((Number(item.price) || 0) * (1 - discount / 100));
}

app.get('/api/menu', (req, res) => {
  const menu = readMenu().filter(i => i.active !== false).map(i => ({ ...i, finalPrice: finalPrice(i) }));
  res.json(menu);
});

app.get('/api/boss/menu', requireBoss, (req, res) => {
  res.json(readMenu().map(i => ({ ...i, finalPrice: finalPrice(i) })));
});

app.post('/api/boss/menu', requireBoss, (req, res) => {
  const { name, price, discount, active } = req.body;
  if (!name || Number(price) < 0) return res.status(400).json({ error: 'Nom et prix valides obligatoires.' });
  const menu = readMenu();
  const id = Date.now().toString();
  const item = { id, name: String(name).trim(), price: Number(price), discount: Number(discount) || 0, active: active !== false };
  menu.unshift(item);
  writeMenu(menu);
  res.json(item);
});

app.patch('/api/boss/menu/:id', requireBoss, (req, res) => {
  const menu = readMenu();
  const item = menu.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Article introuvable.' });
  if (req.body.name !== undefined) item.name = String(req.body.name).trim();
  if (req.body.price !== undefined) item.price = Number(req.body.price) || 0;
  if (req.body.discount !== undefined) item.discount = Math.min(100, Math.max(0, Number(req.body.discount) || 0));
  if (req.body.active !== undefined) item.active = Boolean(req.body.active);
  writeMenu(menu);
  res.json({ ...item, finalPrice: finalPrice(item) });
});

app.delete('/api/boss/menu/:id', requireBoss, (req, res) => {
  writeMenu(readMenu().filter(i => i.id !== req.params.id));
  res.json({ ok: true });
});

app.post('/api/orders', (req, res) => {
  const { firstName, lastName, phone, note, cart } = req.body;
  if (!firstName || !lastName || !Array.isArray(cart) || cart.length === 0) {
    return res.status(400).json({ error: 'Nom, prénom et au moins un article obligatoires.' });
  }
  const menu = readMenu().filter(i => i.active !== false);
  const lines = cart.map(line => {
    const item = menu.find(i => i.id === line.id);
    const qty = Math.max(1, Math.min(99, Number(line.qty) || 1));
    if (!item) return null;
    const unit = finalPrice(item);
    return { id: item.id, name: item.name, qty, unitPrice: unit, originalPrice: item.price, discount: item.discount || 0, total: unit * qty };
  }).filter(Boolean);
  if (!lines.length) return res.status(400).json({ error: 'Aucun article valide.' });
  const order = {
    id: Date.now().toString(),
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    phone: (phone || '').trim(),
    note: (note || '').trim(),
    lines,
    total: lines.reduce((sum, l) => sum + l.total, 0),
    status: 'Nouvelle',
    createdAt: new Date().toISOString()
  };
  const orders = readOrders();
  orders.unshift(order);
  writeOrders(orders);
  res.json({ ok: true, order });
});

app.get('/api/orders', requireStaff, (req, res) => res.json({ role: req.role, orders: readOrders() }));

app.patch('/api/orders/:id', requireStaff, (req, res) => {
  const orders = readOrders();
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande introuvable.' });
  order.status = req.body.status || order.status;
  writeOrders(orders);
  res.json(order);
});

app.delete('/api/orders/:id', requireStaff, (req, res) => {
  writeOrders(readOrders().filter(o => o.id !== req.params.id));
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`River Bar lancé sur http://localhost:${PORT}`));
