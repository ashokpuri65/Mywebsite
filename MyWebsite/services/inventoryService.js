/**
 * Inventory & Stock Management Service
 * Real-time stock audit, manual adjustments (+ Stock In / - Stock Out),
 * low stock warnings and full history logs.
 */
const { db } = require('../data/database');

function getInventoryOverview() {
  const stockSummary = db.prepare(`
    SELECT
      COUNT(*) as total_products,
      SUM(stock_quantity) as total_units,
      SUM(stock_quantity * purchase_cost) as total_inventory_cost_value,
      SUM(stock_quantity * price) as total_inventory_retail_value,
      SUM(CASE WHEN stock_quantity <= low_stock_alert AND stock_quantity > 0 THEN 1 ELSE 0 END) as low_stock_count,
      SUM(CASE WHEN stock_quantity <= 0 THEN 1 ELSE 0 END) as out_of_stock_count
    FROM products
    WHERE is_active = 1
  `).get();

  return stockSummary;
}

function adjustStock({ productId, adjustmentType, quantity, notes = '' }) {
  // adjustmentType: 'ADJUSTMENT_IN' or 'ADJUSTMENT_OUT'
  const qty = Math.abs(Number(quantity));
  if (!qty || qty <= 0) {
    throw new Error('Adjustment quantity must be greater than zero');
  }

  const prod = db.prepare('SELECT id, name, sku, stock_quantity FROM products WHERE id = ?').get(productId);
  if (!prod) {
    throw new Error('Product not found');
  }

  const prevStock = prod.stock_quantity;
  let newStock = prevStock;

  if (adjustmentType === 'ADJUSTMENT_IN') {
    newStock = prevStock + qty;
  } else if (adjustmentType === 'ADJUSTMENT_OUT') {
    if (prevStock < qty) {
      throw new Error(`Cannot reduce stock by ${qty}. Current stock is only ${prevStock}`);
    }
    newStock = prevStock - qty;
  } else {
    throw new Error('Invalid adjustment type. Must be ADJUSTMENT_IN or ADJUSTMENT_OUT');
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(newStock, productId);

    db.prepare(`
      INSERT INTO inventory_logs (
        product_id, change_type, quantity, previous_stock, new_stock, reference_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      productId,
      adjustmentType,
      qty,
      prevStock,
      newStock,
      `MANUAL-ADJ-${Date.now().toString().slice(-6)}`,
      notes || `Manual stock adjustment (${adjustmentType})`
    );

    db.exec('COMMIT;');

    return {
      productId,
      productName: prod.name,
      previousStock: prevStock,
      newStock,
      adjustmentType,
      quantity: qty
    };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

function getInventoryLogs(filters = {}) {
  let sql = `
    SELECT il.*, p.name as product_name, p.sku as product_sku
    FROM inventory_logs il
    LEFT JOIN products p ON il.product_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.productId) {
    sql += ' AND il.product_id = ?';
    params.push(filters.productId);
  }

  if (filters.changeType) {
    sql += ' AND il.change_type = ?';
    params.push(filters.changeType);
  }

  sql += ' ORDER BY il.id DESC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(Number(filters.limit));
  } else {
    sql += ' LIMIT 100';
  }

  return db.prepare(sql).all(...params);
}

module.exports = {
  getInventoryOverview,
  adjustStock,
  getInventoryLogs
};
