/**
 * Sales & POS Billing Service
 * Handles Online Orders, In-store Walk-in POS Billing, Auto Stock Deduction,
 * Auto-update of Customer Outstanding, and GST Tax Invoicing.
 */
const { db } = require('../data/database');
const settingsService = require('./settingsService');

function generateOrderNumber(type = 'ONLINE') {
  const prefix = type === 'WALK_IN' ? 'RCS-POS-' : 'RCS-ORD-';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(10 + Math.random() * 90);
  return `${prefix}${timestamp}${random}`;
}

function createSaleOrOrder(orderData) {
  const {
    sale_type = 'ONLINE', // 'ONLINE' or 'WALK_IN'
    customer_id = null,
    customer_name,
    customer_phone,
    customer_email = '',
    shipping_address = '',
    city = '',
    state = '',
    pincode = '',
    items = [], // [{ product_id, sku, product_name, size, color, price, quantity }]
    discount_amount = 0,
    shipping_charge = 0,
    paid_amount = 0,
    payment_method = 'COD',
    payment_status = 'UNPAID', // 'PAID', 'PARTIAL', 'UNPAID'
    notes = ''
  } = orderData;

  if (!customer_name || !customer_phone) {
    throw new Error('Customer Name and Phone Number are required.');
  }

  if (!items || items.length === 0) {
    throw new Error('Sale must contain at least one item.');
  }

  // Calculate items subtotal and verify stock
  let subtotal = 0;
  for (const item of items) {
    const prod = db.prepare('SELECT id, name, sku, price, stock_quantity FROM products WHERE id = ?').get(item.product_id);
    if (!prod) {
      throw new Error(`Product not found (ID: ${item.product_id})`);
    }
    if (prod.stock_quantity < item.quantity) {
      throw new Error(`Insufficient stock for "${prod.name}". Available: ${prod.stock_quantity}, Requested: ${item.quantity}`);
    }
    subtotal += Number(item.price || prod.price) * Number(item.quantity);
  }

  const settings = settingsService.getAllSettings();
  const taxRate = Number(settings.tax_rate || 5);
  const taxableAmount = Math.max(0, subtotal - Number(discount_amount || 0));
  const taxAmount = Math.round((taxableAmount * (taxRate / 100)) * 100) / 100;
  const grandTotal = Math.round((taxableAmount + taxAmount + Number(shipping_charge || 0)) * 100) / 100;

  const paid = Math.min(grandTotal, Math.max(0, Number(paid_amount || 0)));
  const due = Math.max(0, Math.round((grandTotal - paid) * 100) / 100);

  let finalPaymentStatus = payment_status;
  if (paid >= grandTotal) {
    finalPaymentStatus = 'PAID';
  } else if (paid > 0) {
    finalPaymentStatus = 'PARTIAL';
  } else {
    finalPaymentStatus = 'UNPAID';
  }

  const orderNumber = generateOrderNumber(sale_type);
  const initialOrderStatus = sale_type === 'WALK_IN' ? 'Delivered' : 'Pending';

  // Execute database transaction
  db.exec('BEGIN TRANSACTION;');
  try {
    // Auto-resolve or Auto-create Customer in CRM (Users table)
    let effectiveCustomerId = customer_id;
    if (effectiveCustomerId) {
      const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get(effectiveCustomerId);
      if (existingUser) {
        db.prepare(`
          UPDATE users
          SET name = COALESCE(NULLIF(?, ''), name),
              address = COALESCE(NULLIF(?, ''), address),
              city = COALESCE(NULLIF(?, ''), city),
              state = COALESCE(NULLIF(?, ''), state),
              pincode = COALESCE(NULLIF(?, ''), pincode)
          WHERE id = ?
        `).run(customer_name.trim(), shipping_address.trim(), city.trim(), state.trim(), pincode.trim(), effectiveCustomerId);
      }
    } else if (customer_phone) {
      const cleanPhone = customer_phone.trim();
      const existingByPhone = db.prepare('SELECT id FROM users WHERE phone = ?').get(cleanPhone);
      if (existingByPhone) {
        effectiveCustomerId = existingByPhone.id;
        db.prepare(`
          UPDATE users
          SET name = COALESCE(NULLIF(?, ''), name),
              address = COALESCE(NULLIF(?, ''), address),
              city = COALESCE(NULLIF(?, ''), city),
              state = COALESCE(NULLIF(?, ''), state),
              pincode = COALESCE(NULLIF(?, ''), pincode)
          WHERE id = ?
        `).run(customer_name.trim(), shipping_address.trim(), city.trim(), state.trim(), pincode.trim(), effectiveCustomerId);
      } else {
        const crypto = require('crypto');
        const defaultPassword = crypto.createHash('sha256').update('Client@' + cleanPhone.slice(-4)).digest('hex');
        const generatedEmail = customer_email && customer_email.trim() 
          ? customer_email.trim() 
          : `customer_${cleanPhone}@nidhishstore.local`;
        
        const insertUserStmt = db.prepare(`
          INSERT INTO users (name, email, phone, password_hash, role, address, city, state, pincode)
          VALUES (?, ?, ?, ?, 'customer', ?, ?, ?, ?)
        `);
        const userRes = insertUserStmt.run(
          customer_name.trim(),
          generatedEmail,
          cleanPhone,
          defaultPassword,
          shipping_address.trim(),
          city.trim(),
          state.trim(),
          pincode.trim()
        );
        effectiveCustomerId = userRes.lastInsertRowid;
      }
    }

    // 1. Insert Order
    const insertOrderStmt = db.prepare(`
      INSERT INTO orders (
        order_number, sale_type, customer_id, customer_name, customer_phone, customer_email,
        shipping_address, city, state, pincode, subtotal, discount_amount, tax_amount,
        shipping_charge, grand_total, paid_amount, due_amount, payment_method,
        payment_status, order_status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const orderRes = insertOrderStmt.run(
      orderNumber,
      sale_type,
      effectiveCustomerId,
      customer_name.trim(),
      customer_phone.trim(),
      customer_email ? customer_email.trim() : '',
      shipping_address.trim(),
      city.trim(),
      state.trim(),
      pincode.trim(),
      subtotal,
      Number(discount_amount || 0),
      taxAmount,
      Number(shipping_charge || 0),
      grandTotal,
      paid,
      due,
      payment_method,
      finalPaymentStatus,
      initialOrderStatus,
      notes
    );

    const orderId = orderRes.lastInsertRowid;

    // 2. Insert Order Items & Deduct Stock
    const insertItemStmt = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, sku, size, color, price, quantity, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStockStmt = db.prepare(`
      UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?
    `);

    const insertInvLogStmt = db.prepare(`
      INSERT INTO inventory_logs (product_id, change_type, quantity, previous_stock, new_stock, reference_id, notes)
      VALUES (?, 'SALE', ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      const prod = db.prepare('SELECT stock_quantity, sku, name FROM products WHERE id = ?').get(item.product_id);
      const prevStock = prod.stock_quantity;
      const newStock = prevStock - item.quantity;
      const itemTotal = Number(item.price) * Number(item.quantity);

      insertItemStmt.run(
        orderId,
        item.product_id,
        item.product_name || prod.name,
        item.sku || prod.sku,
        item.size || 'Free Size',
        item.color || '',
        Number(item.price),
        Number(item.quantity),
        itemTotal
      );

      updateStockStmt.run(item.quantity, item.product_id);
      insertInvLogStmt.run(
        item.product_id,
        item.quantity,
        prevStock,
        newStock,
        orderNumber,
        `Sold via ${sale_type === 'WALK_IN' ? 'POS Counter' : 'Online Store'}`
      );
    }

    // 3. Customer Ledger update if customer registered or has due
    if (effectiveCustomerId) {
      const user = db.prepare('SELECT id FROM users WHERE id = ?').get(effectiveCustomerId);
      if (user) {
        if (shipping_address) {
          db.prepare('UPDATE users SET address = ?, city = ?, state = ?, pincode = ? WHERE id = ?')
            .run(shipping_address.trim(), city.trim(), state.trim(), pincode.trim(), effectiveCustomerId);
        }
      }
    }

    // 4. Record Payment in payments ledger if paid > 0
    if (paid > 0) {
      db.prepare(`
        INSERT INTO payments (
          payment_type, reference_id, party_type, party_id, party_name,
          amount, payment_method, payment_date, notes
        ) VALUES ('CUSTOMER_RECEIPT', ?, 'CUSTOMER', ?, ?, ?, ?, DATE('now'), ?)
      `).run(
        orderNumber,
        effectiveCustomerId,
        customer_name.trim(),
        paid,
        payment_method,
        `Payment received for order ${orderNumber}`
      );
    }

    db.exec('COMMIT;');
    return getOrderById(orderId);
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}

function getAllOrders(filters = {}) {
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (filters.saleType) {
    sql += ' AND sale_type = ?';
    params.push(filters.saleType);
  }

  if (filters.orderStatus) {
    sql += ' AND order_status = ?';
    params.push(filters.orderStatus);
  }

  if (filters.paymentStatus) {
    sql += ' AND payment_status = ?';
    params.push(filters.paymentStatus);
  }

  if (filters.customerId) {
    sql += ' AND customer_id = ?';
    params.push(filters.customerId);
  }

  if (filters.search) {
    sql += ' AND (order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)';
    const term = `%${filters.search.trim()}%`;
    params.push(term, term, term);
  }

  sql += ' ORDER BY id DESC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(Number(filters.limit));
  }

  const orders = db.prepare(sql).all(...params);
  return orders.map(attachOrderItems);
}

function attachOrderItems(order) {
  if (!order) return null;
  const items = db.prepare(`
    SELECT oi.*, p.images, p.fabric, p.color as product_color
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).all(order.id);

  const formattedItems = items.map(item => ({
    ...item,
    images: item.images ? JSON.parse(item.images) : []
  }));

  return {
    ...order,
    items: formattedItems
  };
}

function getOrderById(id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  return attachOrderItems(order);
}

function getOrderByNumber(orderNumber) {
  const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber.trim());
  return attachOrderItems(order);
}

function updateOrderStatus(id, newStatus) {
  const validStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }

  const order = getOrderById(id);
  if (!order) throw new Error('Order not found');

  // If transitioning to Cancelled from an active order: RESTORE STOCK
  if (newStatus === 'Cancelled' && order.order_status !== 'Cancelled') {
    db.exec('BEGIN TRANSACTION;');
    try {
      const updateStockStmt = db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?');
      const insertInvLogStmt = db.prepare(`
        INSERT INTO inventory_logs (product_id, change_type, quantity, previous_stock, new_stock, reference_id, notes)
        VALUES (?, 'CANCEL_RETURN', ?, ?, ?, ?, ?)
      `);

      for (const item of order.items) {
        const prod = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(item.product_id);
        const prevStock = prod ? prod.stock_quantity : 0;
        const newStock = prevStock + item.quantity;

        updateStockStmt.run(item.quantity, item.product_id);
        insertInvLogStmt.run(
          item.product_id,
          item.quantity,
          prevStock,
          newStock,
          order.order_number,
          `Stock restored on order cancellation (${order.order_number})`
        );
      }

      db.prepare('UPDATE orders SET order_status = ? WHERE id = ?').run(newStatus, id);
      db.exec('COMMIT;');
      return getOrderById(id);
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  }

  db.prepare('UPDATE orders SET order_status = ? WHERE id = ?').run(newStatus, id);
  return getOrderById(id);
}

function recordOrderPayment(orderId, { amount, paymentMethod = 'CASH', notes = '' }) {
  const order = getOrderById(orderId);
  if (!order) throw new Error('Order not found');

  const payAmount = Number(amount);
  if (payAmount <= 0) throw new Error('Payment amount must be greater than zero');

  const newPaid = Math.min(order.grand_total, order.paid_amount + payAmount);
  const newDue = Math.max(0, order.grand_total - newPaid);
  const paymentStatus = newDue === 0 ? 'PAID' : 'PARTIAL';

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare(`
      UPDATE orders
      SET paid_amount = ?, due_amount = ?, payment_status = ?
      WHERE id = ?
    `).run(newPaid, newDue, paymentStatus, orderId);

    db.prepare(`
      INSERT INTO payments (
        payment_type, reference_id, party_type, party_id, party_name,
        amount, payment_method, payment_date, notes
      ) VALUES ('CUSTOMER_RECEIPT', ?, 'CUSTOMER', ?, ?, ?, ?, DATE('now'), ?)
    `).run(
      order.order_number,
      order.customer_id,
      order.customer_name,
      payAmount,
      paymentMethod,
      notes || `Additional payment received for order ${order.order_number}`
    );

    db.exec('COMMIT;');
    return getOrderById(orderId);
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

module.exports = {
  createSaleOrOrder,
  getAllOrders,
  getOrderById,
  getOrderByNumber,
  updateOrderStatus,
  recordOrderPayment
};
