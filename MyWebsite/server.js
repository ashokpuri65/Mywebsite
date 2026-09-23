/**
 * Rajputi Cloth Store - Server & REST API
 * Pure Node.js high-performance server (Zero external npm dependencies required)
 */
const http = require('node:http');
const url = require('node:url');
const path = require('node:path');
const fs = require('node:fs');

// Services
const authService = require('./services/authService');
const settingsService = require('./services/settingsService');
const productService = require('./services/productService');
const salesService = require('./services/salesService');
const purchaseService = require('./services/purchaseService');
const inventoryService = require('./services/inventoryService');
const partyService = require('./services/partyService');
const paymentService = require('./services/paymentService');
const reportService = require('./services/reportService');
const { db } = require('./data/database');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp'
};

// Request Body Parser Helper
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e7) { // 10MB limit
        req.destroy();
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({ raw: body });
      }
    });
    req.on('error', reject);
  });
}

// JSON Response Helper
function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// Error Response Helper
function sendError(res, message, statusCode = 400) {
  sendJSON(res, { error: message, success: false }, statusCode);
}

// Extract Authenticated User from Request
function getAuthUser(req) {
  const authHeader = req.headers['authorization'] || '';
  let token = null;

  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers.cookie) {
    const match = req.headers.cookie.match(/rcs_token=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) return null;
  return authService.verifyToken(token);
}

