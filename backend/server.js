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
const DEFAULT_CANTEEN_ID = "AXC-0001";
const DEFAULT_ADMIN_PASSWORD = "Axzen@123";

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

const staticPageOptions = {
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-store, max-age=0");
    }
  }
};

app.use("/mobile", express.static(path.join(__dirname, "../sa"), staticPageOptions));
app.use("/admin", express.static(path.join(__dirname, "../admin-web"), staticPageOptions));
app.use("/marketing", express.static(path.join(__dirname, "../marketing-web"), staticPageOptions));

const defaultMenuItems = [
  { id: 1, name: "Tea", price: 10, category: "Tea", image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=500&q=80" },
  { id: 2, name: "Coffee", price: 20, category: "Tea", image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=500&q=80" },
  { id: 3, name: "Meals", price: 80, category: "Meals", image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=500&q=80" },
  { id: 4, name: "Idly", price: 30, category: "Tiffin", image: "https://images.unsplash.com/photo-1630409351241-e90e7f5e434d?auto=format&fit=crop&w=500&q=80", subItems: [{ name: "Single", price: 15 }, { name: "Half Plate", price: 30 }, { name: "Full Plate", price: 50 }] },
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
  brandName: "axzen",
  tagline: "Infotech",
  logoUrl: "",
  reportTime: "22:00",
  adminWhatsAppNumber: "",
  reportPhone: "",
  autoReport: false,
  reportType: "daily"
};

const defaultMarketingUsers = [
  { employeeId: "MKT001", name: "Venkatesh", password: "1234", role: "marketing", active: true, target: 20 },
  { employeeId: "MKT002", name: "Sravani", password: "1234", role: "marketing", active: true, target: 18 },
  { employeeId: "SUPER", name: "Super Admin", password: "admin123", role: "super_admin", active: true, target: 0 }
];

const defaultMarketingCanteens = [
  {
    id: 1001,
    canteenName: "Sri Lakshmi Foods",
    ownerName: "Ramesh Kumar",
    ownerMobile: "9876543210",
    alternateMobile: "9876500001",
    address: "Madhapur Main Road",
    city: "Hyderabad",
    state: "Telangana",
    counters: 2,
    printersRequired: 2,
    selectedPlan: "Professional",
    planType: "Paid",
    planStartDate: new Date().toISOString().slice(0, 10),
    planExpiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    paymentMode: "UPI",
    paidAmount: 12000,
    pendingAmount: 3000,
    notes: "Needs two thermal printers and menu setup.",
    documents: "trade-license.jpg",
    status: "Pending Approval",
    online: true,
    submittedBy: "MKT001",
    submittedByName: "Venkatesh",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 1002,
    canteenName: "Metro Staff Canteen",
    ownerName: "Kiran",
    ownerMobile: "9000011111",
    alternateMobile: "",
    address: "Industrial Area",
    city: "Vijayawada",
    state: "Andhra Pradesh",
    counters: 4,
    printersRequired: 4,
    selectedPlan: "Enterprise",
    planType: "Paid",
    planStartDate: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10),
    planExpiryDate: new Date(Date.now() + 345 * 86400000).toISOString().slice(0, 10),
    paymentMode: "Bank Transfer",
    paidAmount: 30000,
    pendingAmount: 0,
    notes: "Approved pilot customer.",
    documents: "agreement.pdf",
    status: "Active",
    online: true,
    activatedCanteenId: "AXC-1002",
    canteenLoginId: "AXC1002",
    defaultPassword: "AXZEN1002",
    submittedBy: "MKT002",
    submittedByName: "Sravani",
    approvedBy: "SUPER",
    approvedAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 18 * 86400000).toISOString()
  }
];

const defaultMarketingPayments = defaultMarketingCanteens
  .filter(item => Number(item.paidAmount || 0) > 0)
  .map(item => ({
    id: item.id,
    canteenId: item.id,
    canteenName: item.canteenName,
    amount: Number(item.paidAmount || 0),
    pendingAmount: Number(item.pendingAmount || 0),
    paymentMode: item.paymentMode,
    collectedBy: item.submittedBy,
    collectedByName: item.submittedByName,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }));

const defaultMarketingSupportTickets = [
  { id: 1, title: "Printer pairing help", status: "Open", canteenName: "Metro Staff Canteen", priority: "High", createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 2, title: "Plan upgrade request", status: "Open", canteenName: "Sri Lakshmi Foods", priority: "Medium", createdAt: new Date().toISOString() }
];

let mongoReady = false;
let mongoError = "";
let initialized = false;
let schedulerStarted = false;
let lastScheduledReportKey = "";

let memory = {
  canteens: [{
    canteenId: DEFAULT_CANTEEN_ID,
    name: "Main Canteen",
    ownerName: "Admin",
    phone: "admin",
    address: "",
    plan: "default",
    paymentStatus: "paid",
    active: true
  }],
  printers: [],
  menuItems: [...defaultMenuItems],
  stockItems: [...defaultStockItems],
  creditors: [],
  expenses: [],
  orders: [],
  sales: [],
  users: [...defaultUsers],
  settings: { ...defaultSettings },
  whatsappLogs: [],
  marketingUsers: [...defaultMarketingUsers],
  marketingCanteens: [...defaultMarketingCanteens],
  marketingActivities: [
    { id: 1, type: "approved", text: "Metro Staff Canteen approved by Super Admin", actor: "Super Admin", createdAt: new Date(Date.now() - 18 * 86400000).toISOString() },
    { id: 2, type: "created", text: "Sri Lakshmi Foods submitted for approval", actor: "Venkatesh", createdAt: new Date().toISOString() }
  ],
  marketingPayments: [...defaultMarketingPayments],
  supportTickets: [...defaultMarketingSupportTickets]
};

const orderSchema = new mongoose.Schema({
  canteenId: { type: String, index: true, default: DEFAULT_CANTEEN_ID },
  id: { type: Number, index: true },
  clientOrderId: { type: String, sparse: true, index: true },
  time: String,
  canteen: String,
  cashier: String,
  payment: String,
  paymentBreakup: mongoose.Schema.Types.Mixed,
  creditName: String,
  subtotal: Number,
  discount: Number,
  total: Number,
  items: [{ id: Number, lineId: String, parentId: Number, name: String, optionName: String, price: Number, qty: Number }],
  syncedAt: String
}, { timestamps: true, collection: "orders" });

const saleSchema = new mongoose.Schema({
  canteenId: { type: String, index: true, default: DEFAULT_CANTEEN_ID },
  orderId: Number,
  clientOrderId: { type: String, sparse: true, index: true },
  time: String,
  canteen: String,
  cashier: String,
  payment: String,
  paymentBreakup: mongoose.Schema.Types.Mixed,
  creditName: String,
  subtotal: Number,
  discount: Number,
  total: Number,
  items: [{ id: Number, lineId: String, parentId: Number, name: String, optionName: String, price: Number, qty: Number }],
  syncedAt: String
}, { timestamps: true, collection: "sales" });

const userSchema = new mongoose.Schema({
  canteenId: { type: String, index: true, default: DEFAULT_CANTEEN_ID },
  id: Number,
  name: String,
  mobile: { type: String, index: true },
  password: String,
  role: { type: String, enum: ["admin", "user"], default: "user" },
  active: { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: false }
}, { timestamps: true, collection: "users" });

const menuItemSchema = new mongoose.Schema({
  canteenId: { type: String, index: true, default: DEFAULT_CANTEEN_ID },
  id: { type: Number, sparse: true, index: true },
  name: String,
  price: Number,
  category: String,
  image: String,
  subItems: [{ name: String, price: Number }],
  sortOrder: Number,
  hidden: { type: Boolean, default: false }
}, { timestamps: true, collection: "menu_items" });

const creditorSchema = new mongoose.Schema({
  canteenId: { type: String, index: true, default: DEFAULT_CANTEEN_ID },
  id: { type: Number, sparse: true, index: true },
  name: String,
  phone: String,
  address: String,
  reason: String,
  active: { type: Boolean, default: true }
}, { timestamps: true, collection: "creditors" });

const stockItemSchema = new mongoose.Schema({
  canteenId: { type: String, index: true, default: DEFAULT_CANTEEN_ID },
  id: { type: Number, sparse: true, index: true },
  item: String,
  stock: Number,
  unit: String,
  minStock: Number
}, { timestamps: true, collection: "stock_items" });

const expenseSchema = new mongoose.Schema({
  canteenId: { type: String, index: true, default: DEFAULT_CANTEEN_ID },
  id: { type: Number, sparse: true, index: true },
  title: String,
  amount: Number,
  category: String,
  time: String
}, { timestamps: true, collection: "expenses" });

const reportSettingSchema = new mongoose.Schema({
  canteenId: { type: String, index: true, default: DEFAULT_CANTEEN_ID },
  key: { type: String, index: true, default: "app" },
  canteenName: String,
  brandName: String,
  tagline: String,
  logoUrl: String,
  reportTime: String,
  adminWhatsAppNumber: String,
  reportPhone: String,
  autoReport: Boolean,
  reportType: String
}, { timestamps: true, collection: "report_settings" });

const canteenSchema = new mongoose.Schema({
  canteenId: { type: String, unique: true, index: true },
  name: String,
  ownerName: String,
  phone: String,
  address: String,
  plan: String,
  paymentStatus: String,
  paymentReference: String,
  active: { type: Boolean, default: true },
  createdByMarketingUser: String
}, { timestamps: true, collection: "canteens" });

const printerSchema = new mongoose.Schema({
  canteenId: { type: String, index: true },
  provider: String,
  model: String,
  serialNumber: String,
  bluetoothName: String,
  macAddress: String,
  status: { type: String, default: "Stock", index: true },
  allottedTo: String,
  allottedToName: String,
  marketingCanteenId: Number,
  marketingCanteenName: String,
  installedBy: String,
  installedAt: String
}, { timestamps: true, collection: "printers" });

const marketingUserSchema = new mongoose.Schema({
  employeeId: { type: String, unique: true, index: true },
  name: String,
  mobile: String,
  aadhaarNumber: String,
  panNumber: String,
  password: String,
  role: { type: String, enum: ["marketing", "super_admin"], default: "marketing" },
  active: { type: Boolean, default: true },
  target: Number
}, { timestamps: true, collection: "marketing_users" });

const marketingCanteenSchema = new mongoose.Schema({
  id: { type: Number, index: true },
  canteenName: String,
  ownerName: String,
  ownerMobile: String,
  alternateMobile: String,
  address: String,
  city: String,
  state: String,
  counters: Number,
  printersRequired: Number,
  printerModel: String,
  printerSerialNumber: String,
  selectedPlan: String,
  planType: String,
  planStartDate: String,
  planExpiryDate: String,
  paymentMode: String,
  paidAmount: Number,
  pendingAmount: Number,
  notes: String,
  documents: String,
  status: { type: String, index: true },
  rejectionReason: String,
  activatedCanteenId: String,
  canteenLoginId: String,
  defaultPassword: String,
  online: Boolean,
  lastSeenAt: String,
  blocked: Boolean,
  printersAssigned: Number,
  submittedBy: { type: String, index: true },
  submittedByName: String,
  approvedBy: String,
  approvedAt: String
}, { timestamps: true, collection: "marketing_canteens" });

const marketingActivitySchema = new mongoose.Schema({
  id: Number,
  type: String,
  text: String,
  actor: String,
  canteenId: Number,
  createdAt: String
}, { timestamps: true, collection: "marketing_activities" });

const marketingPaymentSchema = new mongoose.Schema({
  id: Number,
  canteenId: { type: Number, index: true },
  canteenName: String,
  amount: Number,
  pendingAmount: Number,
  paymentMode: String,
  collectedBy: String,
  collectedByName: String
}, { timestamps: true, collection: "marketing_payments" });

const marketingSupportTicketSchema = new mongoose.Schema({
  id: Number,
  title: String,
  status: { type: String, index: true },
  canteenName: String,
  priority: String
}, { timestamps: true, collection: "marketing_support_tickets" });

const whatsappLogSchema = new mongoose.Schema({
  time: String,
  success: Boolean,
  reason: String,
  to: String,
  message: String,
  error: String,
  meta: mongoose.Schema.Types.Mixed
}, { timestamps: true, collection: "whatsapp_logs" });

userSchema.index({ canteenId: 1, mobile: 1 }, { unique: true, name: "canteenId_1_mobile_1" });
orderSchema.index(
  { canteenId: 1, clientOrderId: 1 },
  { unique: true, name: "canteenId_1_clientOrderId_1", partialFilterExpression: { clientOrderId: { $type: "string" } } }
);
saleSchema.index(
  { canteenId: 1, clientOrderId: 1 },
  { unique: true, name: "canteenId_1_clientOrderId_1", partialFilterExpression: { clientOrderId: { $type: "string" } } }
);
reportSettingSchema.index({ canteenId: 1, key: 1 }, { unique: true, name: "canteenId_1_key_1" });
menuItemSchema.index({ canteenId: 1, id: 1 }, { unique: true, name: "canteenId_1_id_1" });
creditorSchema.index({ canteenId: 1, id: 1 }, { unique: true, name: "canteenId_1_id_1" });
stockItemSchema.index({ canteenId: 1, id: 1 }, { unique: true, name: "canteenId_1_id_1" });
expenseSchema.index({ canteenId: 1, id: 1 }, { unique: true, name: "canteenId_1_id_1" });

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
const Sale = mongoose.models.Sale || mongoose.model("Sale", saleSchema);
const User = mongoose.models.User || mongoose.model("User", userSchema);
const MenuItem = mongoose.models.MenuItem || mongoose.model("MenuItem", menuItemSchema);
const Creditor = mongoose.models.Creditor || mongoose.model("Creditor", creditorSchema);
const StockItem = mongoose.models.StockItem || mongoose.model("StockItem", stockItemSchema);
const Expense = mongoose.models.Expense || mongoose.model("Expense", expenseSchema);
const ReportSetting = mongoose.models.ReportSetting || mongoose.model("ReportSetting", reportSettingSchema);
const Canteen = mongoose.models.Canteen || mongoose.model("Canteen", canteenSchema);
const Printer = mongoose.models.Printer || mongoose.model("Printer", printerSchema);
const MarketingUser = mongoose.models.MarketingUser || mongoose.model("MarketingUser", marketingUserSchema);
const MarketingCanteen = mongoose.models.MarketingCanteen || mongoose.model("MarketingCanteen", marketingCanteenSchema);
const MarketingActivity = mongoose.models.MarketingActivity || mongoose.model("MarketingActivity", marketingActivitySchema);
const MarketingPayment = mongoose.models.MarketingPayment || mongoose.model("MarketingPayment", marketingPaymentSchema);
const MarketingSupportTicket = mongoose.models.MarketingSupportTicket || mongoose.model("MarketingSupportTicket", marketingSupportTicketSchema);
const WhatsappLog = mongoose.models.WhatsappLog || mongoose.model("WhatsappLog", whatsappLogSchema);

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id || item.orderId || 0)), 0) + 1;
}

