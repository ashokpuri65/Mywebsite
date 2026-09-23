/**
 * Party Service (Customers & Suppliers Directory and Ledgers)
 */
const { db, hashPassword } = require('../data/database');

// ============ CUSTOMERS ============

function getAllCustomers(search = '') {
  // Query users with role 'customer' plus aggregate order statistics
  let sql = `
    SELECT
      u.id, u.name, u.email, u.phone, u.address, u.city, u.state, u.pincode, u.created_at,
      COUNT(o.id) as total_orders,
      COALESCE(SUM(o.grand_total), 0) as total_purchases,
      COALESCE(SUM(o.paid_amount), 0) as total_paid,
      COALESCE(SUM(o.due_amount), 0) as outstanding_balance
    FROM users u
    LEFT JOIN orders o ON o.customer_id = u.id AND o.order_status != 'Cancelled'
    WHERE u.role = 'customer'
  `;
  const params = [];

  if (search) {
    sql += ' AND (u.name LIKE ? OR u.phone LIKE ? OR u.email LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  sql += ' GROUP BY u.id ORDER BY total_purchases DESC, u.id DESC';
  return db.prepare(sql).all(...params);
}

function getCustomerLedger(customerId) {
  const customer = db.prepare(`
    SELECT id, name, email, phone, address, city, state, pincode, created_at
    FROM users WHERE id = ?
  `).get(customerId);

  if (!customer) throw new Error('Customer not found');

  // Customer Orders
  const orders = db.prepare(`
    SELECT id, order_number, sale_type, created_at, grand_total, paid_amount, due_amount, payment_status, order_status
    FROM orders
    WHERE customer_id = ?
    ORDER BY id DESC
  `).all(customerId);

  // Customer Payments
  const payments = db.prepare(`
    SELECT id, reference_id, amount, payment_method, payment_date, notes
    FROM payments
    WHERE party_type = 'CUSTOMER' AND party_id = ?
    ORDER BY id DESC
  `).all(customerId);

  const totalPurchases = orders.reduce((sum, o) => sum + (o.order_status !== 'Cancelled' ? o.grand_total : 0), 0);
  const totalPaid = orders.reduce((sum, o) => sum + (o.order_status !== 'Cancelled' ? o.paid_amount : 0), 0);
  const outstandingBalance = orders.reduce((sum, o) => sum + (o.order_status !== 'Cancelled' ? o.due_amount : 0), 0);

  return {
    customer,
    totalPurchases,
    totalPaid,
    outstandingBalance,
    orders,
    payments
  };
}

function createCustomer({ name, phone, email = '', address = '', city = '', state = '', pincode = '' }) {
  const generatedEmail = email || `cust_${Date.now().toString().slice(-6)}@rajputi.local`;
  const defaultPassword = hashPassword('123456');

  const stmt = db.prepare(`
    INSERT INTO users (name, email, phone, password_hash, role, address, city, state, pincode)
    VALUES (?, ?, ?, ?, 'customer', ?, ?, ?, ?)
  `);

  const res = stmt.run(name.trim(), generatedEmail.trim(), phone.trim(), defaultPassword, address, city, state, pincode);
  return db.prepare('SELECT id, name, email, phone, address, city, state, pincode FROM users WHERE id = ?').get(res.lastInsertRowid);
}

// ============ SUPPLIERS ============

function getAllSuppliers(search = '') {
  let sql = `
    SELECT s.*,
      COALESCE((SELECT SUM(pi.quantity) FROM purchase_items pi JOIN purchases p ON pi.purchase_id = p.id WHERE p.supplier_id = s.id), 0) AS total_items_purchased,
      (SELECT COUNT(*) FROM purchases WHERE supplier_id = s.id) AS total_bills
    FROM suppliers s
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    sql += ' AND (s.name LIKE ? OR s.company_name LIKE ? OR s.phone LIKE ? OR s.gstin LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  sql += ' ORDER BY s.outstanding_balance DESC, s.name ASC';
  return db.prepare(sql).all(...params);
}

function getSupplierById(id) {
  return db.prepare(`
    SELECT s.*,
      COALESCE((SELECT SUM(pi.quantity) FROM purchase_items pi JOIN purchases p ON pi.purchase_id = p.id WHERE p.supplier_id = s.id), 0) AS total_items_purchased,
      (SELECT COUNT(*) FROM purchases WHERE supplier_id = s.id) AS total_bills
    FROM suppliers s
    WHERE s.id = ?
  `).get(id);
}

function getSupplierLedger(supplierId) {
  const supplier = getSupplierById(supplierId);
  if (!supplier) throw new Error('Supplier not found');

  const purchases = db.prepare(`
    SELECT p.id, p.purchase_number, p.bill_number, p.purchase_date, p.grand_total, p.paid_amount, p.due_amount, p.payment_status,
      COALESCE((SELECT SUM(quantity) FROM purchase_items WHERE purchase_id = p.id), 0) AS total_quantity,
      (SELECT GROUP_CONCAT(product_name || ' (' || quantity || ')') FROM purchase_items WHERE purchase_id = p.id) AS items_summary
    FROM purchases p
    WHERE p.supplier_id = ?
    ORDER BY p.id DESC
  `).all(supplierId);

  const payments = db.prepare(`
    SELECT id, reference_id, amount, payment_method, payment_date, notes
    FROM payments
    WHERE party_type = 'SUPPLIER' AND party_id = ?
    ORDER BY id DESC
  `).all(supplierId);

  return {
    supplier,
    purchases,
    payments
  };
}

function createSupplier({ name, company_name, phone, email = '', gstin = '', address = '', city = '', state = '' }) {
  if (!name || !phone) {
    throw new Error('Supplier Contact Name and Phone are required');
  }

  const stmt = db.prepare(`
    INSERT INTO suppliers (name, company_name, phone, email, gstin, address, city, state)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const res = stmt.run(
    name.trim(),
    company_name ? company_name.trim() : name.trim(),
    phone.trim(),
    email ? email.trim() : '',
    gstin ? gstin.trim().toUpperCase() : '',
    address,
    city,
    state
  );

  return getSupplierById(res.lastInsertRowid);
}

function updateSupplier(id, data) {
  const existing = getSupplierById(id);
  if (!existing) throw new Error('Supplier not found');

  const stmt = db.prepare(`
    UPDATE suppliers
    SET name = COALESCE(?, name),
        company_name = COALESCE(?, company_name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        gstin = COALESCE(?, gstin),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        state = COALESCE(?, state)
    WHERE id = ?
  `);

  stmt.run(
    data.name,
    data.company_name,
    data.phone,
    data.email,
    data.gstin,
    data.address,
    data.city,
    data.state,
    id
  );

  return getSupplierById(id);
}

module.exports = {
  getAllCustomers,
  getCustomerLedger,
  createCustomer,
  getAllSuppliers,
  getSupplierById,
  getSupplierLedger,
  createSupplier,
  updateSupplier
};
