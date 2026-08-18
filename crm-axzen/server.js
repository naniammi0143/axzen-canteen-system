const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../backend/.env") });
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const root = __dirname;
const port = Number(process.env.PORT || 5174);
const dbName = process.env.CRM_MONGODB_DB_NAME || "axzen_crm";
const jwtSecret = process.env.JWT_SECRET || "axzen-crm-local-secret";
const mongoUri = process.env.MONGODB_URI;
const metaWebhookVerifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.VERIFY_TOKEN || "axzen-crm-webhook";
const axzenAdmin = {
  company: process.env.AXZEN_ADMIN_COMPANY || "Axzen Infotech",
  username: process.env.AXZEN_ADMIN_USERNAME || "axzenadmin",
  phone: cleanPhone(process.env.AXZEN_ADMIN_PHONE || "8790568446"),
  password: process.env.AXZEN_ADMIN_PASSWORD || "Axzen@123"
};
const featureCatalog = [
  { id: "dashboard", label: "Dashboard", collection: null, defaultEnabled: true },
  { id: "leads", label: "Leads", collection: "leads", defaultEnabled: true },
  { id: "contacts", label: "Contacts", collection: "contacts", defaultEnabled: true },
  { id: "companies", label: "Companies", collection: "companies", defaultEnabled: true },
  { id: "pipeline", label: "Pipeline", collection: "pipeline", defaultEnabled: true },
  { id: "customers", label: "Customers", collection: "customers", defaultEnabled: true },
  { id: "campaigns", label: "Campaigns", collection: "campaigns", defaultEnabled: false },
  { id: "audiences", label: "Audiences", collection: "audiences", defaultEnabled: false },
  { id: "whatsappCampaigns", label: "WhatsApp Campaigns", collection: "whatsappCampaigns", defaultEnabled: false },
  { id: "metaAds", label: "Meta Ads", collection: "metaAds", defaultEnabled: false },
  { id: "creatives", label: "Creatives", collection: "creatives", defaultEnabled: false },
  { id: "analytics", label: "Analytics", collection: "analytics", defaultEnabled: false },
  { id: "conversations", label: "Conversations", collection: "conversations", defaultEnabled: false },
  { id: "tasks", label: "Tasks & Follow-ups", collection: "tasks", defaultEnabled: true },
  { id: "calendar", label: "Calendar", collection: "calendar", defaultEnabled: true },
  { id: "employees", label: "Employees", collection: "employees", defaultEnabled: false },
  { id: "fieldVisits", label: "Field Visits", collection: "fieldVisits", defaultEnabled: false },
  { id: "products", label: "Products", collection: "products", defaultEnabled: false },
  { id: "quotations", label: "Quotations", collection: "quotations", defaultEnabled: false },
  { id: "deals", label: "Deals", collection: "deals", defaultEnabled: true },
  { id: "subscriptions", label: "Subscriptions", collection: "subscriptions", defaultEnabled: false },
  { id: "payments", label: "Payments", collection: "payments", defaultEnabled: false },
  { id: "supportTickets", label: "Support Tickets", collection: "supportTickets", defaultEnabled: false },
  { id: "reports", label: "Reports", collection: "reports", defaultEnabled: true },
  { id: "automations", label: "Automations", collection: "automations", defaultEnabled: false },
  { id: "aiAssistant", label: "AI Assistant", collection: "aiAssistant", defaultEnabled: false },
  { id: "integrations", label: "Integrations", collection: "integrations", defaultEnabled: false },
  { id: "usersRoles", label: "Users & Roles", collection: "usersRoles", defaultEnabled: true },
  { id: "settings", label: "Settings", collection: null, defaultEnabled: true }
];
const allFeatureIds = featureCatalog.map((feature) => feature.id);
const defaultFeatureIds = featureCatalog.filter((feature) => feature.defaultEnabled).map((feature) => feature.id);
const crmCollections = [...new Set(featureCatalog.map((feature) => feature.collection).filter(Boolean).concat("notes", "integrationEvents"))];