function normalizeMobile(value) {
  return String(value || "").trim();
}

function normalizeCanteenId(value) {
  return String(value || "").trim().toUpperCase();
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: String(user._id || user.id || user.mobile),
    name: user.name,
    mobile: user.mobile,
    role: user.role,
    active: user.active !== false,
    canteenId: user.canteenId || DEFAULT_CANTEEN_ID,
    mustChangePassword: user.mustChangePassword === true
  };
}

function signToken(user) {
  const payload = { ...publicUser(user), authType: "canteen" };
  if (!process.env.JWT_SECRET) {
    return `local.${encodeLocalToken({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })}`;
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function encodeLocalToken(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeLocalToken(token) {
  return JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
}

function publicMarketingUser(user) {
  if (!user) return null;
  return {
    id: String(user._id || user.employeeId),
    employeeId: user.employeeId,
    name: user.name,
    mobile: user.mobile || "",
    aadhaarNumber: user.aadhaarNumber || "",
    panNumber: user.panNumber || "",
    role: user.role,
    active: user.active !== false,
    target: Number(user.target || 0)
  };
}

function signMarketingToken(user) {
  const payload = { ...publicMarketingUser(user), authType: "marketing" };
  if (!process.env.JWT_SECRET) {
    return `local.${encodeLocalToken({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })}`;
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function requireMarketingAuth(req, res, next) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ success: false, message: "Login token missing" });
  try {
    const user = process.env.JWT_SECRET
      ? jwt.verify(token, process.env.JWT_SECRET)
      : decodeLocalToken(token.replace(/^local\./, ""));
    if (user.authType !== "marketing") return res.status(401).json({ success: false, message: "Invalid marketing token" });
    if (!process.env.JWT_SECRET && Number(user.exp || 0) < Date.now()) {
      return res.status(401).json({ success: false, message: "Invalid or expired login token" });
    }
    req.marketingUser = user;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired login token" });
  }
}

function requireSuperAdmin(req, res, next) {
  return requireMarketingAuth(req, res, () => {
    if (req.marketingUser.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Super admin access required" });
    }
    return next();
  });
}

function canteenUserFromRequest(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const user = process.env.JWT_SECRET
      ? jwt.verify(token, process.env.JWT_SECRET)
      : decodeLocalToken(token.replace(/^local\./, ""));
    if (user.authType !== "canteen") return null;
    if (!process.env.JWT_SECRET && Number(user.exp || 0) < Date.now()) return null;
    return user;
  } catch {
    return null;
  }
}

async function canteenCanLogin(canteenId) {
  const targetCanteenId = normalizeCanteenId(canteenId || DEFAULT_CANTEEN_ID);
  if (!targetCanteenId) return false;
  if (!mongoReady) return false;

  const core = await Canteen.findOne({ canteenId: targetCanteenId }).lean();
  if (core && core.active === false) return false;

  const marketing = await MarketingCanteen.findOne({ activatedCanteenId: targetCanteenId }).lean();
  if (!marketing) return Boolean(core) || targetCanteenId === DEFAULT_CANTEEN_ID;
  if (marketing.blocked || marketing.status === "Blocked" || marketing.status === "Rejected" || marketing.status === "Expired") {
    return false;
  }
  return ["Active", "Trial"].includes(marketing.status) || Boolean(marketing.canteenLoginId);
}

async function tokenUserIsCurrent(user) {
  if (!user || !mongoReady) return false;
  const canteenId = normalizeCanteenId(user.canteenId || DEFAULT_CANTEEN_ID);
  const current = await User.findOne({ canteenId, mobile: normalizeMobile(user.mobile), active: { $ne: false } }).lean();
  if (!current) return false;
  if (current.role !== user.role) return false;
  return canteenCanLogin(canteenId);
}

async function markCanteenSeen(canteenId) {
  const targetCanteenId = normalizeCanteenId(canteenId || DEFAULT_CANTEEN_ID);
  const seen = new Date().toISOString();
  if (!mongoReady) {
    const item = memory.marketingCanteens.find(row => normalizeCanteenId(row.activatedCanteenId) === targetCanteenId);
    if (item) { item.online = true; item.lastSeenAt = seen; }
    return;
  }
  await MarketingCanteen.findOneAndUpdate({ activatedCanteenId: targetCanteenId }, { $set: { online: true, lastSeenAt: seen } });
}

function decodeCanteenAuthToken(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Login token missing" };
  try {
    const user = process.env.JWT_SECRET
      ? jwt.verify(token, process.env.JWT_SECRET)
      : decodeLocalToken(token.replace(/^local\./, ""));
    if (user.authType !== "canteen") return { error: "Invalid canteen token" };
    if (!process.env.JWT_SECRET && Number(user.exp || 0) < Date.now()) {
      return { error: "Invalid or expired login token" };
    }
    return { user };
  } catch {
    return { error: "Invalid or expired login token" };
  }
}

async function requireAdmin(req, res, next) {
  const decoded = decodeCanteenAuthToken(req);
  if (decoded.error) return res.status(401).json({ success: false, message: decoded.error });
  try {
    req.authUser = decoded.user;
    if (req.authUser.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }
    if (!await tokenUserIsCurrent(req.authUser)) {
      return res.status(403).json({ success: false, message: "Canteen access is inactive or blocked" });
    }
    markCanteenSeen(req.authUser.canteenId).catch(() => {});
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired login token" });
  }
}

async function requireCanteenAuth(req, res, next) {
  const decoded = decodeCanteenAuthToken(req);
  if (decoded.error) return res.status(401).json({ success: false, message: decoded.error });
  try {
    req.authUser = decoded.user;
    if (!["admin", "user"].includes(req.authUser.role)) {
      return res.status(403).json({ success: false, message: "Canteen user access required" });
    }
    if (!await tokenUserIsCurrent(req.authUser)) {
      return res.status(403).json({ success: false, message: "Canteen access is inactive or blocked" });
    }
    markCanteenSeen(req.authUser.canteenId).catch(() => {});
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired login token" });
  }
}

function requireDatabase(req, res, next) {
  if (!mongoReady) {
    return res.status(503).json({
      success: false,
      message: "Database not connected. Data was not saved. Please check MongoDB connection."
    });
  }
  return next();
}

async function seedDefaults() {
  for (const user of defaultUsers) {
    await User.findOneAndUpdate(
      { canteenId: user.canteenId || DEFAULT_CANTEEN_ID, mobile: user.mobile },
      { $setOnInsert: { ...user, canteenId: user.canteenId || DEFAULT_CANTEEN_ID } },
      { upsert: true }
    );
  }
  if (!await MenuItem.countDocuments()) await MenuItem.insertMany(defaultMenuItems);
  if (!await StockItem.countDocuments()) await StockItem.insertMany(defaultStockItems);
  await ReportSetting.findOneAndUpdate(
    { key: "app", canteenId: DEFAULT_CANTEEN_ID },
    { $setOnInsert: { ...defaultSettings, canteenId: DEFAULT_CANTEEN_ID } },
    { upsert: true }
  );
  for (const user of defaultMarketingUsers) {
    await MarketingUser.findOneAndUpdate(
      { employeeId: user.employeeId },
      { $setOnInsert: user },
      { upsert: true }
    );
  }
  if (!await MarketingCanteen.countDocuments()) await MarketingCanteen.insertMany(defaultMarketingCanteens);
  if (!await MarketingActivity.countDocuments()) await MarketingActivity.insertMany(memory.marketingActivities);
  if (!await MarketingPayment.countDocuments()) await MarketingPayment.insertMany(defaultMarketingPayments);
  if (!await MarketingSupportTicket.countDocuments()) await MarketingSupportTicket.insertMany(defaultMarketingSupportTickets);
  await reconcileApprovedCanteens();
}

async function dropIndexIfExists(collection, name) {
  try {
    const indexes = await collection.indexes();
    if (indexes.some(index => index.name === name)) {
      await collection.dropIndex(name);
    }
  } catch (error) {
    if (error.codeName !== "IndexNotFound") throw error;
  }
}

async function ensureDatabaseIndexes() {
  await dropIndexIfExists(User.collection, "mobile_1");
  await User.collection.createIndex(
    { canteenId: 1, mobile: 1 },
    { unique: true, name: "canteenId_1_mobile_1" }
  );

  await dropIndexIfExists(Order.collection, "clientOrderId_1");
  await Order.collection.createIndex(
    { canteenId: 1, clientOrderId: 1 },
    {
      unique: true,
      name: "canteenId_1_clientOrderId_1",
      partialFilterExpression: { clientOrderId: { $type: "string" } }
    }
  );

  await dropIndexIfExists(Sale.collection, "clientOrderId_1");
  await Sale.collection.createIndex(
    { canteenId: 1, clientOrderId: 1 },
    {
      unique: true,
      name: "canteenId_1_clientOrderId_1",
      partialFilterExpression: { clientOrderId: { $type: "string" } }
    }
  );

  await dropIndexIfExists(ReportSetting.collection, "key_1");
  await ReportSetting.collection.createIndex(
    { canteenId: 1, key: 1 },
    { unique: true, name: "canteenId_1_key_1" }
  );

  for (const collection of [MenuItem.collection, Creditor.collection, StockItem.collection, Expense.collection]) {
    await dropIndexIfExists(collection, "id_1");
    await collection.createIndex(
      { canteenId: 1, id: 1 },
      { unique: true, name: "canteenId_1_id_1" }
    );
  }
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
    await ensureDatabaseIndexes();
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

async function allMenuItems(canteenId = DEFAULT_CANTEEN_ID, options = {}) {
  const targetCanteenId = normalizeCanteenId(canteenId || DEFAULT_CANTEEN_ID);
  const byOrder = (a, b) => Number(a.sortOrder ?? a.id ?? 0) - Number(b.sortOrder ?? b.id ?? 0);
  const includeHidden = options.includeHidden === true;
  if (!mongoReady) {
    return memory.menuItems
      .filter(item => normalizeCanteenId(item.canteenId || DEFAULT_CANTEEN_ID) === targetCanteenId)
      .filter(item => includeHidden || item.hidden !== true)
      .sort(byOrder);
  }
  const query = includeHidden ? { canteenId: targetCanteenId } : { canteenId: targetCanteenId, hidden: { $ne: true } };
  return (await MenuItem.find(query).lean()).sort(byOrder);
}

function normalizeSubItems(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => ({
        name: String(item && item.name || "").trim(),
        price: Number(item && item.price || 0)
      }))
      .filter(item => item.name && item.price >= 0);
  }

  return String(value || "")
    .split(/\r?\n/)
    .map(line => {
      const [name, price] = line.split(":");
      return { name: String(name || "").trim(), price: Number(price || 0) };
    })
    .filter(item => item.name && item.price >= 0);
}

