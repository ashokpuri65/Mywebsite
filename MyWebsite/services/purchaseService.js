/**
 * Purchase & Supplier Procurement Service
 * Handles Inward Stock, Supplier Bills, Auto Stock Addition,
 * Auto-update of Supplier Outstanding balances.
 */
const { db } = require('../data/database');

function generatePurchaseNumber() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(10 + Math.random() * 90);
  return `RCS-PUR-${timestamp}${random}`;
}

function createPurchase(purchaseData) {
  const {
    supplier_id,
    supplier_name = '',
    supplier_phone = '',
    supplier_address = '',
    bill_number = '',
    purchase_date = new Date().toISOString().slice(0, 10),
    items = [], // [{ product_id, product_name, quantity, cost_price }]
    discount = 0,
    tax_amount = 0,
    paid_amount = 0,
    payment_method = 'CASH',
    notes = ''
  } = purchaseData;

  let effectiveSupplierId = supplier_id;

  if (effectiveSupplierId) {
    const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(effectiveSupplierId);
    if (!existing) {
      throw new Error('Supplier not found.');
    }
    if (supplier_address || supplier_phone) {
      db.prepare(`
        UPDATE suppliers
        SET phone = COALESCE(NULLIF(?, ''), phone),
            address = COALESCE(NULLIF(?, ''), address)
        WHERE id = ?
      `).run(supplier_phone.trim(), supplier_address.trim(), effectiveSupplierId);
    }
  } else if (supplier_name && supplier_phone) {
    const cleanPhone = supplier_phone.trim();
    const existingByPhone = db.prepare('SELECT * FROM suppliers WHERE phone = ?').get(cleanPhone);
    if (existingByPhone) {
      effectiveSupplierId = existingByPhone.id;
      db.prepare(`
        UPDATE suppliers
        SET name = COALESCE(NULLIF(?, ''), name),
            address = COALESCE(NULLIF(?, ''), address)
        WHERE id = ?
      `).run(supplier_name.trim(), supplier_address.trim(), effectiveSupplierId);
    } else {
      const res = db.prepare(`
        INSERT INTO suppliers (name, company_name, phone, address)
        VALUES (?, ?, ?, ?)
      `).run(supplier_name.trim(), supplier_name.trim(), cleanPhone, supplier_address.trim());
      effectiveSupplierId = res.lastInsertRowid;
    }
  } else {
    throw new Error('Supplier selection or Supplier Name & Mobile Number is required.');
  }

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(effectiveSupplierId);
  if (!supplier) {
    throw new Error('Supplier not found.');
  }

  if (!items || items.length === 0) {
    throw new Error('Purchase bill must contain at least one item.');
  }

  let totalAmount = 0;
  for (const item of items) {
    const cost = Number(item.cost_price ?? item.unit_cost ?? 0);
    const qty = Number(item.quantity ?? 0);
    totalAmount += cost * qty;
  }

  const grandTotal = Math.max(0, totalAmount - Number(discount || 0) + Number(tax_amount || 0));
  const paid = Math.min(grandTotal, Math.max(0, Number(paid_amount || 0)));
  const due = Math.max(0, grandTotal - paid);

  let paymentStatus = 'PAID';
  if (due > 0 && paid > 0) {
    paymentStatus = 'PARTIAL';
  } else if (due > 0 && paid === 0) {
    paymentStatus = 'DUE';
  }

  const purchaseNumber = generatePurchaseNumber();

  db.exec('BEGIN TRANSACTION;');
  try {
    // 1. Insert Purchase
    const insertPurchStmt = db.prepare(`
      INSERT INTO purchases (
        purchase_number, supplier_id, bill_number, purchase_date, total_amount, discount,
        tax_amount, grand_total, paid_amount, due_amount, payment_method,
        payment_status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const purchRes = insertPurchStmt.run(
      purchaseNumber,
      effectiveSupplierId,
      bill_number ? bill_number.trim() : '',
      purchase_date,
      totalAmount,
      Number(discount || 0),
      Number(tax_amount || 0),
      grandTotal,
      paid,
      due,
      payment_method,
      paymentStatus,
      notes
    );

    const purchaseId = purchRes.lastInsertRowid;

    // 2. Insert Items & Increment Stock
    const insertItemStmt = db.prepare(`
      INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, cost_price, total_cost)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateStockStmt = db.prepare(`
      UPDATE products
      SET stock_quantity = stock_quantity + ?,
          purchase_cost = ?
      WHERE id = ?
    `);

    const insertInvLogStmt = db.prepare(`
      INSERT INTO inventory_logs (product_id, change_type, quantity, previous_stock, new_stock, reference_id, notes)
      VALUES (?, 'PURCHASE', ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      const prod = db.prepare('SELECT stock_quantity, name FROM products WHERE id = ?').get(item.product_id);
      const prevStock = prod ? prod.stock_quantity : 0;
      const qty = Number(item.quantity || 0);
      const unitCost = Number(item.cost_price ?? item.unit_cost ?? 0);
      const newStock = prevStock + qty;
      const itemCost = unitCost * qty;

      insertItemStmt.run(
        purchaseId,
        item.product_id,
        item.product_name || (prod ? prod.name : 'Unknown Product'),
        qty,
        unitCost,
        itemCost
      );

      updateStockStmt.run(qty, unitCost, item.product_id);

      insertInvLogStmt.run(
        item.product_id,
        qty,
        prevStock,
        newStock,
        purchaseNumber,
        `Inward Purchase from ${supplier.name} (${supplier.company_name || ''})`
      );
    }

    // 3. Update Supplier Outstanding Ledger
    db.prepare(`
      UPDATE suppliers
      SET total_purchases = total_purchases + ?,
          total_paid = total_paid + ?,
          outstanding_balance = outstanding_balance + ?
      WHERE id = ?
    `).run(grandTotal, paid, due, effectiveSupplierId);

    // 4. Record Supplier Payment if paid > 0
    if (paid > 0) {
      db.prepare(`
        INSERT INTO payments (
          payment_type, reference_id, party_type, party_id, party_name,
          amount, payment_method, payment_date, notes
        ) VALUES ('SUPPLIER_PAYMENT', ?, 'SUPPLIER', ?, ?, ?, ?, ?, ?)
      `).run(
        purchaseNumber,
        effectiveSupplierId,
        supplier.company_name || supplier.name,
        paid,
        payment_method,
        purchase_date,
        `Supplier payment for purchase bill ${purchaseNumber}`
      );
    }

    db.exec('COMMIT;');
    return getPurchaseById(purchaseId);
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

function getAllPurchases(filters = {}) {
  let sql = `
    SELECT p.*, s.name as supplier_name, s.company_name as supplier_company
    FROM purchases p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.supplierId) {
    sql += ' AND p.supplier_id = ?';
    params.push(filters.supplierId);
  }

  if (filters.paymentStatus) {
    sql += ' AND p.payment_status = ?';
    params.push(filters.paymentStatus);
  }

  if (filters.search) {
    sql += ' AND (p.purchase_number LIKE ? OR p.bill_number LIKE ? OR s.name LIKE ? OR s.company_name LIKE ?)';
    const term = `%${filters.search.trim()}%`;
    params.push(term, term, term, term);
  }

  sql += ' ORDER BY p.id DESC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(Number(filters.limit));
  }

  const purchases = db.prepare(sql).all(...params);
  return purchases.map(attachPurchaseItems);
}

function attachPurchaseItems(purch) {
  if (!purch) return null;
  const items = db.prepare(`
    SELECT pi.*, p.sku, p.fabric, p.color
    FROM purchase_items pi
    LEFT JOIN products p ON pi.product_id = p.id
    WHERE pi.purchase_id = ?
  `).all(purch.id);

  return {
    ...purch,
    items
  };
}

function getPurchaseById(id) {
  const purch = db.prepare(`
    SELECT p.*, s.name as supplier_name, s.company_name as supplier_company, s.phone as supplier_phone, s.gstin as supplier_gstin
    FROM purchases p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.id = ?
  `).get(id);

  return attachPurchaseItems(purch);
}

module.exports = {
  createPurchase,
  getAllPurchases,
  getPurchaseById
};