if (!mongoUri) {
  console.warn("MONGODB_URI missing. Add it in crm-axzen/.env or backend/.env.");
}

app.use(express.json({ limit: "1mb" }));

mongoose.set("strictQuery", true);
let dbReady = null;

function connectDb() {
  if (!mongoUri) return Promise.reject(new Error("MONGODB_URI missing"));
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (dbReady) return dbReady;
  dbReady = mongoose
    .connect(mongoUri, { dbName, serverSelectionTimeoutMS: 12000 })
    .then((connection) => {
      console.log(`Axzen CRM connected to MongoDB database ${dbName}`);
      return connection;
    })
    .catch((error) => {
      dbReady = null;
      console.error("Axzen CRM MongoDB connection failed:", error.message);
      throw error;
    });
  return dbReady;
}

const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  normalizedName: { type: String, required: true, index: true },
  plan: { type: String, default: "Starter" },
  status: { type: String, default: "active", enum: ["trial", "active", "suspended"] },
  features: { type: [String], default: defaultFeatureIds },
  createdAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "CrmTenant", required: true, index: true },
  username: { type: String, required: true, trim: true },
  normalizedUsername: { type: String, required: true, index: true },
  phone: { type: String, required: true, index: true },
  passwordHash: { type: String, required: true },
  passwordSalt: { type: String, required: true },
  displayName: String,
  role: { type: String, default: "Owner" },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
userSchema.index({ normalizedUsername: 1, phone: 1 }, { unique: true });

const recordSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, required: true },
  createdAt: { type: Date, default: Date.now }
}, { strict: false });

const Tenant = mongoose.model("CrmTenant", tenantSchema, "crm_tenants");
const User = mongoose.model("CrmUser", userSchema, "crm_users");
const models = Object.fromEntries(crmCollections.map((name) => [
  name,
  mongoose.model(`Crm${name[0].toUpperCase()}${name.slice(1, -1)}`, recordSchema, `crm_${name}`)
]));

function cleanPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function titleCase(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { hash, salt };
}

function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.passwordHash, "hex"));
}

function publicUser(user) {
  return {
    id: String(user._id),
    tenantId: String(user.tenantId),
    username: user.username,
    displayName: user.displayName,
    phone: user.phone,
    role: user.role,
    active: user.active
  };
}

function publicTenant(tenant) {
  return {
    id: String(tenant._id),
    name: tenant.name,
    plan: tenant.plan,
    status: tenant.status,
    features: tenant.features || defaultFeatureIds,
    createdAt: tenant.createdAt
  };
}

function publicRecord(record) {
  const item = record.toObject({ versionKey: false });
  item.id = String(item._id);
  item.tenantId = String(item.tenantId);
  item.createdBy = String(item.createdBy);
  ["accessToken", "permanentToken", "appSecret", "verifyToken", "apiKey"].forEach((key) => {
    if (item[key]) item[key] = "••••••••";
  });
  delete item._id;
  return item;
}

async function requireDb(req, res, next) {
  try {
    await connectDb();
    next();
  } catch (error) {
    res.status(503).json({ success: false, message: "Database not connected", detail: error.message });
  }
}

async function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = await User.findById(payload.userId);
    if (!user) return res.status(401).json({ success: false, message: "Session expired" });
    if (user.active === false) return res.status(403).json({ success: false, message: "User disabled" });
    req.user = user;
    req.tenantId = user.tenantId;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Login required" });
  }
}

function requirePlatformAdmin(req, res, next) {
  if (req.user?.role !== "Platform Admin") {
    return res.status(403).json({ success: false, message: "Axzen admin access required" });
  }
  next();
}

function normalizeFeatures(features) {
  const requested = Array.isArray(features) ? features : defaultFeatureIds;
  return [...new Set(requested.filter((feature) => allFeatureIds.includes(feature)))];
}

async function ensureModuleEnabled(req, res, collection) {
  const tenant = await Tenant.findById(req.tenantId);
  const feature = featureCatalog.find((item) => item.collection === collection);
  if (req.user.role !== "Platform Admin" && feature && !(tenant.features || defaultFeatureIds).includes(feature.id)) {
    res.status(403).json({ success: false, message: "This module is not enabled for your plan" });
    return null;
  }
  return tenant;
}