async function saveMenuItem(payload) {
  const canteenId = normalizeCanteenId(payload.canteenId || DEFAULT_CANTEEN_ID);
  const current = await allMenuItems(canteenId, { includeHidden: true });
  const item = {
    id: payload.id ? Number(payload.id) : nextId(current),
    canteenId,
    name: String(payload.name || "").trim(),
    price: Number(payload.price || 0),
    category: payload.category || "Snacks",
    image: payload.image || "",
    subItems: normalizeSubItems(payload.subItems),
    sortOrder: payload.sortOrder !== undefined && payload.sortOrder !== "" ? Number(payload.sortOrder) : Number(payload.id || nextId(current)),
    hidden: payload.hidden === true || payload.hidden === "true"
  };

  if (!item.name) throw new Error("Product name is required");

  if (!mongoReady) {
    const existing = memory.menuItems.find(row =>
      normalizeCanteenId(row.canteenId || DEFAULT_CANTEEN_ID) === canteenId &&
      Number(row.id) === Number(item.id)
    );
    if (existing) Object.assign(existing, item);
    else memory.menuItems.push(item);
    return item;
  }

  return modelToPlain(await MenuItem.findOneAndUpdate(
    { canteenId, id: item.id },
    { $set: item },
    { new: true, upsert: true }
  ));
}

async function deleteMenuItem(id, canteenId = DEFAULT_CANTEEN_ID) {
  const targetCanteenId = normalizeCanteenId(canteenId || DEFAULT_CANTEEN_ID);
  if (!mongoReady) {
    memory.menuItems = memory.menuItems.filter(item =>
      normalizeCanteenId(item.canteenId || DEFAULT_CANTEEN_ID) !== targetCanteenId ||
      Number(item.id) !== Number(id)
    );
    return;
  }
  await MenuItem.deleteOne({ canteenId: targetCanteenId, id: Number(id) });
}

async function allCreditors(canteenId = DEFAULT_CANTEEN_ID) {
  const targetCanteenId = normalizeCanteenId(canteenId || DEFAULT_CANTEEN_ID);
  const byName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""));
  if (!mongoReady) {
    return memory.creditors
      .filter(item => normalizeCanteenId(item.canteenId || DEFAULT_CANTEEN_ID) === targetCanteenId)
      .filter(item => item.active !== false)
      .sort(byName);
  }
  return (await Creditor.find({ canteenId: targetCanteenId, active: { $ne: false } }).lean()).sort(byName);
}

