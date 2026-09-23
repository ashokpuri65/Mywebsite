/**
 * Report Service
 * Aggregations, Financial Analytics, Sales/Purchase Trends, Profit & Loss
 */
const { db } = require('../data/database');

function getDashboardSummary() {
  // 1. Sales metrics
  const salesMetrics = db.prepare(`
    SELECT
      COUNT(id) as total_orders_count,
      COALESCE(SUM(grand_total), 0) as total_sales_amount,
      COALESCE(SUM(paid_amount), 0) as total_sales_paid,
      COALESCE(SUM(due_amount), 0) as total_customer_outstanding,
      COALESCE(SUM(CASE WHEN order_status = 'Pending' THEN 1 ELSE 0 END), 0) as pending_orders_count
    FROM orders
    WHERE order_status != 'Cancelled'
  `).get();

  // 2. Today's Sales
  const todaySales = db.prepare(`
    SELECT COALESCE(SUM(grand_total), 0) as today_sales_amount, COUNT(id) as today_orders_count
    FROM orders
    WHERE order_status != 'Cancelled' AND DATE(created_at) = DATE('now')
  `).get();

  // 3. Purchase metrics
  const purchaseMetrics = db.prepare(`
    SELECT
      COUNT(id) as total_purchases_count,
      COALESCE(SUM(grand_total), 0) as total_purchases_amount,
      COALESCE(SUM(paid_amount), 0) as total_purchases_paid,
      COALESCE(SUM(due_amount), 0) as total_supplier_outstanding
    FROM purchases
  `).get();

  // 4. Inventory metrics
  const inventoryMetrics = db.prepare(`
    SELECT
      COUNT(id) as total_products,
      COALESCE(SUM(stock_quantity), 0) as total_stock_units,
      COALESCE(SUM(stock_quantity * purchase_cost), 0) as total_stock_cost_value,
      COALESCE(SUM(stock_quantity * price), 0) as total_stock_retail_value,
      COALESCE(SUM(CASE WHEN stock_quantity <= low_stock_alert AND stock_quantity > 0 THEN 1 ELSE 0 END), 0) as low_stock_count,
      COALESCE(SUM(CASE WHEN stock_quantity <= 0 THEN 1 ELSE 0 END), 0) as out_of_stock_count
    FROM products
    WHERE is_active = 1
  `).get();

  // 5. Party counts
  const customerCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'customer'").get().count;
  const supplierCount = db.prepare("SELECT COUNT(*) as count FROM suppliers").get().count;

  // 6. Recent Orders
  const recentOrders = db.prepare(`
    SELECT id, order_number, customer_name, customer_phone, grand_total, payment_status, order_status, created_at, sale_type
    FROM orders
    ORDER BY id DESC
    LIMIT 6
  `).all();

  // 7. Monthly Sales Trend (Last 6 Months)
  const monthlySales = db.prepare(`
    SELECT
      STRFTIME('%Y-%m', created_at) as month,
      SUM(grand_total) as total_sales,
      COUNT(id) as order_count
    FROM orders
    WHERE order_status != 'Cancelled'
    GROUP BY STRFTIME('%Y-%m', created_at)
    ORDER BY month DESC
    LIMIT 6
  `).all().reverse();

  // 8. Sales by Category
  const categorySales = db.prepare(`
    SELECT c.name as category_name, SUM(oi.total) as total_sales, SUM(oi.quantity) as total_quantity
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.order_status != 'Cancelled'
    GROUP BY c.id
    ORDER BY total_sales DESC
    LIMIT 6
  `).all();

  return {
    sales: {
      ...salesMetrics,
      today_sales_amount: todaySales.today_sales_amount,
      today_orders_count: todaySales.today_orders_count
    },
    purchases: purchaseMetrics,
    inventory: inventoryMetrics,
    customers_count: customerCount,
    suppliers_count: supplierCount,
    recent_orders: recentOrders,
    trends: {
      monthly_sales: monthlySales,
      category_sales: categorySales
    }
  };
}

function getSalesReport(startDate, endDate) {
  let sql = `
    SELECT
      DATE(created_at) as sale_date,
      COUNT(id) as order_count,
      SUM(subtotal) as subtotal_sum,
      SUM(discount_amount) as discount_sum,
      SUM(tax_amount) as tax_sum,
      SUM(shipping_charge) as shipping_sum,
      SUM(grand_total) as grand_total_sum,
      SUM(paid_amount) as paid_sum,
      SUM(due_amount) as due_sum
    FROM orders
    WHERE order_status != 'Cancelled'
  `;
  const params = [];

  if (startDate) {
    sql += ' AND DATE(created_at) >= ?';
    params.push(startDate);
  }

  if (endDate) {
    sql += ' AND DATE(created_at) <= ?';
    params.push(endDate);
  }

  sql += ' GROUP BY DATE(created_at) ORDER BY sale_date DESC';

  const rows = db.prepare(sql).all(...params);
  const totals = rows.reduce((acc, row) => {
    acc.totalOrders += row.order_count;
    acc.totalSales += row.grand_total_sum;
    acc.totalPaid += row.paid_sum;
    acc.totalDue += row.due_sum;
    return acc;
  }, { totalOrders: 0, totalSales: 0, totalPaid: 0, totalDue: 0 });

  return { rows, totals };
}

