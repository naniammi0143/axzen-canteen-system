const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const { Server } = require("socket.io");
const { sendWhatsAppText } = require("./whatsappService");

dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = Number(process.env.PORT || 5000);
const DB_NAME = process.env.MONGODB_DB_NAME || "axzen_canteen";
const INDIA_TZ = "Asia/Kolkata";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Warn during startup when the Meta webhook verification token is not configured.
if (!VERIFY_TOKEN) {
  console.warn("VERIFY_TOKEN is missing. Meta WhatsApp webhook verification will fail until it is configured.");
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Safely handle malformed JSON bodies without crashing existing API routes.
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    console.warn("Invalid JSON request body:", error.message);
    return res.status(400).json({ success: false, message: "Invalid JSON body" });
  }
  return next(error);
});

app.use("/mobile", express.static(path.join(__dirname, "../sa")));
app.use("/admin", express.static(path.join(__dirname, "../admin-web")));

const defaultMenuItems = [
  { id: 1, name: "Tea", price: 10, category: "Tea", image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=500&q=80" },
  { id: 2, name: "Coffee", price: 20, category: "Tea", image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=500&q=80" },
  { id: 3, name: "Meals", price: 80, category: "Meals", image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=500&q=80" },
  { id: 4, name: "Idly", price: 30, category: "Tiffin", image: "https://images.unsplash.com/photo-1630409351241-e90e7f5e434d?auto=format&fit=crop&w=500&q=80" },
  { id: 5, name: "Dosa", price: 45, category: "Tiffin", image: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=500&q=80" },
  { id: 6, name: "Samosa", price: 15, category: "Snacks", image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=500&q=80" },
  { id: 7, name: "Veg Puff", price: 25, category: "Snacks", image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=500&q=80" },
  { id: 8, name: "Juice", price: 35, category: "Juice", image: "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=500&q=80" }
];

const defaultCatalogItems = [
  ...defaultMenuItems,
  { id: 101, name: "Poori", price: 40, category: "Tiffin", image: "https://images.unsplash.com/photo-1617692855027-33b14f061079?auto=format&fit=crop&w=500&q=80" },
  { id: 102, name: "Vada", price: 25, category: "Tiffin", image: "https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=500&q=80" },
  { id: 103, name: "Chapati", price: 50, category: "Meals", image: "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=500&q=80" },
  { id: 104, name: "Lemon Rice", price: 45, category: "Lunch", image: "https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=500&q=80" },
  { id: 105, name: "Curd Rice", price: 40, category: "Lunch", image: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=500&q=80" },
  { id: 106, name: "Water Bottle", price: 20, category: "Drinks", image: "https://images.unsplash.com/photo-1550505095-81378a674395?auto=format&fit=crop&w=500&q=80" },
  { id: 107, name: "Biscuits", price: 10, category: "Snacks", image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=500&q=80" },
  { id: 108, name: "Banana", price: 10, category: "Snacks", image: "https://images.unsplash.com/photo-1603833665858-e61d17a86224?auto=format&fit=crop&w=500&q=80" }
];

const defaultStockItems = [
  { id: 1, item: "Tea Powder", stock: 0.5, unit: "Kg", minStock: 1 },
  { id: 2, item: "Sugar", stock: 1.2, unit: "Kg", minStock: 2 },
  { id: 3, item: "Milk", stock: 0.8, unit: "Ltr", minStock: 2 },
  { id: 4, item: "Bread", stock: 12, unit: "Packet", minStock: 5 }
];

const defaultUsers = [
  { id: 1, name: "Admin", mobile: "admin", password: "1234", role: "admin", active: true },
  { id: 2, name: "Cashier", mobile: "user", password: "1234", role: "user", active: true }
];

const defaultSettings = {
  key: "app",
  canteenName: "Main Canteen",
  brandName: "Axzen",
  tagline: "Infotech",
  reportTime: "22:00",
  adminWhatsAppNumber: "",
  reportPhone: "",
  autoReport: false,
  reportType: "daily"
};

let mongoReady = false;
let mongoError = "";
let initialized = false;
let schedulerStarted = false;
let lastScheduledReportKey = "";

let memory = {
  menuItems: [...defaultMenuItems],
  stockItems: [...defaultStockItems],
  expenses: [],
  orders: [],
  sales: [],
  users: [...defaultUsers],
  settings: { ...defaultSettings },
  whatsappLogs: []
};

const orderSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  clientOrderId: { type: String, unique: true, sparse: true, index: true },
  time: String,
  canteen: String,
  cashier: String,
  payment: String,
  paymentBreakup: mongoose.Schema.Types.Mixed,
  total: Number,
  items: [{ id: Number, name: String, price: Number, qty: Number }],
  syncedAt: String
}, { timestamps: true, collection: "orders" });

const saleSchema = new mongoose.Schema({
  orderId: Number,
  clientOrderId: { type: String, unique: true, sparse: true, index: true },
  time: String,
  canteen: String,
  cashier: String,
  payment: String,
  paymentBreakup: mongoose.Schema.Types.Mixed,
  total: Number,
  items: [{ id: Number, name: String, price: Number, qty: Number }],
  syncedAt: String
}, { timestamps: true, collection: "sales" });

const userSchema = new mongoose.Schema({
  id: Number,
  name: String,
  mobile: { type: String, unique: true, index: true },
  password: String,
  role: { type: String, enum: ["admin", "user"], default: "user" },
  active: { type: Boolean, default: true }
}, { timestamps: true, collection: "users" });

const menuItemSchema = new mongoose.Schema({
  id: { type: Number, unique: true, sparse: true, index: true },
  name: String,
  price: Number,
  category: String,
  image: String
}, { timestamps: true, collection: "menu_items" });

const stockItemSchema = new mongoose.Schema({
  id: { type: Number, unique: true, sparse: true, index: true },
  item: String,
  stock: Number,
  unit: String,
  minStock: Number
}, { timestamps: true, collection: "stock_items" });

const expenseSchema = new mongoose.Schema({
  id: { type: Number, unique: true, sparse: true, index: true },
  title: String,
  amount: Number,
  category: String,
  time: String
}, { timestamps: true, collection: "expenses" });

const reportSettingSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true, default: "app" },
  canteenName: String,
  brandName: String,
  tagline: String,
  reportTime: String,
  adminWhatsAppNumber: String,
  reportPhone: String,
  autoReport: Boolean,
  reportType: String
}, { timestamps: true, collection: "report_settings" });

const whatsappLogSchema = new mongoose.Schema({
  time: String,
  success: Boolean,
  reason: String,
  to: String,
  message: String,
  error: String,
  meta: mongoose.Schema.Types.Mixed
}, { timestamps: true, collection: "whatsapp_logs" });

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
const Sale = mongoose.models.Sale || mongoose.model("Sale", saleSchema);
const User = mongoose.models.User || mongoose.model("User", userSchema);
const MenuItem = mongoose.models.MenuItem || mongoose.model("MenuItem", menuItemSchema);
const StockItem = mongoose.models.StockItem || mongoose.model("StockItem", stockItemSchema);
const Expense = mongoose.models.Expense || mongoose.model("Expense", expenseSchema);
const ReportSetting = mongoose.models.ReportSetting || mongoose.model("ReportSetting", reportSettingSchema);
const WhatsappLog = mongoose.models.WhatsappLog || mongoose.model("WhatsappLog", whatsappLogSchema);

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id || item.orderId || 0)), 0) + 1;
}