async function getIntegration(tenantId, provider) {
  return models.integrations.findOne({ tenantId, provider });
}

function integrationStatus(record) {
  if (!record) return { configured: false, provider: null };
  const data = publicRecord(record);
  data.configured = true;
  return data;
}

async function createIntegrationEvent(tenantId, createdBy, provider, type, payload) {
  return models.integrationEvents.create({
    tenantId,
    createdBy,
    provider,
    type,
    payload,
    createdAt: new Date()
  });
}

async function ensurePlatformAdmin() {
  const normalizedName = axzenAdmin.company.toLowerCase();
  let tenant = await Tenant.findOne({ normalizedName });
  if (!tenant) {
    tenant = await Tenant.create({
      name: axzenAdmin.company,
      normalizedName,
      plan: "Platform",
      status: "active",
      features: allFeatureIds
    });
  } else if (!tenant.features?.length) {
    tenant.features = allFeatureIds;
    tenant.plan = tenant.plan || "Platform";
    tenant.status = tenant.status || "active";
    await tenant.save();
  }

  const normalizedUsername = axzenAdmin.username.toLowerCase();
  let user = await User.findOne({ normalizedUsername, phone: axzenAdmin.phone });
  if (!user) {
    const passwordData = hashPassword(axzenAdmin.password);
    user = await User.create({
      tenantId: tenant._id,
      username: axzenAdmin.username,
      normalizedUsername,
      phone: axzenAdmin.phone,
      passwordHash: passwordData.hash,
      passwordSalt: passwordData.salt,
      displayName: "Axzen Admin",
      role: "Platform Admin",
      active: true
    });
  } else if (user.role !== "Platform Admin") {
    user.role = "Platform Admin";
    user.active = true;
    await user.save();
  }
  return { tenant, user };
}

app.get("/api/health", requireDb, (req, res) => {
  res.json({ success: true, database: dbName });
});

app.get("/api/features", (req, res) => {
  res.json({ success: true, features: featureCatalog });
});

app.post("/api/auth/login", requireDb, async (req, res) => {
  const company = titleCase(req.body.companyName) || "Personal CRM";
  const username = titleCase(req.body.username);
  const normalizedUsername = username.toLowerCase();
  const phone = cleanPhone(req.body.phone);
  const password = String(req.body.password || "");

  if (!normalizedUsername || phone.length < 8 || password.length < 6) {
    return res.status(400).json({ success: false, message: "Username, valid phone number, minimum 6 character password kavali." });
  }

  await ensurePlatformAdmin();
  let user = await User.findOne({ normalizedUsername, phone });
  let tenant;

  if (user) {
    if (!verifyPassword(password, user)) {
      return res.status(401).json({ success: false, message: "Password wrong. Correct password enter cheyyandi." });
    }
    tenant = await Tenant.findById(user.tenantId);
    if (!tenant) {
      return res.status(401).json({ success: false, message: "Workspace not found" });
    }
    if (tenant.status === "suspended") {
      return res.status(403).json({ success: false, message: "Account suspended. Please contact Axzen." });
    }
  } else {
    return res.status(404).json({ success: false, message: "Account not found. Axzen admin should create this customer first." });
  }

  const token = jwt.sign({ userId: String(user._id), tenantId: String(tenant._id) }, jwtSecret, { expiresIn: "7d" });
  res.json({ success: true, token, tenant: publicTenant(tenant), user: publicUser(user) });
});

app.get("/api/bootstrap", requireDb, auth, async (req, res) => {
  const tenant = await Tenant.findById(req.tenantId);
  const data = {};
  const allowedCollections = req.user.role === "Platform Admin"
    ? crmCollections
    : crmCollections.filter((name) => featureCatalog.some((feature) => feature.collection === name && (tenant.features || defaultFeatureIds).includes(feature.id)));
  for (const name of allowedCollections) {
    const rows = await models[name].find({ tenantId: req.tenantId }).sort({ createdAt: -1 }).limit(300);
    data[name] = rows.map(publicRecord);
  }
  res.json({ success: true, tenant: publicTenant(tenant), user: publicUser(req.user), data, features: featureCatalog });
});