async function saveCreditor(payload) {
  const canteenId = normalizeCanteenId(payload.canteenId || DEFAULT_CANTEEN_ID);
  const current = await allCreditors(canteenId);
  const creditor = {
    id: payload.id ? Number(payload.id) : nextId(current),
    canteenId,
    name: String(payload.name || "").trim(),
    phone: String(payload.phone || "").trim(),
    address: String(payload.address || "").trim(),
    reason: String(payload.reason || "").trim(),
    active: payload.active !== false
  };

  if (!creditor.name) throw new Error("Creditor name is required");

  if (!mongoReady) {
    const existing = memory.creditors.find(row =>
      normalizeCanteenId(row.canteenId || DEFAULT_CANTEEN_ID) === canteenId &&
      Number(row.id) === Number(creditor.id)
    );
    if (existing) Object.assign(existing, creditor);
    else memory.creditors.push(creditor);
    return creditor;
  }

  return modelToPlain(await Creditor.findOneAndUpdate(
    { canteenId, id: creditor.id },
    { $set: creditor },
    { new: true, upsert: true }
  ));
}

async function seedCanteenDefaults(canteenId, canteenName = "Main Canteen") {
  const targetCanteenId = normalizeCanteenId(canteenId || DEFAULT_CANTEEN_ID);
  if (!(await allMenuItems(targetCanteenId, { includeHidden: true })).length) {
    for (const item of defaultMenuItems) {
      await saveMenuItem({ ...item, canteenId: targetCanteenId });
    }
  }
  if (!(await allStockItems(targetCanteenId)).length) {
    for (const item of defaultStockItems) {
      await saveStockItem({ ...item, canteenId: targetCanteenId });
    }
  }
  await saveSettings({ ...defaultSettings, canteenName }, targetCanteenId);
}

async function allStockItems(canteenId = DEFAULT_CANTEEN_ID) {
  const targetCanteenId = normalizeCanteenId(canteenId || DEFAULT_CANTEEN_ID);
  if (!mongoReady) return memory.stockItems.filter(item => normalizeCanteenId(item.canteenId || DEFAULT_CANTEEN_ID) === targetCanteenId);
  return StockItem.find({ canteenId: targetCanteenId }).sort({ id: 1, createdAt: 1 }).lean();
}

async function saveStockItem(payload) {
  const canteenId = normalizeCanteenId(payload.canteenId || DEFAULT_CANTEEN_ID);
  const current = await allStockItems(canteenId);
  const item = {
    id: payload.id ? Number(payload.id) : nextId(current),
    canteenId,
    item: String(payload.item || "").trim(),
    stock: Number(payload.stock || 0),
    unit: payload.unit || "Unit",
    minStock: Number(payload.minStock || 0)
  };

  if (!item.item) throw new Error("Stock item is required");

  if (!mongoReady) {
    const existing = memory.stockItems.find(row =>
      normalizeCanteenId(row.canteenId || DEFAULT_CANTEEN_ID) === canteenId &&
      Number(row.id) === Number(item.id)
    );
    if (existing) Object.assign(existing, item);
    else memory.stockItems.push(item);
    return item;
  }

  return modelToPlain(await StockItem.findOneAndUpdate(
    { canteenId, id: item.id },
    { $set: item },
    { new: true, upsert: true }
  ));
}

async function allExpenses(canteenId = DEFAULT_CANTEEN_ID) {
  const targetCanteenId = normalizeCanteenId(canteenId || DEFAULT_CANTEEN_ID);
  if (!mongoReady) return memory.expenses.filter(item => normalizeCanteenId(item.canteenId || DEFAULT_CANTEEN_ID) === targetCanteenId);
  return Expense.find({ canteenId: targetCanteenId }).sort({ createdAt: 1 }).lean();
}

async function saveExpense(payload) {
  const canteenId = normalizeCanteenId(payload.canteenId || DEFAULT_CANTEEN_ID);
  const current = await allExpenses(canteenId);
  const expense = {
    id: payload.id ? Number(payload.id) : nextId(current),
    canteenId,
    title: String(payload.title || "").trim(),
    amount: Number(payload.amount || 0),
    category: payload.category || "General",
    time: payload.time || new Date().toLocaleString("en-IN", { timeZone: INDIA_TZ })
  };

  if (!expense.title) throw new Error("Expense title is required");

  if (!mongoReady) {
    const existing = memory.expenses.find(row =>
      normalizeCanteenId(row.canteenId || DEFAULT_CANTEEN_ID) === canteenId &&
      Number(row.id) === Number(expense.id)
    );
    if (existing) Object.assign(existing, expense);
    else memory.expenses.push(expense);
    return expense;
  }

  return modelToPlain(await Expense.findOneAndUpdate(
    { canteenId, id: expense.id },
    { $set: expense },
    { new: true, upsert: true }
  ));
}

async function getSettings(canteenId = DEFAULT_CANTEEN_ID) {
  const targetCanteenId = normalizeCanteenId(canteenId || DEFAULT_CANTEEN_ID);
  if (!mongoReady) {
    return { ...defaultSettings, ...memory.settings, canteenId: targetCanteenId };
  }
  const stored = await ReportSetting.findOne({ key: "app", canteenId: targetCanteenId }).lean();
  const legacy = !stored && targetCanteenId === DEFAULT_CANTEEN_ID
    ? await ReportSetting.findOne({ key: "app", canteenId: { $exists: false } }).lean()
    : null;
  return { ...defaultSettings, canteenId: targetCanteenId, ...(stored || legacy || {}) };
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

async function saveSettings(payload, canteenId = DEFAULT_CANTEEN_ID) {
  const targetCanteenId = normalizeCanteenId(canteenId || payload.canteenId || DEFAULT_CANTEEN_ID);
  const next = { ...payload };
  if (Object.prototype.hasOwnProperty.call(next, "autoReport")) {
    next.autoReport = next.autoReport === true || next.autoReport === "true";
  }
  if (next.reportTime) next.reportTime = parseReportTime(next.reportTime);
  if (next.adminWhatsAppNumber) next.reportPhone = next.adminWhatsAppNumber;
  if (next.reportPhone && !next.adminWhatsAppNumber) next.adminWhatsAppNumber = next.reportPhone;

  if (!mongoReady) {
    memory.settings = { ...memory.settings, ...next, canteenId: targetCanteenId };
    return memory.settings;
  }

  const saved = await ReportSetting.findOneAndUpdate(
    { key: "app", canteenId: targetCanteenId },
    { $set: { ...next, key: "app", canteenId: targetCanteenId } },
    { new: true, upsert: true }
  ).lean();
  return { ...defaultSettings, ...saved, canteenId: targetCanteenId };
}

async function allUsers() {
  if (!mongoReady) return memory.users;
  return User.find({}).sort({ createdAt: 1 }).lean();
}

async function saveUser(payload) {
  const user = {
    id: payload.id ? Number(payload.id) : nextId(await allUsers()),
    canteenId: normalizeCanteenId(payload.canteenId || DEFAULT_CANTEEN_ID),
    name: payload.name || "User",
    mobile: normalizeMobile(payload.mobile),
    password: String(payload.password || "1234"),
    role: payload.role === "admin" ? "admin" : "user",
    active: payload.active !== false,
    mustChangePassword: payload.mustChangePassword === true
  };

  if (!user.mobile) throw new Error("Mobile is required");

  if (!mongoReady) {
    const existing = memory.users.find(row =>
      normalizeCanteenId(row.canteenId || DEFAULT_CANTEEN_ID) === user.canteenId &&
      row.mobile === user.mobile
    );
    if (existing) Object.assign(existing, user);
    else memory.users.push(user);
    return user;
  }

  return modelToPlain(await User.findOneAndUpdate(
    { canteenId: user.canteenId, mobile: user.mobile },
    { $set: user },
    { new: true, upsert: true }
  ));
}

async function deleteUser(mobile, canteenId = DEFAULT_CANTEEN_ID) {
  const targetCanteenId = normalizeCanteenId(canteenId || DEFAULT_CANTEEN_ID);
  if (!mongoReady) {
    memory.users = memory.users.filter(user =>
      normalizeCanteenId(user.canteenId || DEFAULT_CANTEEN_ID) !== targetCanteenId ||
      user.mobile !== mobile
    );
    return;
  }
  await User.deleteOne({ canteenId: targetCanteenId, mobile });
}

function makeOrder(payload) {
  const total = Number(payload.total || 0);
  const paymentBreakup = normalizePaymentBreakup(payload.paymentBreakup, payload.payment, total);
  return {
    canteenId: normalizeCanteenId(payload.canteenId || DEFAULT_CANTEEN_ID),
    id: payload.id || Date.now(),
    clientOrderId: payload.clientOrderId,
    time: payload.time || new Date().toLocaleString("en-IN", { timeZone: INDIA_TZ }),
    canteen: payload.canteen || "Main Canteen",
    cashier: payload.cashier || "Mobile Cashier",
    payment: payload.payment || "Cash",
    paymentBreakup,
    creditName: payload.creditName || "",
    subtotal: Number(payload.subtotal || total),
    discount: Number(payload.discount || 0),
    total,
    items: Array.isArray(payload.items) ? payload.items : [],
    syncedAt: new Date().toISOString()
  };
}

function normalizePaymentBreakup(value, payment, total) {
  const source = value && typeof value === "object" ? value : {};
  if (payment === "Split") {
    let cash = Math.max(0, Number(source.cash || 0));
    let online = Math.max(0, Number(source.online || 0));
    let credit = Math.max(0, Number(source.credit || 0));
    const splitTotal = cash + online + credit;
    if (total >= 0 && Math.round(splitTotal * 100) !== Math.round(total * 100)) {
      cash = Math.min(cash, total);
      credit = Math.min(credit, Math.max(0, total - cash));
      online = Math.max(0, total - cash - credit);
    }
    return { cash, online, credit };
  }
  if (payment === "Online") return { cash: 0, online: total, credit: 0 };
  if (payment === "Credit") return { cash: 0, online: 0, credit: total };
  if (payment === "Cancel") return { cash: 0, online: 0, credit: 0 };
  return { cash: total, online: 0, credit: 0 };
}

async function saveOrder(payload) {
  const order = makeOrder(payload);

  if (!mongoReady) {
    const exists = memory.orders.find(row =>
      normalizeCanteenId(row.canteenId || DEFAULT_CANTEEN_ID) === order.canteenId &&
      ((order.clientOrderId && row.clientOrderId === order.clientOrderId) || Number(row.id) === Number(order.id))
    );
    if (exists) return exists;
    memory.orders.push(order);
    memory.sales.push({ ...order, orderId: order.id });
    return order;
  }

  const filter = order.clientOrderId
    ? { canteenId: order.canteenId, clientOrderId: order.clientOrderId }
    : { canteenId: order.canteenId, id: order.id };
  const saved = await Order.findOneAndUpdate(
    filter,
    { $setOnInsert: order },
    { new: true, upsert: true }
  ).lean();

  await Sale.findOneAndUpdate(
    order.clientOrderId
      ? { canteenId: order.canteenId, clientOrderId: order.clientOrderId }
      : { canteenId: order.canteenId, orderId: order.id },
    { $setOnInsert: { ...order, orderId: order.id } },
    { new: true, upsert: true }
  );

  return saved;
}

async function allOrders(canteenId = DEFAULT_CANTEEN_ID) {
  const targetCanteenId = normalizeCanteenId(canteenId || DEFAULT_CANTEEN_ID);
  if (!mongoReady) return memory.orders.filter(item => normalizeCanteenId(item.canteenId || DEFAULT_CANTEEN_ID) === targetCanteenId);
  return Order.find({ canteenId: targetCanteenId }).sort({ createdAt: 1 }).lean();
}

async function getCoreCanteen(canteenId = DEFAULT_CANTEEN_ID) {
  const targetCanteenId = normalizeCanteenId(canteenId || DEFAULT_CANTEEN_ID);
  if (!mongoReady) return memory.canteens.find(item => normalizeCanteenId(item.canteenId) === targetCanteenId) || null;
  return Canteen.findOne({ canteenId: targetCanteenId }).lean();
}

async function clearOrders(canteenId = DEFAULT_CANTEEN_ID) {
  const targetCanteenId = normalizeCanteenId(canteenId || DEFAULT_CANTEEN_ID);
  if (!mongoReady) {
    memory.orders = memory.orders.filter(order => normalizeCanteenId(order.canteenId || DEFAULT_CANTEEN_ID) !== targetCanteenId);
    memory.sales = memory.sales.filter(sale => normalizeCanteenId(sale.canteenId || DEFAULT_CANTEEN_ID) !== targetCanteenId);
    return;
  }
  await Promise.all([Order.deleteMany({ canteenId: targetCanteenId }), Sale.deleteMany({ canteenId: targetCanteenId })]);
}

async function deleteOrder(id, canteenId = DEFAULT_CANTEEN_ID) {
  const targetCanteenId = normalizeCanteenId(canteenId || DEFAULT_CANTEEN_ID);
  const key = String(id || "").trim();
  if (!key) throw new Error("Order id is required");
  const numericId = Number(key);
  const numericMatch = Number.isFinite(numericId) ? numericId : -1;

  if (!mongoReady) {
    memory.orders = memory.orders.filter(order =>
      normalizeCanteenId(order.canteenId || DEFAULT_CANTEEN_ID) !== targetCanteenId ||
      (String(order.clientOrderId || "") !== key && Number(order.id) !== numericMatch)
    );
    memory.sales = memory.sales.filter(sale =>
      normalizeCanteenId(sale.canteenId || DEFAULT_CANTEEN_ID) !== targetCanteenId ||
      (String(sale.clientOrderId || "") !== key && Number(sale.orderId) !== numericMatch)
    );
    return;
  }

  await Promise.all([
    Order.deleteOne({ canteenId: targetCanteenId, $or: [{ clientOrderId: key }, { id: numericMatch }] }),
    Sale.deleteOne({ canteenId: targetCanteenId, $or: [{ clientOrderId: key }, { orderId: numericMatch }] })
  ]);
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
  if (reportType === "yearly") {
    const currentYear = todayKey.slice(6);
    return orders.filter(order => indiaDateKey(orderDate(order)).slice(6) === currentYear);
  }
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
    totals.credit += Number(breakup.credit || 0);
    totals.online = totals.upi + totals.card;
    return totals;
  }, { totalSales: 0, cash: 0, upi: 0, card: 0, online: 0, credit: 0 });
}