function normalizeMobile(value) {
  return String(value || "").trim();
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: String(user._id || user.id || user.mobile),
    name: user.name,
    mobile: user.mobile,
    role: user.role,
    active: user.active !== false
  };
}

function signToken(user) {
  if (!process.env.JWT_SECRET) return null;
  return jwt.sign(publicUser(user), process.env.JWT_SECRET, { expiresIn: "7d" });
}

function requireAdmin(req, res, next) {
  if (!process.env.JWT_SECRET) return next();
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ success: false, message: "Login token missing" });

  try {
    req.authUser = jwt.verify(token, process.env.JWT_SECRET);
    if (req.authUser.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired login token" });
  }
}

async function seedDefaults() {
  for (const user of defaultUsers) {
    await User.findOneAndUpdate(
      { mobile: user.mobile },
      { $setOnInsert: user },
      { upsert: true }
    );
  }
  if (!await MenuItem.countDocuments()) await MenuItem.insertMany(defaultMenuItems);
  if (!await StockItem.countDocuments()) await StockItem.insertMany(defaultStockItems);
  await ReportSetting.findOneAndUpdate(
    { key: "app" },
    { $setOnInsert: defaultSettings },
    { upsert: true }
  );
}

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    mongoReady = false;
    mongoError = "MONGODB_URI missing";
    console.log("MONGODB_URI missing. Running with local memory fallback.");
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    mongoReady = true;
    mongoError = "";
    return true;
  }

  try {
    await mongoose.connect(uri, { dbName: DB_NAME, serverSelectionTimeoutMS: 8000 });
    mongoReady = true;
    mongoError = "";
    await seedDefaults();
    console.log(`MongoDB Atlas connected: ${DB_NAME}`);
    return true;
  } catch (error) {
    mongoReady = false;
    mongoError = error.message;
    console.log("MongoDB Atlas connection failed:", error.message);
    return false;
  }
}