// Require Admin Middleware
function requireAdmin(req, res) {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    sendError(res, 'Access denied. Administrator privileges required.', 403);
    return null;
  }
  return user;
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;
  const method = req.method;

  try {
    // ==========================================
    // 1. API ROUTES (/api/*)
    // ==========================================

    // Auth Routes
    if (pathname === '/api/auth/register' && method === 'POST') {
      const body = await parseBody(req);
      const result = authService.register(body);
      return sendJSON(res, { success: true, ...result });
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await parseBody(req);
      const result = authService.login(body);
      return sendJSON(res, { success: true, ...result });
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      const session = getAuthUser(req);
      if (!session) return sendError(res, 'Unauthenticated', 401);
      const profile = authService.getUserProfile(session.userId);
      return sendJSON(res, { success: true, user: profile });
    }

    if (pathname === '/api/auth/profile' && method === 'PUT') {
      const session = getAuthUser(req);
      if (!session) return sendError(res, 'Unauthenticated', 401);
      const body = await parseBody(req);
      const updated = authService.updateUserProfile(session.userId, body);
      return sendJSON(res, { success: true, user: updated });
    }

    // Forgot Password (OTP) Routes
    if (pathname === '/api/auth/forgot-password' && method === 'POST') {
      const body = await parseBody(req);
      const result = authService.requestPasswordResetOtp(body);
      return sendJSON(res, result);
    }

    if (pathname === '/api/auth/reset-password' && method === 'POST') {
      const body = await parseBody(req);
      const result = authService.verifyOtpAndResetPassword(body);
      return sendJSON(res, result);
    }

    // Admin Profile Routes
    if (pathname === '/api/admin/profile' && method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const session = getAuthUser(req);
      const profile = authService.getAdminProfile(session.userId);
      return sendJSON(res, { success: true, profile });
    }

    if (pathname === '/api/admin/profile' && method === 'PUT') {
      if (!requireAdmin(req, res)) return;
      const session = getAuthUser(req);
      const body = await parseBody(req);
      const updated = authService.updateAdminProfile(session.userId, body);
      return sendJSON(res, { success: true, profile: updated });
    }

    // Settings Routes
    if (pathname === '/api/settings' && method === 'GET') {
      const settings = settingsService.getAllSettings();
      return sendJSON(res, { success: true, settings });
    }

    if (pathname === '/api/settings' && method === 'PUT') {
      if (!requireAdmin(req, res)) return;
      const body = await parseBody(req);
      const updated = settingsService.updateSettings(body);
      return sendJSON(res, { success: true, settings: updated });
    }

    // Categories Routes
    if (pathname === '/api/categories' && method === 'GET') {
      const categories = productService.getAllCategories();
      return sendJSON(res, { success: true, categories });
    }

    if (pathname === '/api/categories' && method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const body = await parseBody(req);
      const category = productService.createCategory(body);
      return sendJSON(res, { success: true, category });
    }

    if (pathname.startsWith('/api/categories/') && method === 'PUT') {
      if (!requireAdmin(req, res)) return;
      const catId = Number(pathname.split('/')[3]);
      const body = await parseBody(req);
      const category = productService.updateCategory(catId, body);
      return sendJSON(res, { success: true, category });
    }

    if (pathname.startsWith('/api/categories/') && method === 'DELETE') {
      if (!requireAdmin(req, res)) return;
      const catId = Number(pathname.split('/')[3]);
      productService.deleteCategory(catId);
      return sendJSON(res, { success: true, message: 'Category deleted successfully' });
    }

    // System Network & Local IP for Store QR
    if (pathname === '/api/system/network-info' && method === 'GET') {
      const os = require('node:os');
      const nets = os.networkInterfaces();
      let localIp = 'localhost';
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            localIp = net.address;
            break;
          }
        }
        if (localIp !== 'localhost') break;
      }
      const allSettings = settingsService.getAllSettings();
      const publicLiveUrl = allSettings.public_live_url || 'https://05ccafd7a85fc5.lhr.life';
      return sendJSON(res, {
        success: true,
        localIp,
        port: PORT,
        publicLiveUrl,
        localUrl: `http://${localIp}:${PORT}`,
        localhostUrl: `http://localhost:${PORT}`
      });
    }

    // Products Routes
    if (pathname === '/api/products' && method === 'GET') {
      const products = productService.getAllProducts(query);
      return sendJSON(res, { success: true, count: products.length, products });
    }

    if (pathname === '/api/products/low-stock' && method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const products = productService.getLowStockProducts();
      return sendJSON(res, { success: true, count: products.length, products });
    }

    if (pathname === '/api/products' && method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const body = await parseBody(req);
      const product = productService.createProduct(body);
      return sendJSON(res, { success: true, product });
    }

    if (pathname.startsWith('/api/products/sku/') && method === 'GET') {
      const sku = pathname.split('/')[4];
      const product = productService.getProductBySku(sku);
      if (!product) return sendError(res, 'Product not found', 404);
      return sendJSON(res, { success: true, product });
    }

    if (pathname.startsWith('/api/products/slug/') && method === 'GET') {
      const slug = pathname.split('/')[4];
      const product = productService.getProductBySlug(slug);
      if (!product) return sendError(res, 'Product not found', 404);
      return sendJSON(res, { success: true, product });
    }

    if (pathname.startsWith('/api/products/') && method === 'GET') {
      const prodId = Number(pathname.split('/')[3]);
      const product = productService.getProductById(prodId);
      if (!product) return sendError(res, 'Product not found', 404);
      return sendJSON(res, { success: true, product });
    }

    if (pathname.startsWith('/api/products/') && method === 'PUT') {
      if (!requireAdmin(req, res)) return;
      const prodId = Number(pathname.split('/')[3]);
      const body = await parseBody(req);
      const product = productService.updateProduct(prodId, body);
      return sendJSON(res, { success: true, product });
    }

    if (pathname.startsWith('/api/products/') && method === 'DELETE') {
      if (!requireAdmin(req, res)) return;
      const prodId = Number(pathname.split('/')[3]);
      productService.deleteProduct(prodId);
      return sendJSON(res, { success: true, message: 'Product deleted successfully' });
    }

    // Orders & POS Sales Routes
    if (pathname === '/api/orders' && method === 'GET') {
      const user = getAuthUser(req);
      const filters = { ...query };
      if (!user || user.role !== 'admin') {
        if (!user) return sendError(res, 'Unauthenticated', 401);
        filters.customerId = user.userId;
      }
      const orders = salesService.getAllOrders(filters);
      return sendJSON(res, { success: true, count: orders.length, orders });
    }

    if (pathname === '/api/orders' && method === 'POST') {
      const body = await parseBody(req);
      const user = getAuthUser(req);
      if (user && !body.customer_id) {
        body.customer_id = user.userId;
      }
      body.sale_type = 'ONLINE';
      const order = salesService.createSaleOrOrder(body);
      return sendJSON(res, { success: true, order });
    }

    // POS Counter Sale Endpoint
    if (pathname === '/api/pos/sale' && method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const body = await parseBody(req);
      body.sale_type = 'WALK_IN';
      const sale = salesService.createSaleOrOrder(body);
      return sendJSON(res, { success: true, sale });
    }

    if (pathname.startsWith('/api/orders/track/') && method === 'GET') {
      const orderNumber = pathname.split('/')[4];
      const order = salesService.getOrderByNumber(orderNumber);
      if (!order) return sendError(res, 'Order not found', 404);
      return sendJSON(res, { success: true, order });
    }

    if (pathname.startsWith('/api/orders/') && pathname.endsWith('/status') && method === 'PUT') {
      if (!requireAdmin(req, res)) return;
      const orderId = Number(pathname.split('/')[3]);
      const body = await parseBody(req);
      const updated = salesService.updateOrderStatus(orderId, body.status);
      return sendJSON(res, { success: true, order: updated });
    }

    if (pathname.startsWith('/api/orders/') && pathname.endsWith('/payment') && method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const orderId = Number(pathname.split('/')[3]);
      const body = await parseBody(req);
      const updated = salesService.recordOrderPayment(orderId, body);
      return sendJSON(res, { success: true, order: updated });
    }

    if (pathname.startsWith('/api/orders/') && method === 'GET') {
      const orderId = Number(pathname.split('/')[3]);
      const order = salesService.getOrderById(orderId);
      if (!order) return sendError(res, 'Order not found', 404);
      return sendJSON(res, { success: true, order });
    }

    // Purchases Routes
    if (pathname === '/api/purchases' && method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const purchases = purchaseService.getAllPurchases(query);
      return sendJSON(res, { success: true, count: purchases.length, purchases });
    }

    if (pathname === '/api/purchases' && method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const body = await parseBody(req);
      const purchase = purchaseService.createPurchase(body);
      return sendJSON(res, { success: true, purchase });
    }

    if (pathname.startsWith('/api/purchases/') && method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const purchId = Number(pathname.split('/')[3]);
      const purchase = purchaseService.getPurchaseById(purchId);
      if (!purchase) return sendError(res, 'Purchase not found', 404);
      return sendJSON(res, { success: true, purchase });
    }

    // Inventory Routes
    if (pathname === '/api/inventory/overview' && method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const overview = inventoryService.getInventoryOverview();
      return sendJSON(res, { success: true, overview });
    }

    if (pathname === '/api/inventory/adjust' && method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const body = await parseBody(req);
      const result = inventoryService.adjustStock(body);
      return sendJSON(res, { success: true, ...result });
    }

    if (pathname === '/api/inventory/logs' && method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const logs = inventoryService.getInventoryLogs(query);
      return sendJSON(res, { success: true, count: logs.length, logs });
    }

    // Customer & Supplier CRM & Ledgers
    if (pathname === '/api/customers' && method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const customers = partyService.getAllCustomers(query.search);
      return sendJSON(res, { success: true, count: customers.length, customers });
    }

    if (pathname === '/api/customers' && method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const body = await parseBody(req);
      const customer = partyService.createCustomer(body);
      return sendJSON(res, { success: true, customer });
    }

    if (pathname.startsWith('/api/customers/') && pathname.endsWith('/ledger') && method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const customerId = Number(pathname.split('/')[3]);
      const ledger = partyService.getCustomerLedger(customerId);
      return sendJSON(res, { success: true, ...ledger });
    }

    if (pathname === '/api/suppliers' && method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const suppliers = partyService.getAllSuppliers(query.search);
      return sendJSON(res, { success: true, count: suppliers.length, suppliers });
    }

    if (pathname === '/api/suppliers' && method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const body = await parseBody(req);
      const supplier = partyService.createSupplier(body);
      return sendJSON(res, { success: true, supplier });
    }

    if (pathname.startsWith('/api/suppliers/') && pathname.endsWith('/ledger') && method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const supplierId = Number(pathname.split('/')[3]);
      const ledger = partyService.getSupplierLedger(supplierId);
      return sendJSON(res, { success: true, ...ledger });
    }

    if (pathname.startsWith('/api/suppliers/') && method === 'PUT') {
      if (!requireAdmin(req, res)) return;
      const supplierId = Number(pathname.split('/')[3]);
      const body = await parseBody(req);
      const updated = partyService.updateSupplier(supplierId, body);
      return sendJSON(res, { success: true, supplier: updated });
    }

    // Payments Routes
    if (pathname === '/api/payments' && method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const payments = paymentService.getAllPayments(query);
      return sendJSON(res, { success: true, count: payments.length, payments });
    }

    if (pathname === '/api/payments/customer' && method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const body = await parseBody(req);
      const payment = paymentService.recordCustomerPayment(body);
      return sendJSON(res, { success: true, payment });
    }

    if (pathname === '/api/payments/supplier' && method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const body = await parseBody(req);
      const payment = paymentService.recordSupplierPayment(body);
      return sendJSON(res, { success: true, payment });
    }

    // Reports Routes
    if (pathname === '/api/reports/summary' && method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const summary = reportService.getDashboardSummary();
      return sendJSON(res, { success: true, summary });
    }

    if (pathname === '/api/reports/sales' && method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const report = reportService.getSalesReport(query.startDate, query.endDate);
      return sendJSON(res, { success: true, ...report });
    }

    if (pathname === '/api/reports/purchases' && method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const report = reportService.getPurchaseReport(query.startDate, query.endDate);
      return sendJSON(res, { success: true, ...report });
    }

    if (pathname === '/api/reports/profit-loss' && method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const report = reportService.getProfitAndLossReport(query.startDate, query.endDate);
      return sendJSON(res, { success: true, ...report });
    }

    if (pathname === '/api/reports/category-analytics' && method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const analytics = reportService.getCategorySalesAnalytics();
      return sendJSON(res, { success: true, ...analytics });
    }

    // Reviews Routes
    if (pathname === '/api/reviews' && method === 'GET') {
      const prodId = Number(query.productId);
      const reviews = prodId ?
        db.prepare('SELECT * FROM reviews WHERE product_id = ? ORDER BY id DESC').all(prodId) :
        db.prepare('SELECT * FROM reviews ORDER BY id DESC LIMIT 20').all();
      return sendJSON(res, { success: true, reviews });
    }

    if (pathname === '/api/reviews' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.product_id || !body.customer_name || !body.rating) {
        return sendError(res, 'Product ID, Customer Name and Rating are required');
      }
      const stmt = db.prepare('INSERT INTO reviews (product_id, customer_name, rating, comment) VALUES (?, ?, ?, ?)');
      const resStmt = stmt.run(body.product_id, body.customer_name, Math.min(5, Math.max(1, Number(body.rating))), body.comment || '');
      const newRev = db.prepare('SELECT * FROM reviews WHERE id = ?').get(resStmt.lastInsertRowid);
      return sendJSON(res, { success: true, review: newRev });
    }

    // Wishlist Routes
    if (pathname === '/api/wishlist' && method === 'GET') {
      const session = getAuthUser(req);
      if (!session) return sendError(res, 'Unauthenticated', 401);
      const items = db.prepare(`
        SELECT w.id as wishlist_id, p.*
        FROM wishlist w
        JOIN products p ON w.product_id = p.id
        WHERE w.user_id = ?
      `).all(session.userId);
      return sendJSON(res, { success: true, wishlist: items.map(productService.formatProduct || (p => p)) });
    }

    if (pathname === '/api/wishlist/toggle' && method === 'POST') {
      const session = getAuthUser(req);
      if (!session) return sendError(res, 'Unauthenticated', 401);
      const body = await parseBody(req);
      const existing = db.prepare('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?').get(session.userId, body.productId);
      if (existing) {
        db.prepare('DELETE FROM wishlist WHERE id = ?').run(existing.id);
        return sendJSON(res, { success: true, isFavorited: false });
      } else {
        db.prepare('INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)').run(session.userId, body.productId);
        return sendJSON(res, { success: true, isFavorited: true });
      }
    }

    // ==========================================
    // 2. STATIC ASSETS & SINGLE-PAGE ROUTING
    // ==========================================

    let filePath;
    if (pathname === '/' || pathname === '/index.html') {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    } else if (pathname === '/admin' || pathname === '/admin.html') {
      filePath = path.join(PUBLIC_DIR, 'admin.html');
    } else {
      filePath = path.join(PUBLIC_DIR, pathname);
    }

    // Normalize and prevent directory traversal
    filePath = path.normalize(filePath);
    if (!filePath.startsWith(PUBLIC_DIR)) {
      return sendError(res, 'Forbidden', 403);
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Fallback for SPA routing
        if (!pathname.startsWith('/api/')) {
          if (pathname.startsWith('/admin')) {
            return fs.createReadStream(path.join(PUBLIC_DIR, 'admin.html')).pipe(res);
          }
          return fs.createReadStream(path.join(PUBLIC_DIR, 'index.html')).pipe(res);
        }
        return sendError(res, 'Endpoint not found', 404);
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });

  } catch (error) {
    console.error('Server Internal Error:', error);
    sendError(res, error.message || 'Internal Server Error', 500);
  }
});

server.listen(PORT, () => {
  console.log('================================================================');
  console.log(`🏰 NIDHISH CLOTH STORE - Royal E-Commerce & Retail ERP System`);
  console.log(`🌟 Server running at: http://localhost:${PORT}`);
  console.log(`🛍️ Customer Store:    http://localhost:${PORT}`);
  console.log(`👑 Admin Dashboard:   http://localhost:${PORT}/admin`);
  console.log(`🔑 Admin Login:       goswamiashokpuri65@gmail.com / Ashokpuri65@9691`);
  console.log(`📞 Contacts:          Prem Puri: 9131974022 | Ashok Puri: 9672806509`);
  console.log('================================================================');
});
