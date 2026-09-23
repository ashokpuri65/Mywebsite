/**
 * Rajputi Cloth Store - Database Schema & Data Layer
 * Uses Node.js built-in SQLite (DatabaseSync)
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const DATA_DIR = path.join(__dirname);
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'rajputi_store.db');
const db = new DatabaseSync(DB_PATH);

// Helper for hashing passwords
function hashPassword(password) {
  const salt = 'rajputi_royal_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function initDatabase() {
  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON;');

  // 1. Settings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // 2. Users Table (Admin & Customers)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      alternate_phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'customer',
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Categories Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      image_url TEXT,
      icon TEXT,
      is_featured INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0
    );
  `);

  // 4. Products Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      description TEXT,
      mrp REAL NOT NULL,
      price REAL NOT NULL,
      purchase_cost REAL NOT NULL,
      stock_quantity INTEGER DEFAULT 0,
      low_stock_alert INTEGER DEFAULT 5,
      fabric TEXT,
      color TEXT,
      sizes TEXT, -- JSON array of sizes: ["S","M","L","XL","Free Size"]
      images TEXT, -- JSON array of image URLs
      work_type TEXT, -- e.g. "Gota Patti", "Zari", "Danka", "Aari-Tari", "Kundan"
      is_featured INTEGER DEFAULT 0,
      is_bestseller INTEGER DEFAULT 0,
      is_new INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 5. Inventory Logs Table (Stock Audit Trail)
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      change_type TEXT NOT NULL, -- 'SALE', 'PURCHASE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'CANCEL_RETURN'
      quantity INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      reference_id TEXT, -- Order # or Purchase #
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 6. Suppliers Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company_name TEXT,
      phone TEXT NOT NULL,
      email TEXT,
      gstin TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      total_purchases REAL DEFAULT 0,
      total_paid REAL DEFAULT 0,
      outstanding_balance REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 7. Purchases Table (Inward Stock Bills)
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_number TEXT UNIQUE NOT NULL,
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE RESTRICT,
      bill_number TEXT,
      purchase_date DATE NOT NULL,
      total_amount REAL NOT NULL,
      discount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      grand_total REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      due_amount REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'CASH',
      payment_status TEXT DEFAULT 'PAID', -- 'PAID', 'PARTIAL', 'DUE'
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 8. Purchase Items Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER REFERENCES purchases(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE RESTRICT,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      cost_price REAL NOT NULL,
      total_cost REAL NOT NULL
    );
  `);

  // 9. Orders / Sales Table (Unified for Online and Walk-in POS)
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      sale_type TEXT DEFAULT 'ONLINE', -- 'ONLINE' or 'WALK_IN'
      customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      shipping_address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      subtotal REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      shipping_charge REAL DEFAULT 0,
      grand_total REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      due_amount REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'COD', -- 'COD', 'UPI', 'CASH', 'CARD'
      payment_status TEXT DEFAULT 'UNPAID', -- 'PAID', 'PARTIAL', 'UNPAID'
      order_status TEXT DEFAULT 'Pending', -- 'Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'
      whatsapp_sent INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 10. Order Items Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE RESTRICT,
      product_name TEXT NOT NULL,
      sku TEXT NOT NULL,
      size TEXT,
      color TEXT,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      total REAL NOT NULL
    );
  `);

  // 11. Payments Table (Customer Receipts & Supplier Payments Ledger)
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_type TEXT NOT NULL, -- 'CUSTOMER_RECEIPT' or 'SUPPLIER_PAYMENT'
      reference_id TEXT, -- Order Number or Purchase Number
      party_type TEXT NOT NULL, -- 'CUSTOMER' or 'SUPPLIER'
      party_id INTEGER,
      party_name TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'CASH', -- 'CASH', 'UPI', 'CARD', 'BANK_TRANSFER'
      transaction_reference TEXT,
      payment_date DATE NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 12. Reviews Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 13. Wishlist Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id)
    );
  `);

  // Safe migrations for newly added columns
  try {
    db.exec(`ALTER TABLE purchases ADD COLUMN bill_number TEXT;`);
  } catch (e) {
    // Column may already exist
  }

  seedInitialData();
}

function seedInitialData() {
  // Check if settings already seeded
  const checkSetting = db.prepare('SELECT COUNT(*) as count FROM settings').get();
  if (checkSetting.count === 0) {
    const defaultSettings = [
      ['store_name', 'NIDHISH CLOTH STORE'],
      ['tagline', 'Royal Rajasthani Heritage & Contemporary Fashion'],
      ['phone', 'Prem Puri: 9131974022 | Ashok Puri: 9672806509'],
      ['phone_prem', '9131974022'],
      ['phone_ashok', '9672806509'],
      ['whatsapp', '9672806509'],
      ['email', 'goswamiashokpuri65@gmail.com'],
      ['address', 'Rajputana Heritage Bazaar, Clock Tower Road, Jodhpur, Rajasthan - 342001'],
      ['gstin', '08AAACR1234R1ZP'],
      ['currency', '₹'],
      ['invoice_prefix', 'NCS-2026-'],
      ['delivery_charge', '100'],
      ['free_delivery_threshold', '1999'],
      ['tax_rate', '5'], // 5% GST for garments
      ['bank_name', 'State Bank of India'],
      ['account_number', '30291827364'],
      ['ifsc_code', 'SBIN0001234'],
      ['upi_id', 'nidhishcloth@sbi']
    ];

    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of defaultSettings) {
      insertSetting.run(k, v);
    }
  }

  // Seed Users (Admin)
  const checkUser = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (checkUser.count === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (name, email, phone, alternate_phone, password_hash, role, address, city, state, pincode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Admin Account: Ashok Puri (goswamiashokpuri65@gmail.com / Ashokpuri65@9691)
    insertUser.run(
      'Ashok Puri',
      'goswamiashokpuri65@gmail.com',
      '9672806509',
      '9131974022',
      hashPassword('Ashokpuri65@9691'),
      'admin',
      'Rajputana Palace Road',
      'Jodhpur',
      'Rajasthan',
      '342001'
    );
  }

  // Seed Categories (User's 6 specific categories)
  const checkCat = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (checkCat.count === 0) {
    const categories = [
      {
        name: 'Rajputi Bhari',
        slug: 'rajputi-bhari',
        description: 'Exclusive heavy bridal & festive Rajputi poshaak with rich traditional handwork.',
        image_url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80',
        icon: '👑',
        is_featured: 1,
        display_order: 1
      },
      {
        name: 'Rajputi Pure Poshak',
        slug: 'rajputi-pure-poshak',
        description: 'Authentic Pure Thakurji fabric poshak with handcrafted Gota Patti and Zari work.',
        image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80',
        icon: '✨',
        is_featured: 1,
        display_order: 2
      },
      {
        name: 'Rajputi Hafpure Poshak',
        slug: 'rajputi-hafpure-poshak',
        description: 'Royal Half-Pure (Hafpure) poshak sets designed for festivals and celebrations.',
        image_url: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80',
        icon: '🥻',
        is_featured: 1,
        display_order: 3
      },
      {
        name: 'Rajputi Japan tora Poshak',
        slug: 'rajputi-japan-tora-poshak',
        description: 'Classic Japan Tora fabric poshak with elegant embroidery and fine drape.',
        image_url: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=600&q=80',
        icon: '🌺',
        is_featured: 1,
        display_order: 4
      },
      {
        name: 'Cotton Suit',
        slug: 'cotton-suit',
        description: 'Premium pure cotton traditional suits with graceful prints and lightweight feel.',
        image_url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80',
        icon: '🌸',
        is_featured: 1,
        display_order: 5
      },
      {
        name: 'Other Suit',
        slug: 'other-suit',
        description: 'Designer crepe, satin, and partywear royal suits collection.',
        image_url: 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&w=600&q=80',
        icon: '👗',
        is_featured: 1,
        display_order: 6
      }
    ];

    const insertCat = db.prepare(`
      INSERT INTO categories (name, slug, description, image_url, icon, is_featured, display_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of categories) {
      insertCat.run(c.name, c.slug, c.description, c.image_url, c.icon, c.is_featured, c.display_order);
    }
  }
  // Clean Slate: 0 Products, 0 Customers, 0 Sales, 0 Purchases, 0 Suppliers, 0 Reviews.
}

// Initialize on module load
initDatabase();

module.exports = {
  db,
  hashPassword
};