function modelToPlain(doc) {
  return doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
}

async function allMenuItems() {
  if (!mongoReady) return memory.menuItems;
  return MenuItem.find({}).sort({ id: 1, createdAt: 1 }).lean();
}

async function saveMenuItem(payload) {
  const current = await allMenuItems();
  const item = {
    id: payload.id ? Number(payload.id) : nextId(current),
    name: String(payload.name || "").trim(),
    price: Number(payload.price || 0),
    category: payload.category || "Snacks",
    image: payload.image || ""
  };

  if (!item.name) throw new Error("Product name is required");

  if (!mongoReady) {
    const existing = memory.menuItems.find(row => Number(row.id) === Number(item.id));
    if (existing) Object.assign(existing, item);
    else memory.menuItems.push(item);
    return item;
  }

  return modelToPlain(await MenuItem.findOneAndUpdate(
    { id: item.id },
    { $set: item },
    { new: true, upsert: true }
  ));
}

async function deleteMenuItem(id) {
  if (!mongoReady) {
    memory.menuItems = memory.menuItems.filter(item => Number(item.id) !== Number(id));
    return;
  }
  await MenuItem.deleteOne({ id: Number(id) });
}

async function allStockItems() {
  if (!mongoReady) return memory.stockItems;
  return StockItem.find({}).sort({ id: 1, createdAt: 1 }).lean();
}

async function saveStockItem(payload) {
  const current = await allStockItems();
  const item = {
    id: payload.id ? Number(payload.id) : nextId(current),
    item: String(payload.item || "").trim(),
    stock: Number(payload.stock || 0),
    unit: payload.unit || "Unit",
    minStock: Number(payload.minStock || 0)
  };

  if (!item.item) throw new Error("Stock item is required");

  if (!mongoReady) {
    const existing = memory.stockItems.find(row => Number(row.id) === Number(item.id));
    if (existing) Object.assign(existing, item);
    else memory.stockItems.push(item);
    return item;
  }

  return modelToPlain(await StockItem.findOneAndUpdate(
    { id: item.id },
    { $set: item },
    { new: true, upsert: true }
  ));
}

async function allExpenses() {
  if (!mongoReady) return memory.expenses;
  return Expense.find({}).sort({ createdAt: 1 }).lean();
}

async function saveExpense(payload) {
  const current = await allExpenses();
  const expense = {
    id: payload.id ? Number(payload.id) : nextId(current),
    title: String(payload.title || "").trim(),
    amount: Number(payload.amount || 0),
    category: payload.category || "General",
    time: payload.time || new Date().toLocaleString("en-IN", { timeZone: INDIA_TZ })
  };

  if (!expense.title) throw new Error("Expense title is required");

  if (!mongoReady) {
    const existing = memory.expenses.find(row => Number(row.id) === Number(expense.id));
    if (existing) Object.assign(existing, expense);
    else memory.expenses.push(expense);
    return expense;
  }

  return modelToPlain(await Expense.findOneAndUpdate(
    { id: expense.id },
    { $set: expense },
    { new: true, upsert: true }
  ));
}

async function getSettings() {
  if (!mongoReady) return memory.settings;
  const stored = await ReportSetting.findOne({ key: "app" }).lean();
  return { ...defaultSettings, ...(stored || {}) };
}