app.get("/api/integrations/:provider", requireDb, auth, async (req, res) => {
  const provider = req.params.provider;
  if (!["whatsapp", "meta"].includes(provider)) {
    return res.status(404).json({ success: false, message: "Unknown integration" });
  }
  const tenant = await ensureModuleEnabled(req, res, "integrations");
  if (!tenant) return;
  const record = await getIntegration(req.tenantId, provider);
  res.json({ success: true, integration: integrationStatus(record) });
});

app.put("/api/integrations/:provider", requireDb, auth, async (req, res) => {
  const provider = req.params.provider;
  if (!["whatsapp", "meta"].includes(provider)) {
    return res.status(404).json({ success: false, message: "Unknown integration" });
  }
  const tenant = await ensureModuleEnabled(req, res, "integrations");
  if (!tenant) return;
  const payload = { ...req.body };
  delete payload.id;
  delete payload._id;
  delete payload.tenantId;
  delete payload.createdBy;
  const existing = await getIntegration(req.tenantId, provider);
  const record = existing
    ? await models.integrations.findByIdAndUpdate(existing._id, { ...payload, provider, updatedAt: new Date() }, { new: true })
    : await models.integrations.create({ ...payload, provider, tenantId: req.tenantId, createdBy: req.user._id, createdAt: new Date() });
  res.json({ success: true, integration: integrationStatus(record) });
});

app.post("/api/integrations/whatsapp/test", requireDb, auth, async (req, res) => {
  const tenant = await ensureModuleEnabled(req, res, "integrations");
  if (!tenant) return;
  const integration = await getIntegration(req.tenantId, "whatsapp");
  if (!integration?.phoneNumberId || !integration?.accessToken) {
    return res.status(400).json({ success: false, message: "WhatsApp Phone Number ID and access token are required" });
  }
  const response = await fetch(`https://graph.facebook.com/v20.0/${integration.phoneNumberId}`, {
    headers: { Authorization: `Bearer ${integration.accessToken}` }
  });
  const data = await response.json().catch(() => ({}));
  await createIntegrationEvent(req.tenantId, req.user._id, "whatsapp", "test_connection", { ok: response.ok, status: response.status, data });
  res.status(response.ok ? 200 : 400).json({ success: response.ok, status: response.status, data });
});

app.post("/api/integrations/whatsapp/send", requireDb, auth, async (req, res) => {
  const tenant = await ensureModuleEnabled(req, res, "whatsappCampaigns");
  if (!tenant) return;
  const integration = await getIntegration(req.tenantId, "whatsapp");
  if (!integration?.phoneNumberId || !integration?.accessToken) {
    return res.status(400).json({ success: false, message: "WhatsApp integration is not configured" });
  }
  const to = cleanPhone(req.body.to);
  const message = String(req.body.message || "");
  if (!to || !message) return res.status(400).json({ success: false, message: "Recipient phone and message are required" });
  const response = await fetch(`https://graph.facebook.com/v20.0/${integration.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${integration.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: false, body: message }
    })
  });
  const data = await response.json().catch(() => ({}));
  await createIntegrationEvent(req.tenantId, req.user._id, "whatsapp", "send_message", { ok: response.ok, status: response.status, to, data });
  res.status(response.ok ? 200 : 400).json({ success: response.ok, status: response.status, data });
});

app.post("/api/integrations/meta/test", requireDb, auth, async (req, res) => {
  const tenant = await ensureModuleEnabled(req, res, "integrations");
  if (!tenant) return;
  const integration = await getIntegration(req.tenantId, "meta");
  if (!integration?.adAccountId || !integration?.accessToken) {
    return res.status(400).json({ success: false, message: "Meta Ad Account ID and access token are required" });
  }
  const adAccount = String(integration.adAccountId).startsWith("act_") ? integration.adAccountId : `act_${integration.adAccountId}`;
  const response = await fetch(`https://graph.facebook.com/v20.0/${adAccount}?fields=name,account_status,currency`, {
    headers: { Authorization: `Bearer ${integration.accessToken}` }
  });
  const data = await response.json().catch(() => ({}));
  await createIntegrationEvent(req.tenantId, req.user._id, "meta", "test_connection", { ok: response.ok, status: response.status, data });
  res.status(response.ok ? 200 : 400).json({ success: response.ok, status: response.status, data });
});

