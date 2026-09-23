/**
 * Payment Service
 * Recording and tracking Customer Receipts and Supplier Disbursements
 */
const { db } = require('../data/database');

function recordCustomerPayment({ customerId, orderNumber = '', amount, paymentMethod = 'CASH', transactionRef = '', paymentDate, notes = '' }) {
  const payAmount = Number(amount);
  if (!payAmount || payAmount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(customerId);
  if (!user) throw new Error('Customer not found');

  db.exec('BEGIN TRANSACTION;');
  try {
    // If order number provided, reduce due on that order
    if (orderNumber) {
      const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber);
      if (order) {
        const newPaid = Math.min(order.grand_total, order.paid_amount + payAmount);
        const newDue = Math.max(0, order.grand_total - newPaid);
        const newStatus = newDue === 0 ? 'PAID' : 'PARTIAL';

        db.prepare('UPDATE orders SET paid_amount = ?, due_amount = ?, payment_status = ? WHERE id = ?')
          .run(newPaid, newDue, newStatus, order.id);
      }
    }

    const stmt = db.prepare(`
      INSERT INTO payments (
        payment_type, reference_id, party_type, party_id, party_name,
        amount, payment_method, transaction_reference, payment_date, notes
      ) VALUES ('CUSTOMER_RECEIPT', ?, 'CUSTOMER', ?, ?, ?, ?, ?, ?, ?)
    `);

    const res = stmt.run(
      orderNumber || 'GENERAL_RECEIPT',
      user.id,
      user.name,
      payAmount,
      paymentMethod,
      transactionRef,
      paymentDate || new Date().toISOString().slice(0, 10),
      notes || `Payment receipt from customer ${user.name}`
    );

    db.exec('COMMIT;');
    return db.prepare('SELECT * FROM payments WHERE id = ?').get(res.lastInsertRowid);
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

function recordSupplierPayment({ supplierId, purchaseNumber = '', amount, paymentMethod = 'CASH', transactionRef = '', paymentDate, notes = '' }) {
  const payAmount = Number(amount);
  if (!payAmount || payAmount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  const supplier = db.prepare('SELECT id, name, company_name, outstanding_balance FROM suppliers WHERE id = ?').get(supplierId);
  if (!supplier) throw new Error('Supplier not found');

  db.exec('BEGIN TRANSACTION;');
  try {
    // If purchase number provided, reduce due on that purchase
    if (purchaseNumber) {
      const purchase = db.prepare('SELECT * FROM purchases WHERE purchase_number = ?').get(purchaseNumber);
      if (purchase) {
        const newPaid = Math.min(purchase.grand_total, purchase.paid_amount + payAmount);
        const newDue = Math.max(0, purchase.grand_total - newPaid);
        const newStatus = newDue === 0 ? 'PAID' : 'PARTIAL';

        db.prepare('UPDATE purchases SET paid_amount = ?, due_amount = ?, payment_status = ? WHERE id = ?')
          .run(newPaid, newDue, newStatus, purchase.id);
      }
    }

    // Reduce supplier outstanding balance
    db.prepare(`
      UPDATE suppliers
      SET total_paid = total_paid + ?,
          outstanding_balance = MAX(0, outstanding_balance - ?)
      WHERE id = ?
    `).run(payAmount, payAmount, supplierId);

    const stmt = db.prepare(`
      INSERT INTO payments (
        payment_type, reference_id, party_type, party_id, party_name,
        amount, payment_method, transaction_reference, payment_date, notes
      ) VALUES ('SUPPLIER_PAYMENT', ?, 'SUPPLIER', ?, ?, ?, ?, ?, ?, ?)
    `);

    const res = stmt.run(
      purchaseNumber || 'GENERAL_PAYMENT',
      supplier.id,
      supplier.company_name || supplier.name,
      payAmount,
      paymentMethod,
      transactionRef,
      paymentDate || new Date().toISOString().slice(0, 10),
      notes || `Payment made to supplier ${supplier.name}`
    );

    db.exec('COMMIT;');
    return db.prepare('SELECT * FROM payments WHERE id = ?').get(res.lastInsertRowid);
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

function getAllPayments(filters = {}) {
  let sql = 'SELECT * FROM payments WHERE 1=1';
  const params = [];

  if (filters.paymentType) {
    sql += ' AND payment_type = ?';
    params.push(filters.paymentType);
  }

  if (filters.partyType) {
    sql += ' AND party_type = ?';
    params.push(filters.partyType);
  }

  if (filters.partyId) {
    sql += ' AND party_id = ?';
    params.push(filters.partyId);
  }

  sql += ' ORDER BY id DESC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(Number(filters.limit));
  } else {
    sql += ' LIMIT 100';
  }

  return db.prepare(sql).all(...params);
}

module.exports = {
  recordCustomerPayment,
  recordSupplierPayment,
  getAllPayments
};