function parseReportTime(value) {
  const raw = String(value || "").trim();
  const match24 = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (match24) return `${match24[1].padStart(2, "0")}:${match24[2]}`;

  const match12 = raw.match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i);
  if (!match12) return "22:00";

  let hour = Number(match12[1]);
  const minute = match12[2];
  const suffix = match12[3].toUpperCase();
  if (suffix === "PM" && hour < 12) hour += 12;
  if (suffix === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

async function saveSettings(payload) {
  const next = { ...payload };
  if (Object.prototype.hasOwnProperty.call(next, "autoReport")) {
    next.autoReport = next.autoReport === true || next.autoReport === "true";
  }
  if (next.reportTime) next.reportTime = parseReportTime(next.reportTime);
  if (next.adminWhatsAppNumber) next.reportPhone = next.adminWhatsAppNumber;
  if (next.reportPhone && !next.adminWhatsAppNumber) next.adminWhatsAppNumber = next.reportPhone;

  if (!mongoReady) {
    memory.settings = { ...memory.settings, ...next };
    return memory.settings;
  }

  const saved = await ReportSetting.findOneAndUpdate(
    { key: "app" },
    { $set: { ...next, key: "app" } },
    { new: true, upsert: true }
  ).lean();
  return { ...defaultSettings, ...saved };
}

async function allUsers() {
  if (!mongoReady) return memory.users;
  return User.find({}).sort({ createdAt: 1 }).lean();
}

async function saveUser(payload) {
  const user = {
    id: payload.id ? Number(payload.id) : nextId(await allUsers()),
    name: payload.name || "User",
    mobile: normalizeMobile(payload.mobile),
    password: String(payload.password || "1234"),
    role: payload.role === "admin" ? "admin" : "user",
    active: payload.active !== false
  };

  if (!user.mobile) throw new Error("Mobile is required");

  if (!mongoReady) {
    const existing = memory.users.find(row => row.mobile === user.mobile);
    if (existing) Object.assign(existing, user);
    else memory.users.push(user);
    return user;
  }

  return modelToPlain(await User.findOneAndUpdate(
    { mobile: user.mobile },
    { $set: user },
    { new: true, upsert: true }
  ));
}

async function deleteUser(mobile) {
  if (!mongoReady) {
    memory.users = memory.users.filter(user => user.mobile !== mobile);
    return;
  }
  await User.deleteOne({ mobile });
}

function makeOrder(payload) {
  const total = Number(payload.total || 0);
  const paymentBreakup = normalizePaymentBreakup(payload.paymentBreakup, payload.payment, total);
  return {
    id: payload.id || Date.now(),
    clientOrderId: payload.clientOrderId,
    time: payload.time || new Date().toLocaleString("en-IN", { timeZone: INDIA_TZ }),
    canteen: payload.canteen || "Main Canteen",
    cashier: payload.cashier || "Mobile Cashier",
    payment: payload.payment || "Cash",
    paymentBreakup,
    total,
    items: Array.isArray(payload.items) ? payload.items : [],
    syncedAt: new Date().toISOString()
  };
}

function normalizePaymentBreakup(value, payment, total) {
  const source = value && typeof value === "object" ? value : {};
  if (payment === "Split") {
    const cash = Math.max(0, Number(source.cash || 0));
    const online = Math.max(0, Number(source.online || 0));
    return { cash, online };
  }
  if (payment === "Online") return { cash: 0, online: total };
  if (payment === "Cancel") return { cash: 0, online: 0 };
  return { cash: total, online: 0 };
}

async function saveOrder(payload) {
  const order = makeOrder(payload);

  if (!mongoReady) {
    const exists = memory.orders.find(row =>
      (order.clientOrderId && row.clientOrderId === order.clientOrderId) || Number(row.id) === Number(order.id)
    );
    if (exists) return exists;
    memory.orders.push(order);
    memory.sales.push({ ...order, orderId: order.id });
    return order;
  }

  const filter = order.clientOrderId ? { clientOrderId: order.clientOrderId } : { id: order.id };
  const saved = await Order.findOneAndUpdate(
    filter,
    { $setOnInsert: order },
    { new: true, upsert: true }
  ).lean();

  await Sale.findOneAndUpdate(
    order.clientOrderId ? { clientOrderId: order.clientOrderId } : { orderId: order.id },
    { $setOnInsert: { ...order, orderId: order.id } },
    { new: true, upsert: true }
  );

  return saved;
}

async function allOrders() {
  if (!mongoReady) return memory.orders;
  return Order.find({}).sort({ createdAt: 1 }).lean();
}

async function clearOrders() {
  if (!mongoReady) {
    memory.orders = [];
    memory.sales = [];
    return;
  }
  await Promise.all([Order.deleteMany({}), Sale.deleteMany({})]);
}

function indiaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: INDIA_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function indiaDateKey(date = new Date()) {
  const parts = indiaParts(date);
  return `${parts.day}-${parts.month}-${parts.year}`;
}

function indiaTimeKey(date = new Date()) {
  const parts = indiaParts(date);
  return `${parts.hour}:${parts.minute}`;
}

function orderDate(order) {
  if (order.createdAt) return new Date(order.createdAt);
  if (order.syncedAt) return new Date(order.syncedAt);
  if (Number(order.id)) return new Date(Number(order.id));
  return new Date(order.time || Date.now());
}

function reportOrdersForType(orders, reportType) {
  const now = new Date();
  const todayKey = indiaDateKey(now);
  if (reportType === "monthly") {
    const currentMonth = todayKey.slice(3);
    return orders.filter(order => indiaDateKey(orderDate(order)).slice(3) === currentMonth);
  }
  if (reportType === "weekly") {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return orders.filter(order => orderDate(order) >= weekAgo);
  }
  return orders.filter(order => indiaDateKey(orderDate(order)) === todayKey);
}

function topItemsFromOrders(orders) {
  const counts = new Map();
  orders.forEach(order => (order.items || []).forEach(item => {
    const key = item.name || "Item";
    const current = counts.get(key) || { name: key, qty: 0, total: 0 };
    current.qty += Number(item.qty || 0);
    current.total += Number(item.qty || 0) * Number(item.price || 0);
    counts.set(key, current);
  }));
  return [...counts.values()].sort((a, b) => b.qty - a.qty);
}

function paymentTotals(orders) {
  return orders.reduce((totals, order) => {
    const amount = Number(order.total || 0);
    totals.totalSales += amount;
    const breakup = normalizePaymentBreakup(order.paymentBreakup, order.payment, amount);
    totals.cash += Number(breakup.cash || 0);
    totals.upi += Number(breakup.online || 0);
    totals.online = totals.upi + totals.card;
    return totals;
  }, { totalSales: 0, cash: 0, upi: 0, card: 0, online: 0 });
}

function userSalesFromOrders(orders) {
  const rows = new Map();
  orders.forEach(order => {
    const key = order.cashier || "Unknown";
    const row = rows.get(key) || { user: key, orders: 0, total: 0, cash: 0, online: 0 };
    const amount = Number(order.total || 0);
    const breakup = normalizePaymentBreakup(order.paymentBreakup, order.payment, amount);
    row.orders += 1;
    row.total += amount;
    row.cash += Number(breakup.cash || 0);
    row.online += Number(breakup.online || 0);
    rows.set(key, row);
  });
  return [...rows.values()].sort((a, b) => b.total - a.total);
}

async function reportData(reportType = "daily") {
  const currentOrders = reportOrdersForType(await allOrders(), reportType);
  const currentExpenses = await allExpenses();
  const currentStock = await allStockItems();
  const totals = paymentTotals(currentOrders);
  const totalExpenses = currentExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  return {
    orders: currentOrders,
    expenses: currentExpenses,
    stock: currentStock,
    totalExpenses,
    topItems: topItemsFromOrders(currentOrders),
    lowStock: currentStock.filter(item => Number(item.stock || 0) <= Number(item.minStock || 0)),
    ...totals,
    netCollection: totals.totalSales - totalExpenses
  };
}

async function buildWhatsAppReport(reportType = "daily") {
  const data = await reportData(reportType);
  const appSettings = await getSettings();
  const titleType = reportType[0].toUpperCase() + reportType.slice(1);
  const topLines = data.topItems.slice(0, 3).length
    ? data.topItems.slice(0, 3).map((item, index) => `${index + 1}. ${item.name} - ${item.qty}`).join("\n")
    : "No items sold";
  const stockLines = data.lowStock.length
    ? data.lowStock.map(item => `- ${item.item} low`).join("\n")
    : "- No low stock";

  return [
    `🍽 ${appSettings.canteenName || "Axzen Canteen"} ${titleType} Report`,
    `📅 Date: ${indiaDateKey()}`,
    "",
    `💰 Total Sale: ₹${data.totalSales.toFixed(0)}`,
    `💵 Cash: ₹${data.cash.toFixed(0)}`,
    `📱 Online: ₹${data.online.toFixed(0)}`,
    `🧾 Total Orders: ${data.orders.length}`,
    "",
    "Top Items:",
    topLines,
    "",
    `Expenses: ₹${data.totalExpenses.toFixed(0)}`,
    `Net Collection: ₹${data.netCollection.toFixed(0)}`,
    "",
    "Stock Alerts:",
    stockLines
  ].join("\n");
}

async function addWhatsAppLog(entry) {
  const log = {
    time: new Date().toISOString(),
    ...entry
  };
  if (!mongoReady) {
    memory.whatsappLogs.unshift(log);
    memory.whatsappLogs = memory.whatsappLogs.slice(0, 100);
  } else {
    await WhatsappLog.create(log);
  }
  const state = log.success ? "sent success" : `failed: ${log.error}`;
  console.log(`WhatsApp report ${state} | to=${log.to || "-"} | time=${log.time}`);
  return log;
}

async function allWhatsappLogs() {
  if (!mongoReady) return memory.whatsappLogs;
  return WhatsappLog.find({}).sort({ createdAt: -1 }).limit(100).lean();
}

async function sendReportNow(reason = "manual") {
  const appSettings = await getSettings();
  const to = appSettings.adminWhatsAppNumber || appSettings.reportPhone;
  if (!to) throw new Error("Missing admin WhatsApp number");

  const message = await buildWhatsAppReport(appSettings.reportType || "daily");
  const meta = await sendWhatsAppText(to, message);
  await addWhatsAppLog({ success: true, reason, to, message, meta });
  return { to, message, meta };
}

async function checkScheduledWhatsAppReport() {
  try {
    const appSettings = await getSettings();
    if (!appSettings.autoReport) return { checked: true, sent: false, reason: "auto report off" };

    const scheduleTime = parseReportTime(appSettings.reportTime);
    const nowTime = indiaTimeKey();
    const todayKey = indiaDateKey();
    const reportKey = `${todayKey}-${scheduleTime}-${appSettings.reportType || "daily"}`;
    if (nowTime !== scheduleTime) return { checked: true, sent: false, reason: "not scheduled time" };
    if (lastScheduledReportKey === reportKey) return { checked: true, sent: false, reason: "already sent" };

    const result = await sendReportNow("scheduled");
    lastScheduledReportKey = reportKey;
    return { checked: true, sent: true, to: result.to };
  } catch (error) {
    const appSettings = await getSettings();
    await addWhatsAppLog({
      success: false,
      reason: "scheduled",
      to: appSettings.adminWhatsAppNumber || appSettings.reportPhone || "",
      error: error.message
    });
    return { checked: true, sent: false, error: error.message };
  }
}

async function dashboardData() {
  const orders = await allOrders();
  const todayOrders = reportOrdersForType(orders, "daily");
  const stock = await allStockItems();
  const expenses = await allExpenses();
  const products = await allMenuItems();
  const todayTotals = paymentTotals(todayOrders);
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  return {
    ...todayTotals,
    totalBills: todayOrders.length,
    totalExpenses,
    netCollection: todayTotals.totalSales - totalExpenses,
    topItems: topItemsFromOrders(todayOrders),
    userSales: userSalesFromOrders(todayOrders),
    lowStock: stock.filter(item => Number(item.stock || 0) <= Number(item.minStock || 0)),
    stock,
    expenses,
    products,
    users: (await allUsers()).map(publicUser),
    settings: await getSettings(),
    orders
  };
}

// Extract WhatsApp messages, statuses, contacts, and errors from a Meta Cloud API webhook payload.
async function handleWhatsAppWebhook(payload) {
  try {
    const entries = Array.isArray(payload && payload.entry) ? payload.entry : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry && entry.changes) ? entry.changes : [];

      for (const change of changes) {
        const value = change && change.value ? change.value : {};
        const contacts = Array.isArray(value.contacts) ? value.contacts : [];
        const messages = Array.isArray(value.messages) ? value.messages : [];
        const statuses = Array.isArray(value.statuses) ? value.statuses : [];
        const errors = Array.isArray(value.errors) ? value.errors : [];

        // Log contact details when Meta includes profile/contact information.
        contacts.forEach(contact => {
          console.log("WhatsApp contact:", {
            waId: contact.wa_id || "",
            name: contact.profile && contact.profile.name ? contact.profile.name : ""
          });
        });

        // Log each incoming WhatsApp message without assuming a fixed message shape.
        messages.forEach(message => {
          const senderPhone = message.from || "";
          const messageId = message.id || "";
          const messageType = message.type || "";
          const timestamp = message.timestamp || "";

          console.log("WhatsApp message event:", {
            senderPhone,
            messageId,
            messageType,
            timestamp
          });

          if (messageType === "text") {
            const text = message.text && message.text.body ? message.text.body : "";
            console.log(`Incoming WhatsApp message from ${senderPhone}: ${text}`);
          }
        });

        // Log delivery, read, sent, and failed statuses from Meta status webhooks.
        for (const status of statuses) {
          const deliveryStatus = status.status === "delivered" ? status.status : "";
          const readStatus = status.status === "read" ? status.status : "";
          const failedStatus = status.status === "failed" ? status.status : "";
          const statusErrors = Array.isArray(status.errors) ? status.errors : [];
          const errorText = statusErrors.map(item =>
            item.message || item.title || item.error_data?.details || item.code || "Unknown status error"
          ).join(" | ");

          console.log("WhatsApp status event:", {
            recipientPhone: status.recipient_id || "",
            messageId: status.id || "",
            timestamp: status.timestamp || "",
            status: status.status || "",
            deliveryStatus,
            readStatus,
            failedStatus,
            errors: statusErrors
          });

          await addWhatsAppLog({
            success: status.status !== "failed",
            reason: `status:${status.status || "unknown"}`,
            to: status.recipient_id || "",
            error: errorText,
            meta: status
          });
        }

        // Log webhook-level errors if Meta sends an error array in the change value.
        for (const error of errors) {
          console.log("WhatsApp webhook error:", {
            code: error.code || "",
            title: error.title || "",
            message: error.message || "",
            details: error.error_data && error.error_data.details ? error.error_data.details : ""
          });

          await addWhatsAppLog({
            success: false,
            reason: "webhook:error",
            to: "",
            error: error.message || error.title || error.error_data?.details || "WhatsApp webhook error",
            meta: error
          });
        }
      }
    }
  } catch (error) {
    console.warn("WhatsApp webhook payload handling failed:", error.message);
  }
}