app.post("/api/integrations/meta/import-leads", requireDb, auth, async (req, res) => {
  const tenant = await ensureModuleEnabled(req, res, "metaAds");
  if (!tenant) return;
  const integration = await getIntegration(req.tenantId, "meta");
  if (!integration?.leadFormId || !integration?.accessToken) {
    return res.status(400).json({ success: false, message: "Meta Lead Form ID and access token are required" });
  }
  const response = await fetch(`https://graph.facebook.com/v20.0/${integration.leadFormId}/leads?fields=created_time,field_data,ad_name,campaign_name`, {
    headers: { Authorization: `Bearer ${integration.accessToken}` }
  });
  const data = await response.json().catch(() => ({}));
  const imported = [];
  if (response.ok && Array.isArray(data.data)) {
    for (const lead of data.data) {
      const fields = Object.fromEntries((lead.field_data || []).map((field) => [field.name, Array.isArray(field.values) ? field.values[0] : field.values]));
      const record = await models.leads.create({
        tenantId: req.tenantId,
        createdBy: req.user._id,
        name: fields.full_name || fields.name || fields.first_name || "Meta Lead",
        phone: cleanPhone(fields.phone_number || fields.phone || ""),
        email: fields.email || "",
        source: "Meta Ads",
        status: "New",
        notes: `Campaign: ${lead.campaign_name || ""} Ad: ${lead.ad_name || ""}`,
        metaLeadId: lead.id,
        createdAt: new Date()
      });
      imported.push(publicRecord(record));
    }
  }
  await createIntegrationEvent(req.tenantId, req.user._id, "meta", "import_leads", { ok: response.ok, status: response.status, count: imported.length, data });
  res.status(response.ok ? 200 : 400).json({ success: response.ok, imported, data });
});

app.get("/api/webhooks/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === metaWebhookVerifyToken) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

app.post("/api/webhooks/meta", requireDb, async (req, res) => {
  const body = req.body || {};
  const entries = body.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      const phoneNumberId = change.value?.metadata?.phone_number_id;
      const leadgenId = change.value?.leadgen_id;
      const integration = phoneNumberId
        ? await models.integrations.findOne({ provider: "whatsapp", phoneNumberId })
        : await models.integrations.findOne({ provider: "meta", leadFormId: change.value?.form_id });
      if (integration) {
        await createIntegrationEvent(integration.tenantId, integration.createdBy, phoneNumberId ? "whatsapp" : "meta", "webhook", { entry, change });
        if (leadgenId) {
          await models.leads.create({
            tenantId: integration.tenantId,
            createdBy: integration.createdBy,
            name: "Meta Lead",
            source: "Meta Ads",
            status: "New",
            metaLeadId: leadgenId,
            notes: "Imported from Meta leadgen webhook"
          });
        }
      }
    }
  }
  res.json({ success: true });
});

app.post("/api/:collection", requireDb, auth, async (req, res) => {
  const collection = req.params.collection;
  if (!crmCollections.includes(collection)) {
    return res.status(404).json({ success: false, message: "Unknown CRM module" });
  }
  const tenant = await ensureModuleEnabled(req, res, collection);
  if (!tenant) return;
  const payload = { ...req.body };
  delete payload.id;
  delete payload._id;
  delete payload.tenantId;
  delete payload.createdBy;
  const record = await models[collection].create({
    ...payload,
    tenantId: req.tenantId,
    createdBy: req.user._id
  });
  res.status(201).json({ success: true, record: publicRecord(record) });
});