function getPurchaseReport(startDate, endDate) {
  let sql = `
    SELECT
      p.purchase_date,
      COUNT(p.id) as bill_count,
      SUM(p.total_amount) as total_sum,
      SUM(p.discount) as discount_sum,
      SUM(p.tax_amount) as tax_sum,
      SUM(p.grand_total) as grand_total_sum,
      SUM(p.paid_amount) as paid_sum,
      SUM(p.due_amount) as due_sum
    FROM purchases p
    WHERE 1=1
  `;
  const params = [];

  if (startDate) {
    sql += ' AND p.purchase_date >= ?';
    params.push(startDate);
  }

  if (endDate) {
    sql += ' AND p.purchase_date <= ?';
    params.push(endDate);
  }

  sql += ' GROUP BY p.purchase_date ORDER BY p.purchase_date DESC';

  const rows = db.prepare(sql).all(...params);
  const totals = rows.reduce((acc, row) => {
    acc.totalBills += row.bill_count;
    acc.totalPurchases += row.grand_total_sum;
    acc.totalPaid += row.paid_sum;
    acc.totalDue += row.due_sum;
    return acc;
  }, { totalBills: 0, totalPurchases: 0, totalPaid: 0, totalDue: 0 });

  return { rows, totals };
}

function getProfitAndLossReport(startDate, endDate) {
  // Revenue from completed / non-cancelled orders
  let salesSql = `
    SELECT
      COALESCE(SUM(o.grand_total), 0) as total_revenue,
      COALESCE(SUM(o.discount_amount), 0) as total_discounts_given,
      COALESCE(SUM(o.tax_amount), 0) as total_taxes_collected
    FROM orders o
    WHERE o.order_status != 'Cancelled'
  `;
  const salesParams = [];

  if (startDate) {
    salesSql += ' AND DATE(o.created_at) >= ?';
    salesParams.push(startDate);
  }
  if (endDate) {
    salesSql += ' AND DATE(o.created_at) <= ?';
    salesParams.push(endDate);
  }
  const salesData = db.prepare(salesSql).get(...salesParams);

  // Cost of Goods Sold (COGS) for items in those orders
  let cogsSql = `
    SELECT COALESCE(SUM(oi.quantity * p.purchase_cost), 0) as total_cogs
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.order_status != 'Cancelled'
  `;
  const cogsParams = [];

  if (startDate) {
    cogsSql += ' AND DATE(o.created_at) >= ?';
    cogsParams.push(startDate);
  }
  if (endDate) {
    cogsSql += ' AND DATE(o.created_at) <= ?';
    cogsParams.push(endDate);
  }
  const cogsData = db.prepare(cogsSql).get(...cogsParams);

  const grossProfit = salesData.total_revenue - cogsData.total_cogs;
  const netProfit = grossProfit - salesData.total_discounts_given;

  return {
    revenue: salesData.total_revenue,
    costOfGoodsSold: cogsData.total_cogs,
    discountsGiven: salesData.total_discounts_given,
    taxesCollected: salesData.total_taxes_collected,
    grossProfit,
    netProfit,
    profitMarginPercent: salesData.total_revenue > 0 ? Math.round((netProfit / salesData.total_revenue) * 100) : 0
  };
}

function getCategorySalesAnalytics() {
  // Query all active categories with sales and stock aggregation
  const sql = `
    SELECT 
      c.id,
      c.name,
      c.slug,
      COUNT(DISTINCT p.id) as product_count,
      COALESCE(SUM(p.stock_quantity), 0) as current_stock,
      COALESCE(sales.units_sold, 0) as units_sold,
      COALESCE(sales.revenue, 0) as revenue
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
    LEFT JOIN (
      SELECT 
        p2.category_id,
        SUM(oi.quantity) as units_sold,
        SUM(oi.total) as revenue
      FROM order_items oi
      JOIN products p2 ON oi.product_id = p2.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.order_status != 'Cancelled'
      GROUP BY p2.category_id
    ) sales ON sales.category_id = c.id
    GROUP BY c.id
    ORDER BY units_sold DESC, revenue DESC
  `;

  const categories = db.prepare(sql).all();

  let totalUnitsSold = 0;
  let totalRevenue = 0;
  let totalStock = 0;

  for (const cat of categories) {
    totalUnitsSold += cat.units_sold;
    totalRevenue += cat.revenue;
    totalStock += cat.current_stock;
  }

  // Find top and lowest category
  let topCategory = null;
  let lowestCategory = null;

  if (categories.length > 0) {
    topCategory = categories[0];
    lowestCategory = categories[categories.length - 1];
  }

  return {
    categories,
    topCategory,
    lowestCategory,
    totalUnitsSold,
    totalRevenue,
    totalStock
  };
}

module.exports = {
  getDashboardSummary,
  getSalesReport,
  getPurchaseReport,
  getProfitAndLossReport,
  getCategorySalesAnalytics
};