// Register Meta WhatsApp Cloud API webhook verification and event receiver routes.
function registerWhatsAppWebhookRoutes(targetApp) {
  targetApp.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (!VERIFY_TOKEN) {
      console.warn("VERIFY_TOKEN is missing. Rejecting Meta webhook verification.");
    }

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Meta WhatsApp webhook verified successfully.");
      return res.status(200).send(challenge);
    }

    console.warn("Meta WhatsApp webhook verification failed.");
    return res.sendStatus(403);
  });

  targetApp.post("/webhook", (req, res) => {
    const payload = req.body || {};

    console.log("Meta WhatsApp webhook payload:", JSON.stringify(payload, null, 2));
    res.sendStatus(200);

    setImmediate(() => {
      handleWhatsAppWebhook(payload).catch(error => {
        console.warn("WhatsApp webhook async handler failed:", error.message);
      });
    });
  });
}

registerWhatsAppWebhookRoutes(app);

app.get("/", (req, res) => {
  res.redirect("/admin/");
});

app.get("/health", (req, res) => {
  res.json({ success: true, mongoReady, database: DB_NAME, mongoError });
});

app.get("/products", async (req, res) => res.json(await allMenuItems()));

app.get("/catalog/default-products", requireAdmin, async (req, res) => {
  const liveIds = new Set((await allMenuItems()).map(item => Number(item.id)));
  res.json(defaultCatalogItems.map(item => ({ ...item, active: liveIds.has(Number(item.id)) })));
});