app.delete("/api/:collection/:recordId", requireDb, auth, async (req, res) => {
  const collection = req.params.collection;
  if (!crmCollections.includes(collection)) {
    return res.status(404).json({ success: false, message: "Unknown CRM module" });
  }
  const tenant = await ensureModuleEnabled(req, res, collection);
  if (!tenant) return;
  const deleted = await models[collection].deleteOne({ _id: req.params.recordId, tenantId: req.tenantId });
  res.json({ success: true, deleted: deleted.deletedCount });
});

app.get("/api/admin/tenants", requireDb, auth, requirePlatformAdmin, async (req, res) => {
  const tenants = await Tenant.find({}).sort({ createdAt: -1 });
  const tenantIds = tenants.map((tenant) => tenant._id);
  const users = await User.find({ tenantId: { $in: tenantIds } }).sort({ createdAt: 1 });
  const counts = await Promise.all(tenants.map(async (tenant) => ({
    tenantId: String(tenant._id),
    users: users.filter((user) => String(user.tenantId) === String(tenant._id)).map(publicUser),
    leads: await models.leads.countDocuments({ tenantId: tenant._id }),
    contacts: await models.contacts.countDocuments({ tenantId: tenant._id }),
    deals: await models.deals.countDocuments({ tenantId: tenant._id })
  })));
  res.json({
    success: true,
    features: featureCatalog,
    tenants: tenants.map((tenant) => ({
      ...publicTenant(tenant),
      users: counts.find((item) => item.tenantId === String(tenant._id))?.users || [],
      usage: counts.find((item) => item.tenantId === String(tenant._id)) || {}
    }))
  });
});

app.post("/api/admin/tenants", requireDb, auth, requirePlatformAdmin, async (req, res) => {
  const companyName = titleCase(req.body.companyName);
  const username = titleCase(req.body.username || "owner");
  const normalizedUsername = username.toLowerCase();
  const phone = cleanPhone(req.body.phone);
  const password = String(req.body.password || "");
  if (!companyName || !normalizedUsername || phone.length < 8 || password.length < 6) {
    return res.status(400).json({ success: false, message: "Company, username, phone and password are required" });
  }
  const normalizedName = companyName.toLowerCase();
  let tenant = await Tenant.findOne({ normalizedName });
  if (!tenant) {
    tenant = await Tenant.create({
      name: companyName,
      normalizedName,
      plan: req.body.plan || "Starter",
      status: req.body.status || "trial",
      features: normalizeFeatures(req.body.features)
    });
  } else {
    tenant.plan = req.body.plan || tenant.plan;
    tenant.status = req.body.status || tenant.status;
    tenant.features = normalizeFeatures(req.body.features || tenant.features);
    await tenant.save();
  }
  let user = await User.findOne({ normalizedUsername, phone });
  if (!user) {
    const passwordData = hashPassword(password);
    user = await User.create({
      tenantId: tenant._id,
      username,
      normalizedUsername,
      phone,
      passwordHash: passwordData.hash,
      passwordSalt: passwordData.salt,
      displayName: username,
      role: "Owner",
      active: true
    });
  }
  res.status(201).json({ success: true, tenant: publicTenant(tenant), user: publicUser(user) });
});

app.patch("/api/admin/tenants/:tenantId", requireDb, auth, requirePlatformAdmin, async (req, res) => {
  const tenant = await Tenant.findById(req.params.tenantId);
  if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });
  if (req.body.plan) tenant.plan = req.body.plan;
  if (req.body.status) tenant.status = req.body.status;
  if (Array.isArray(req.body.features)) tenant.features = normalizeFeatures(req.body.features);
  await tenant.save();
  res.json({ success: true, tenant: publicTenant(tenant) });
});

app.use(express.static(root, {
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-store, max-age=0");
  }
}));

app.use((req, res) => {
  res.sendFile(path.join(root, "index.html"));
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Axzen CRM running at http://localhost:${port}`);
  });
}

module.exports = app;
