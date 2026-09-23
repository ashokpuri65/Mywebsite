/**
 * Rajputi Cloth Store - Reset Database to Complete 0
 * Clears all products, customers, sales, purchases, inventory, suppliers, payments.
 * Preserves Admin account and store categories/settings.
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const DB_PATH = path.join(__dirname, '..', 'data', 'rajputi_store.db');
const db = new DatabaseSync(DB_PATH);

console.log('🔄 Wiping database to zero (0)...');

db.exec('PRAGMA foreign_keys = OFF;');

db.exec(`
  DELETE FROM order_items;
  DELETE FROM orders;
  DELETE FROM purchase_items;
  DELETE FROM purchases;
  DELETE FROM inventory_logs;
  DELETE FROM products;
  DELETE FROM suppliers;
  DELETE FROM payments;
  DELETE FROM reviews;
  DELETE FROM wishlist;
  DELETE FROM users WHERE role != 'admin';
  DELETE FROM sqlite_sequence WHERE name IN ('order_items', 'orders', 'purchase_items', 'purchases', 'inventory_logs', 'products', 'suppliers', 'payments', 'reviews', 'wishlist');
`);

db.exec('PRAGMA foreign_keys = ON;');

// Verify counts
const prodCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
const orderCount = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
const purchaseCount = db.prepare('SELECT COUNT(*) as count FROM purchases').get().count;
const custCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'customer'").get().count;
const supCount = db.prepare('SELECT COUNT(*) as count FROM suppliers').get().count;
const payCount = db.prepare('SELECT COUNT(*) as count FROM payments').get().count;
const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;

console.log('\n📊 Database Status After Zero Reset:');
console.log('-----------------------------------');
console.log('👗 Products:   ', prodCount);
console.log('👥 Customers:  ', custCount);
console.log('🛍️ Sales:      ', orderCount);
console.log('📥 Purchases:  ', purchaseCount);
console.log('🏭 Suppliers:  ', supCount);
console.log('💳 Payments:   ', payCount);
console.log('🔑 Admin Users:', adminCount);
console.log('-----------------------------------');

if (prodCount === 0 && custCount === 0 && orderCount === 0 && purchaseCount === 0) {
  console.log('✅ SUCCESS: Website has been completely reset to 0!');
} else {
  console.error('❌ Error: Database was not completely zeroed.');
}

process.exit(0);