function userSalesFromOrders(orders) {
  const rows = new Map();
  orders.forEach(order => {
    const key = order.cashier || "Unknown";
    const row = rows.get(key) || { user: key, orders: 0, total: 0, cash: 0, online: 0, credit: 0 };
    const amount = Number(order.total || 0);
    const breakup = normalizePaymentBreakup(order.paymentBreakup, order.payment, amount);
    row.orders += 1;
    row.total += amount;
    row.cash += Number(breakup.cash || 0);
    row.online += Number(breakup.online || 0);
    row.credit += Number(breakup.credit || 0);
    rows.set(key, row);
  });
  return [...rows.values()].sort((a, b) => b.total - a.total);
}

async function reportData(reportType = "daily", canteenId = DEFAULT_CANTEEN_ID) {
  const currentOrders = reportOrdersForType(await allOrders(canteenId), reportType);
  const currentExpenses = await allExpenses(canteenId);
  const currentStock = await allStockItems(canteenId);
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

async function buildWhatsAppReport(reportType = "daily", canteenId = DEFAULT_CANTEEN_ID) {
  const data = await reportData(reportType, canteenId);
  const appSettings = await getSettings(canteenId);
  const titleType = reportType[0].toUpperCase() + reportType.slice(1);
  const topLines = data.topItems.slice(0, 3).length
    ? data.topItems.slice(0, 3).map((item, index) => `${index + 1}. ${item.name} - ${item.qty}`).join("\n")
    : "No items sold";
  const stockLines = data.lowStock.length
    ? data.lowStock.map(item => `- ${item.item} low`).join("\n")
    : "- No low stock";

  return [
    `🍽 ${appSettings.canteenName || "axzen Canteen"} ${titleType} Report`,
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

async function allMarketingUsers() {
  if (!mongoReady) return memory.marketingUsers;
  return MarketingUser.find({}).sort({ createdAt: 1 }).lean();
}

async function saveMarketingUser(payload, actor) {
  const current = await allMarketingUsers();
  const existingEmployee = current.find(item => String(item.employeeId || "").toUpperCase() === String(payload.employeeId || "").trim().toUpperCase()) || {};
  const employee = {
    employeeId: String(payload.employeeId || existingEmployee.employeeId || "").trim().toUpperCase(),
    name: String(payload.name ?? existingEmployee.name ?? "").trim(),
    mobile: normalizeMobile(payload.mobile ?? existingEmployee.mobile ?? ""),
    aadhaarNumber: String(payload.aadhaarNumber ?? existingEmployee.aadhaarNumber ?? "").trim(),
    panNumber: String(payload.panNumber ?? existingEmployee.panNumber ?? "").trim().toUpperCase(),
    password: String(payload.password ?? existingEmployee.password ?? "1234"),
    role: payload.role ? (payload.role === "super_admin" ? "super_admin" : "marketing") : (existingEmployee.role || "marketing"),
    active: payload.active !== undefined ? payload.active !== false : existingEmployee.active !== false,
    target: Number(payload.target ?? existingEmployee.target ?? 0),
    updatedAt: new Date().toISOString()
  };

  if (!employee.employeeId || !employee.name) throw new Error("Employee ID and name are required");
  if (!/^[A-Z0-9_-]{3,24}$/.test(employee.employeeId)) throw new Error("Employee ID must be 3-24 letters or numbers");
  if (employee.aadhaarNumber && !/^\d{12}$/.test(employee.aadhaarNumber)) throw new Error("Aadhaar number must be 12 digits");
  if (employee.panNumber && !/^[A-Z]{5}\d{4}[A-Z]$/.test(employee.panNumber)) throw new Error("PAN number format is invalid");

  if (!mongoReady) {
    const existing = memory.marketingUsers.find(item => String(item.employeeId).toUpperCase() === employee.employeeId);
    if (existing) Object.assign(existing, employee);
    else memory.marketingUsers.push({ ...employee, createdAt: new Date().toISOString() });
  } else {
    await MarketingUser.findOneAndUpdate(
      { employeeId: employee.employeeId },
      { $set: employee, $setOnInsert: { createdAt: new Date().toISOString() } },
      { new: true, upsert: true }
    );
  }

  await addMarketingActivity({
    type: "employee",
    text: `${employee.name} employee profile saved`,
    actor: actor?.name || "Super Admin"
  });
  return (await allMarketingUsers()).find(item => String(item.employeeId).toUpperCase() === employee.employeeId);
}

async function allMarketingCanteens() {
  if (!mongoReady) return memory.marketingCanteens;
  return MarketingCanteen.find({}).sort({ createdAt: -1 }).lean();
}

async function addMarketingActivity(activity) {
  const entry = {
    id: Date.now(),
    type: activity.type || "update",
    text: activity.text,
    actor: activity.actor || "System",
    canteenId: activity.canteenId,
    createdAt: new Date().toISOString()
  };
  if (!mongoReady) {
    memory.marketingActivities.unshift(entry);
    memory.marketingActivities = memory.marketingActivities.slice(0, 100);
    return entry;
  }
  return MarketingActivity.create(entry);
}

async function allMarketingActivities() {
  if (!mongoReady) return memory.marketingActivities;
  return MarketingActivity.find({}).sort({ createdAt: -1 }).limit(100).lean();
}

async function allMarketingPayments() {
  if (!mongoReady) return memory.marketingPayments;
  return MarketingPayment.find({}).sort({ createdAt: -1 }).limit(500).lean();
}

async function addMarketingPayment(payment) {
  const entry = {
    id: Date.now(),
    canteenId: Number(payment.canteenId),
    canteenName: payment.canteenName,
    amount: Number(payment.amount || 0),
    pendingAmount: Number(payment.pendingAmount || 0),
    paymentMode: payment.paymentMode || "UPI",
    collectedBy: payment.collectedBy || "",
    collectedByName: payment.collectedByName || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!entry.amount && !entry.pendingAmount) return null;
  if (!mongoReady) {
    memory.marketingPayments.unshift(entry);
    return entry;
  }
  return MarketingPayment.create(entry);
}

async function allMarketingSupportTickets() {
  if (!mongoReady) return memory.supportTickets;
  return MarketingSupportTicket.find({}).sort({ createdAt: -1 }).limit(200).lean();
}

async function allPrinters() {
  if (!mongoReady) return memory.printers;
  return Printer.find({}).sort({ createdAt: -1 }).lean();
}

async function savePrinterInventory(payload, actor) {
  const serialNumber = String(payload.serialNumber || "").trim().toUpperCase();
  if (!serialNumber) throw new Error("Printer serial number is required");
  const existingPrinter = await findPrinterBySerial(serialNumber) || {};
  const printer = {
    provider: String(payload.provider ?? existingPrinter.provider ?? "Thermal Printer").trim(),
    model: String(payload.model ?? existingPrinter.model ?? payload.provider ?? "Thermal Printer").trim(),
    serialNumber,
    bluetoothName: String(payload.bluetoothName ?? existingPrinter.bluetoothName ?? "").trim(),
    macAddress: String(payload.macAddress ?? existingPrinter.macAddress ?? "").trim(),
    status: String(payload.status ?? existingPrinter.status ?? "Stock"),
    allottedTo: String(payload.allottedTo ?? existingPrinter.allottedTo ?? "").trim(),
    allottedToName: String(payload.allottedToName ?? existingPrinter.allottedToName ?? "").trim(),
    marketingCanteenId: Number(payload.marketingCanteenId ?? existingPrinter.marketingCanteenId ?? 0) || undefined,
    marketingCanteenName: String(payload.marketingCanteenName ?? existingPrinter.marketingCanteenName ?? "").trim(),
    installedBy: existingPrinter.installedBy || actor?.employeeId || actor?.name || "",
    installedAt: existingPrinter.installedAt || new Date().toISOString()
  };
  if (printer.status !== "Allotted") {
    printer.allottedTo = "";
    printer.allottedToName = "";
    printer.marketingCanteenId = undefined;
    printer.marketingCanteenName = "";
  }
  if (!mongoReady) {
    const existing = memory.printers.find(item => String(item.serialNumber || "").toUpperCase() === serialNumber);
    if (existing) Object.assign(existing, printer);
    else memory.printers.unshift({ id: Date.now(), ...printer });
    return existing || memory.printers[0];
  }
  return Printer.findOneAndUpdate({ serialNumber }, { $set: printer }, { new: true, upsert: true }).lean();
}

async function findPrinterBySerial(serialNumber) {
  const serial = String(serialNumber || "").trim().toUpperCase();
  if (!serial) return null;
  return (await allPrinters()).find(item => String(item.serialNumber || "").toUpperCase() === serial) || null;
}

function normalizeMarketingCanteen(payload, user) {
  return {
    id: Number(payload.id || Date.now()),
    canteenName: String(payload.canteenName || "").trim(),
    ownerName: String(payload.ownerName || "").trim(),
    ownerMobile: String(payload.ownerMobile || "").trim(),
    alternateMobile: String(payload.alternateMobile || "").trim(),
    address: String(payload.address || "").trim(),
    city: String(payload.city || "").trim(),
    state: String(payload.state || "").trim(),
    counters: Number(payload.counters || 1),
    printersRequired: Number(payload.printersRequired || 0),
    printerModel: String(payload.printerModel || "").trim(),
    printerSerialNumber: String(payload.printerSerialNumber || "").trim().toUpperCase(),
    selectedPlan: String(payload.selectedPlan || "Starter"),
    planType: String(payload.planType || "Trial"),
    planStartDate: String(payload.planStartDate || new Date().toISOString().slice(0, 10)),
    planExpiryDate: String(payload.planExpiryDate || ""),
    paymentMode: String(payload.paymentMode || "Cash"),
    paidAmount: Number(payload.paidAmount || 0),
    pendingAmount: Number(payload.pendingAmount || 0),
    notes: String(payload.notes || ""),
    documents: String(payload.documents || ""),
    status: "Pending Approval",
    online: false,
    blocked: false,
    printersAssigned: 0,
    submittedBy: user.employeeId,
    submittedByName: user.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function createMarketingCanteen(payload, user) {
  const canteen = normalizeMarketingCanteen(payload, user);
  if (!canteen.canteenName || !canteen.ownerName || !canteen.ownerMobile) {
    throw new Error("Canteen name, owner name, and owner mobile are required");
  }
  if (Number(canteen.printersRequired || 0) > 0) {
    if (!canteen.printerModel || !canteen.printerSerialNumber) {
      throw new Error("Printer model and serial number are required");
    }
    const printer = await findPrinterBySerial(canteen.printerSerialNumber);
    if (!printer || String(printer.model || "") !== canteen.printerModel) {
      throw new Error("Printer serial number does not match selected printer");
    }
    if (printer.status === "Allotted" && Number(printer.marketingCanteenId || 0) !== Number(canteen.id)) {
      throw new Error("Printer serial number already allotted");
    }
  }
  if (!mongoReady) memory.marketingCanteens.unshift(canteen);
  else await MarketingCanteen.create(canteen);
  await addMarketingPayment({
    canteenId: canteen.id,
    canteenName: canteen.canteenName,
    amount: canteen.paidAmount,
    pendingAmount: canteen.pendingAmount,
    paymentMode: canteen.paymentMode,
    collectedBy: user.employeeId,
    collectedByName: user.name
  });
  await addMarketingActivity({
    type: "created",
    text: `${canteen.canteenName} submitted for approval`,
    actor: user.name,
    canteenId: canteen.id
  });
  return canteen;
}

async function updateMarketingCanteen(id, patch, actor) {
  const next = { ...patch, updatedAt: new Date().toISOString() };
  if (!mongoReady) {
    const index = memory.marketingCanteens.findIndex(item => Number(item.id) === Number(id));
    if (index === -1) throw new Error("Canteen not found");
    memory.marketingCanteens[index] = { ...memory.marketingCanteens[index], ...next };
    return memory.marketingCanteens[index];
  }
  const saved = await MarketingCanteen.findOneAndUpdate({ id: Number(id) }, { $set: next }, { new: true }).lean();
  if (!saved) throw new Error("Canteen not found");
  return saved;
}

function marketingCredentialSeed(canteen) {
  const id = String(canteen.id || Date.now()).replace(/\D/g, "").slice(-6).padStart(4, "0");
  return {
    activatedCanteenId: canteen.activatedCanteenId || `AXC-${id}`,
    canteenLoginId: canteen.canteenLoginId || `AXC${id}`,
    defaultPassword: canteen.defaultPassword || `AXZEN${id}`
  };
}

async function activateApprovedCanteen(canteen, actor) {
  const credentials = marketingCredentialSeed(canteen);
  const coreCanteen = {
    canteenId: credentials.activatedCanteenId,
    name: canteen.canteenName,
    ownerName: canteen.ownerName,
    phone: canteen.ownerMobile,
    address: [canteen.address, canteen.city, canteen.state].filter(Boolean).join(", "),
    plan: canteen.selectedPlan,
    paymentStatus: Number(canteen.pendingAmount || 0) > 0 ? "pending" : "paid",
    paymentReference: canteen.paymentMode,
    active: true,
    createdByMarketingUser: canteen.submittedBy
  };

  if (!mongoReady) {
    const index = memory.canteens.findIndex(item => item.canteenId === coreCanteen.canteenId);
    if (index >= 0) memory.canteens[index] = { ...memory.canteens[index], ...coreCanteen };
    else memory.canteens.push(coreCanteen);
  } else {
    await Canteen.findOneAndUpdate(
      { canteenId: coreCanteen.canteenId },
      { $set: coreCanteen },
      { upsert: true, new: true }
    );
  }

  await saveUser({
    canteenId: credentials.activatedCanteenId,
    name: canteen.ownerName || `${canteen.canteenName} Admin`,
    mobile: credentials.canteenLoginId,
    password: credentials.defaultPassword,
    role: "admin",
    active: true,
    mustChangePassword: true
  });
  await seedCanteenDefaults(credentials.activatedCanteenId, canteen.canteenName);
  if (canteen.printerSerialNumber) {
    await savePrinterInventory({
      serialNumber: canteen.printerSerialNumber,
      model: canteen.printerModel,
      status: "Allotted",
      allottedTo: canteen.submittedBy,
      allottedToName: canteen.submittedByName,
      marketingCanteenId: canteen.id,
      marketingCanteenName: canteen.canteenName
    }, actor);
  }

  return updateMarketingCanteen(canteen.id, credentials, actor);
}

async function reconcileApprovedCanteens() {
  const canteens = await allMarketingCanteens();
  const approved = canteens.filter(item =>
    item.status === "Active" ||
    item.status === "Trial" ||
    item.activatedCanteenId ||
    item.canteenLoginId
  );
  for (const canteen of approved) {
    await activateApprovedCanteen(canteen, { name: "System", employeeId: "SYSTEM" });
  }
}

function isToday(dateValue) {
  const date = new Date(dateValue || Date.now());
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function marketingSummary(canteens, users, activities, payments = [], supportTickets = []) {
  const active = canteens.filter(item => item.status === "Active");
  const trial = canteens.filter(item => item.status === "Trial");
  const expired = canteens.filter(item => item.status === "Expired" || (item.planExpiryDate && new Date(item.planExpiryDate) < new Date() && item.status !== "Blocked"));
  const blocked = canteens.filter(item => item.status === "Blocked" || item.blocked);
  const pendingPayments = canteens.reduce((sum, item) => sum + Number(item.pendingAmount || 0), 0);
  const visibleIds = new Set(canteens.map(item => Number(item.id)));
  const visiblePayments = payments.filter(item => visibleIds.has(Number(item.canteenId)));
  const monthlyRevenue = visiblePayments
    .filter(item => new Date(item.createdAt || Date.now()).getMonth() === new Date().getMonth())
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const printersAssigned = canteens.reduce((sum, item) => sum + Number(item.printersAssigned || 0), 0);
  const printersRequired = canteens.reduce((sum, item) => sum + Number(item.printersRequired || 0), 0);
  const onlineRecentMs = 2 * 60 * 1000;
  const onlineCanteens = canteens.filter(item => item.lastSeenAt && Date.now() - new Date(item.lastSeenAt).getTime() <= onlineRecentMs);
  const performance = users.filter(user => user.role === "marketing").map(user => {
    const mine = canteens.filter(item => item.submittedBy === user.employeeId);
    return {
      employeeId: user.employeeId,
      name: user.name,
      registrations: mine.length,
      approved: mine.filter(item => item.status === "Active" || item.status === "Trial").length,
      rejected: mine.filter(item => item.status === "Rejected").length,
      collection: mine.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0),
      pending: mine.reduce((sum, item) => sum + Number(item.pendingAmount || 0), 0),
      target: Number(user.target || 0)
    };
  });
  return {
    cards: {
      totalCanteens: canteens.length,
      activeCanteens: active.length,
      trialCanteens: trial.length,
      expiredCanteens: expired.length,
      blockedCanteens: blocked.length,
      onlineCanteens: onlineCanteens.length,
      offlineCanteens: Math.max(0, canteens.length - onlineCanteens.length),
      todaysRegistrations: canteens.filter(item => isToday(item.createdAt)).length,
      todaysCollections: visiblePayments.filter(item => isToday(item.createdAt)).reduce((sum, item) => sum + Number(item.amount || 0), 0),
      monthlyRevenue,
      pendingPayments,
      printersAssigned,
      printersAvailable: Math.max(0, printersRequired - printersAssigned),
      openSupportTickets: supportTickets.filter(item => item.status === "Open").length,
      pendingInstallations: canteens.filter(item => ["Active", "Trial"].includes(item.status) && Number(item.printersAssigned || 0) < Number(item.printersRequired || 0)).length
    },
    marketingPerformance: performance,
    recentActivities: activities.slice(0, 12)
  };
}

async function sendReportNow(reason = "manual", canteenId = DEFAULT_CANTEEN_ID) {
  const appSettings = await getSettings(canteenId);
  const to = appSettings.adminWhatsAppNumber || appSettings.reportPhone;
  if (!to) throw new Error("Missing admin WhatsApp number");

  const message = await buildWhatsAppReport(appSettings.reportType || "daily", canteenId);
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

async function dashboardData(canteenId = DEFAULT_CANTEEN_ID) {
  const orders = await allOrders(canteenId);
  const todayOrders = reportOrdersForType(orders, "daily");
  const stock = await allStockItems(canteenId);
  const expenses = await allExpenses(canteenId);
  const products = await allMenuItems(canteenId, { includeHidden: true });
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
    creditors: await allCreditors(canteenId),
    users: (await allUsers()).filter(user => normalizeCanteenId(user.canteenId || DEFAULT_CANTEEN_ID) === normalizeCanteenId(canteenId)).map(publicUser),
    settings: await getSettings(canteenId),
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

app.get("/products", async (req, res) => {
  const authUser = canteenUserFromRequest(req);
  res.json(await allMenuItems(authUser?.canteenId || DEFAULT_CANTEEN_ID));
});

app.get("/catalog/default-products", requireAdmin, async (req, res) => {
  const liveIds = new Set((await allMenuItems(req.authUser.canteenId)).map(item => Number(item.id)));
  res.json(defaultCatalogItems.map(item => ({ ...item, active: liveIds.has(Number(item.id)) })));
});

app.post("/products", requireDatabase, requireAdmin, async (req, res) => {
  try {
    const product = await saveMenuItem({ ...req.body, canteenId: req.authUser.canteenId || DEFAULT_CANTEEN_ID });
    res.json({ success: true, product, products: await allMenuItems(req.authUser.canteenId, { includeHidden: true }) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.delete("/products/:id", requireDatabase, requireAdmin, async (req, res) => {
  await deleteMenuItem(req.params.id, req.authUser.canteenId);
  res.json({ success: true, products: await allMenuItems(req.authUser.canteenId, { includeHidden: true }) });
});

app.get("/creditors", requireCanteenAuth, async (req, res) => {
  res.json(await allCreditors(req.authUser.canteenId));
});

app.post("/creditors", requireDatabase, requireAdmin, async (req, res) => {
  try {
    const creditor = await saveCreditor({ ...req.body, canteenId: req.authUser.canteenId || DEFAULT_CANTEEN_ID });
    res.json({ success: true, creditor, creditors: await allCreditors(req.authUser.canteenId) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get("/stock", async (req, res) => {
  const authUser = canteenUserFromRequest(req);
  res.json(await allStockItems(authUser?.canteenId || DEFAULT_CANTEEN_ID));
});

app.post("/stock", requireDatabase, requireAdmin, async (req, res) => {
  try {
    const item = await saveStockItem({ ...req.body, canteenId: req.authUser.canteenId || DEFAULT_CANTEEN_ID });
    res.json({ success: true, item, stock: await allStockItems(req.authUser.canteenId) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get("/expenses", requireAdmin, async (req, res) => res.json(await allExpenses(req.authUser.canteenId)));

app.post("/expenses", requireDatabase, requireAdmin, async (req, res) => {
  try {
    const expense = await saveExpense({ ...req.body, canteenId: req.authUser.canteenId || DEFAULT_CANTEEN_ID });
    res.json({ success: true, expense, expenses: await allExpenses(req.authUser.canteenId) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get("/settings", async (req, res) => {
  const authUser = canteenUserFromRequest(req);
  res.json(await getSettings(authUser?.canteenId || DEFAULT_CANTEEN_ID));
});

app.post("/settings", requireDatabase, requireAdmin, async (req, res) => {
  try {
    res.json({ success: true, settings: await saveSettings(req.body, req.authUser.canteenId) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/login", requireDatabase, async (req, res) => {
  const loginId = normalizeMobile(req.body.loginId || req.body.mobile || req.body.restaurantId || req.body.canteenId);
  const mobile = normalizeMobile(req.body.mobile || req.body.loginId);
  const canteenHint = normalizeCanteenId(req.body.canteenId || req.body.restaurantId || "");
  const loginAsCanteenId = normalizeCanteenId(loginId);
  const password = String(req.body.password || "");
  const users = (await allUsers()).filter(item => item.active !== false && String(item.password) === password);
  const matches = users.filter(item => {
    const itemCanteenId = normalizeCanteenId(item.canteenId || DEFAULT_CANTEEN_ID);
    const itemMobile = normalizeMobile(item.mobile);
    const canteenOk = !canteenHint || itemCanteenId === canteenHint;
    return canteenOk && (itemMobile === loginId || itemMobile === mobile || itemCanteenId === loginAsCanteenId);
  });

  const mobileMatches = matches.filter(item => normalizeMobile(item.mobile) === loginId || normalizeMobile(item.mobile) === mobile);
  const uniqueCanteens = new Set(mobileMatches.map(item => normalizeCanteenId(item.canteenId || DEFAULT_CANTEEN_ID)));
  if (!canteenHint && mobileMatches.length > 1 && uniqueCanteens.size > 1 && loginAsCanteenId !== normalizeCanteenId(matches[0]?.canteenId)) {
    return res.status(409).json({ success: false, message: "Restaurant ID required for this mobile number" });
  }

  const allowedMatches = [];
  for (const item of matches) {
    if (await canteenCanLogin(item.canteenId || DEFAULT_CANTEEN_ID)) allowedMatches.push(item);
  }
  const user = allowedMatches.find(item => normalizeCanteenId(item.canteenId || DEFAULT_CANTEEN_ID) === loginAsCanteenId) || allowedMatches[0];

  if (!user) return res.status(401).json({ success: false, message: "Invalid credentials or inactive canteen" });
  const canteen = await getCoreCanteen(user.canteenId);
  res.json({ success: true, user: { ...publicUser(user), canteen }, token: signToken(user), settings: await getSettings(user.canteenId) });
});

app.get("/users", requireCanteenAuth, async (req, res) => {
  const canteenId = normalizeCanteenId(req.authUser.canteenId || DEFAULT_CANTEEN_ID);
  res.json((await allUsers()).filter(user => normalizeCanteenId(user.canteenId || DEFAULT_CANTEEN_ID) === canteenId).map(publicUser));
});

app.post("/users", requireDatabase, requireAdmin, async (req, res) => {
  try {
    const payload = {
      ...req.body,
      canteenId: req.authUser.canteenId || DEFAULT_CANTEEN_ID,
      mustChangePassword: req.body.mustChangePassword === true
    };
    res.json({ success: true, user: publicUser(await saveUser(payload)) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.delete("/users/:mobile", requireDatabase, requireAdmin, async (req, res) => {
  await deleteUser(req.params.mobile, req.authUser.canteenId);
  res.json({ success: true });
});

app.post("/orders", requireDatabase, requireCanteenAuth, async (req, res) => {
  try {
    const order = await saveOrder({ ...req.body, canteenId: req.authUser.canteenId || DEFAULT_CANTEEN_ID });
    io.emit("new-order", order);
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/orders/sync", requireDatabase, requireCanteenAuth, async (req, res) => {
  try {
    const incoming = Array.isArray(req.body.orders) ? req.body.orders : [];
    const synced = [];
    for (const payload of incoming) {
      const order = await saveOrder({ ...payload, canteenId: req.authUser.canteenId || DEFAULT_CANTEEN_ID });
      synced.push(order.clientOrderId || order.id);
    }
    if (synced.length) io.emit("orders-synced", synced);
    res.json({ success: true, synced });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/orders", requireCanteenAuth, async (req, res) => res.json(await allOrders(req.authUser.canteenId)));

app.delete("/orders", requireDatabase, requireAdmin, async (req, res) => {
  await clearOrders(req.authUser.canteenId);
  io.emit("orders-cleared");
  res.json({ success: true });
});

app.delete("/orders/:id", requireDatabase, requireAdmin, async (req, res) => {
  await deleteOrder(req.params.id, req.authUser.canteenId);
  io.emit("order-deleted", req.params.id);
  res.json({ success: true });
});

app.get("/dashboard", requireCanteenAuth, async (req, res) => res.json(await dashboardData(req.authUser.canteenId)));

app.post("/marketing-api/login", requireDatabase, async (req, res) => {
  const employeeId = String(req.body.employeeId || "").trim();
  const password = String(req.body.password || "");
  const user = (await allMarketingUsers()).find(item =>
    item.active !== false &&
    String(item.employeeId) === employeeId &&
    String(item.password) === password
  );
  if (!user) return res.status(401).json({ success: false, message: "Invalid employee ID or password" });
  res.json({ success: true, user: publicMarketingUser(user), token: signMarketingToken(user) });
});

app.get("/marketing-api/me", requireMarketingAuth, async (req, res) => {
  res.json({ success: true, user: req.marketingUser });
});

app.get("/marketing-api/dashboard", requireMarketingAuth, async (req, res) => {
  const allCanteens = await allMarketingCanteens();
  const users = await allMarketingUsers();
  const activities = await allMarketingActivities();
  const payments = await allMarketingPayments();
  const supportTickets = await allMarketingSupportTickets();
  const canteens = req.marketingUser.role === "super_admin"
    ? allCanteens
    : allCanteens.filter(item => item.submittedBy === req.marketingUser.employeeId);
  const visibleIds = new Set(canteens.map(item => Number(item.id)));
  res.json({
    success: true,
    canteens,
    users: users.map(publicMarketingUser),
    printers: await allPrinters(),
    payments: req.marketingUser.role === "super_admin"
      ? payments
      : payments.filter(item => visibleIds.has(Number(item.canteenId))),
    supportTickets: req.marketingUser.role === "super_admin"
      ? supportTickets
      : supportTickets.filter(item => canteens.some(canteen => canteen.canteenName === item.canteenName)),
    activities: req.marketingUser.role === "super_admin" ? activities : [],
    summary: marketingSummary(canteens, users, req.marketingUser.role === "super_admin" ? activities : [], payments, supportTickets)
  });
});

app.post("/marketing-api/users", requireDatabase, requireSuperAdmin, async (req, res) => {
  try {
    const employee = await saveMarketingUser(req.body, req.marketingUser);
    res.json({ success: true, user: publicMarketingUser(employee), users: (await allMarketingUsers()).map(publicMarketingUser) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post("/marketing-api/users/:employeeId/block", requireDatabase, requireSuperAdmin, async (req, res) => {
  try {
    const active = req.body.blocked === true ? false : req.body.active !== false;
    const employee = await saveMarketingUser({ employeeId: req.params.employeeId, active }, req.marketingUser);
    res.json({ success: true, user: publicMarketingUser(employee), users: (await allMarketingUsers()).map(publicMarketingUser) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post("/marketing-api/printers", requireDatabase, requireSuperAdmin, async (req, res) => {
  try {
    const printer = await savePrinterInventory(req.body, req.marketingUser);
    res.json({ success: true, printer, printers: await allPrinters() });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post("/marketing-api/canteens", requireDatabase, requireMarketingAuth, async (req, res) => {
  if (req.marketingUser.role !== "marketing") {
    return res.status(403).json({ success: false, message: "Only marketing employees can submit canteens" });
  }
  try {
    const canteen = await createMarketingCanteen(req.body, req.marketingUser);
    res.json({ success: true, canteen });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post("/marketing-api/canteens/:id/approve", requireDatabase, requireSuperAdmin, async (req, res) => {
  try {
    const approved = await updateMarketingCanteen(req.params.id, {
      status: req.body.status || "Active",
      approvedBy: req.marketingUser.employeeId,
      approvedAt: new Date().toISOString(),
      online: true
    }, req.marketingUser);
    const canteen = await activateApprovedCanteen(approved, req.marketingUser);
    await addMarketingActivity({ type: "approved", text: `${canteen.canteenName} approved and activated`, actor: req.marketingUser.name, canteenId: canteen.id });
    res.json({ success: true, canteen });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post("/marketing-api/canteens/:id/reject", requireDatabase, requireSuperAdmin, async (req, res) => {
  try {
    const reason = String(req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ success: false, message: "Rejection reason is required" });
    const canteen = await updateMarketingCanteen(req.params.id, { status: "Rejected", rejectionReason: reason, online: false }, req.marketingUser);
    await addMarketingActivity({ type: "rejected", text: `${canteen.canteenName} rejected: ${reason}`, actor: req.marketingUser.name, canteenId: canteen.id });
    res.json({ success: true, canteen });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post("/marketing-api/canteens/:id/block", requireDatabase, requireSuperAdmin, async (req, res) => {
  try {
    const blocked = req.body.blocked !== false;
    const canteen = await updateMarketingCanteen(req.params.id, { status: blocked ? "Blocked" : "Active", blocked, online: !blocked }, req.marketingUser);
    if (canteen.activatedCanteenId) {
      await Canteen.findOneAndUpdate(
        { canteenId: normalizeCanteenId(canteen.activatedCanteenId) },
        { $set: { active: !blocked } }
      );
    }
    await addMarketingActivity({ type: "blocked", text: `${canteen.canteenName} ${blocked ? "blocked" : "unblocked"}`, actor: req.marketingUser.name, canteenId: canteen.id });
    res.json({ success: true, canteen });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post("/marketing-api/canteens/:id/payment", requireDatabase, requireSuperAdmin, async (req, res) => {
  try {
    const before = (await allMarketingCanteens()).find(item => Number(item.id) === Number(req.params.id));
    const nextPaidAmount = Number(req.body.paidAmount || 0);
    const paymentDelta = Math.max(0, nextPaidAmount - Number(before?.paidAmount || 0));
    const canteen = await updateMarketingCanteen(req.params.id, {
      paidAmount: nextPaidAmount,
      pendingAmount: Number(req.body.pendingAmount || 0),
      paymentMode: req.body.paymentMode || "UPI"
    }, req.marketingUser);
    await addMarketingPayment({
      canteenId: canteen.id,
      canteenName: canteen.canteenName,
      amount: paymentDelta || nextPaidAmount,
      pendingAmount: canteen.pendingAmount,
      paymentMode: canteen.paymentMode,
      collectedBy: req.marketingUser.employeeId,
      collectedByName: req.marketingUser.name
    });
    await addMarketingActivity({ type: "payment", text: `${canteen.canteenName} payment updated`, actor: req.marketingUser.name, canteenId: canteen.id });
    res.json({ success: true, canteen });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post("/marketing-api/canteens/:id/plan", requireDatabase, requireSuperAdmin, async (req, res) => {
  try {
    const canteen = await updateMarketingCanteen(req.params.id, {
      status: req.body.status || "Trial",
      planType: req.body.planType || req.body.status || "Trial",
      selectedPlan: req.body.selectedPlan || "Professional",
      planExpiryDate: req.body.planExpiryDate || ""
    }, req.marketingUser);
    await addMarketingActivity({ type: "plan", text: `${canteen.canteenName} plan updated`, actor: req.marketingUser.name, canteenId: canteen.id });
    res.json({ success: true, canteen });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post("/marketing-api/canteens/:id/printers", requireDatabase, requireSuperAdmin, async (req, res) => {
  try {
    const canteen = await updateMarketingCanteen(req.params.id, { printersAssigned: Number(req.body.printersAssigned || 0) }, req.marketingUser);
    await addMarketingActivity({ type: "printer", text: `${canteen.canteenName} printers assigned`, actor: req.marketingUser.name, canteenId: canteen.id });
    res.json({ success: true, canteen });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.post("/whatsapp/send-test-report", requireDatabase, requireAdmin, async (req, res) => {
  try {
    const result = await sendReportNow("manual", req.authUser.canteenId);
    res.json({ success: true, to: result.to, message: result.message, meta: result.meta });
  } catch (error) {
    const appSettings = await getSettings(req.authUser.canteenId);
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
  const appSettings = await getSettings(req.authUser.canteenId);
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
      console.log(`axzen Hospitality Backend running on http://localhost:${PORT}`);
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