app.post("/products", requireAdmin, async (req, res) => {
  try {
    const product = await saveMenuItem(req.body);
    res.json({ success: true, product, products: await allMenuItems() });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.delete("/products/:id", requireAdmin, async (req, res) => {
  await deleteMenuItem(req.params.id);
  res.json({ success: true, products: await allMenuItems() });
});

app.get("/stock", async (req, res) => res.json(await allStockItems()));

app.post("/stock", requireAdmin, async (req, res) => {
  try {
    const item = await saveStockItem(req.body);
    res.json({ success: true, item, stock: await allStockItems() });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get("/expenses", requireAdmin, async (req, res) => res.json(await allExpenses()));

app.post("/expenses", requireAdmin, async (req, res) => {
  try {
    const expense = await saveExpense(req.body);
    res.json({ success: true, expense, expenses: await allExpenses() });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get("/settings", async (req, res) => res.json(await getSettings()));

app.post("/settings", requireAdmin, async (req, res) => {
  try {
    res.json({ success: true, settings: await saveSettings(req.body) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/login", async (req, res) => {
  const mobile = normalizeMobile(req.body.mobile);
  const password = String(req.body.password || "");
  const user = (await allUsers()).find(item =>
    item.active !== false &&
    String(item.mobile) === mobile &&
    String(item.password) === password
  );

  if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });
  res.json({ success: true, user: publicUser(user), token: signToken(user), settings: await getSettings() });
});

app.get("/users", requireAdmin, async (req, res) => res.json((await allUsers()).map(publicUser)));

app.post("/users", requireAdmin, async (req, res) => {
  try {
    res.json({ success: true, user: publicUser(await saveUser(req.body)) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.delete("/users/:mobile", requireAdmin, async (req, res) => {
  await deleteUser(req.params.mobile);
  res.json({ success: true });
});

app.post("/orders", async (req, res) => {
  try {
    const order = await saveOrder(req.body);
    io.emit("new-order", order);
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/orders/sync", async (req, res) => {
  try {
    const incoming = Array.isArray(req.body.orders) ? req.body.orders : [];
    const synced = [];
    for (const payload of incoming) {
      const order = await saveOrder(payload);
      synced.push(order.clientOrderId || order.id);
    }
    if (synced.length) io.emit("orders-synced", synced);
    res.json({ success: true, synced });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/orders", requireAdmin, async (req, res) => res.json(await allOrders()));

app.delete("/orders", requireAdmin, async (req, res) => {
  await clearOrders();
  io.emit("orders-cleared");
  res.json({ success: true });
});

app.get("/dashboard", requireAdmin, async (req, res) => res.json(await dashboardData()));

app.post("/whatsapp/send-test-report", requireAdmin, async (req, res) => {
  try {
    const result = await sendReportNow("manual");
    res.json({ success: true, to: result.to, message: result.message, meta: result.meta });
  } catch (error) {
    const appSettings = await getSettings();
    await addWhatsAppLog({
      success: false,
      reason: "manual",
      to: appSettings.adminWhatsAppNumber || appSettings.reportPhone || "",
      error: error.message
    });
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/whatsapp/logs", requireAdmin, async (req, res) => res.json(await allWhatsappLogs()));

app.get("/whatsapp/status", requireAdmin, async (req, res) => {
  const appSettings = await getSettings();
  res.json({
    success: true,
    tokenConfigured: Boolean(process.env.WHATSAPP_TOKEN),
    phoneNumberIdConfigured: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID),
    apiVersion: process.env.WHATSAPP_API_VERSION || "v25.0",
    recipientConfigured: Boolean(appSettings.adminWhatsAppNumber || appSettings.reportPhone),
    autoReport: Boolean(appSettings.autoReport),
    reportTime: appSettings.reportTime || "22:00",
    reportType: appSettings.reportType || "daily"
  });
});

app.get("/api/cron/whatsapp", async (req, res) => {
  res.json(await checkScheduledWhatsAppReport());
});

io.on("connection", () => {
  console.log("Admin/Mobile connected");
});

async function initializeApp(options = {}) {
  const scheduler = options.scheduler !== false;
  if (!initialized) {
    await connectDatabase();
    initialized = true;
  }
  if (scheduler && !schedulerStarted && process.env.VERCEL !== "1") {
    schedulerStarted = true;
    setInterval(checkScheduledWhatsAppReport, 60 * 1000);
    console.log(`WhatsApp report scheduler running in ${INDIA_TZ} timezone`);
  }
  return app;
}

if (require.main === module) {
  initializeApp({ scheduler: true }).finally(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Axzen Hospitality Backend running on http://localhost:${PORT}`);
    });
  });
}

module.exports = {
  app,
  initializeApp,
  checkScheduledWhatsAppReport,
  handleWhatsAppWebhook,
  registerWhatsAppWebhookRoutes
};
