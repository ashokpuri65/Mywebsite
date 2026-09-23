/**
 * Product & Category Service
 * CRUD, Search, Filter, SKU generation, Low stock alerts
 */
const { db } = require('../data/database');

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// ============ CATEGORIES ============

function getAllCategories() {
  return db.prepare('SELECT * FROM categories ORDER BY display_order ASC, name ASC').all();
}

function getCategoryById(id) {
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
}

function createCategory({ name, description, image_url, icon, is_featured = 1, display_order = 0 }) {
  const slug = slugify(name);
  const stmt = db.prepare(`
    INSERT INTO categories (name, slug, description, image_url, icon, is_featured, display_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const res = stmt.run(name, slug, description || '', image_url || '', icon || '👑', is_featured ? 1 : 0, Number(display_order) || 0);
  return getCategoryById(res.lastInsertRowid);
}

function updateCategory(id, { name, description, image_url, icon, is_featured, display_order }) {
  const existing = getCategoryById(id);
  if (!existing) throw new Error('Category not found');

  const slug = name ? slugify(name) : existing.slug;
  const stmt = db.prepare(`
    UPDATE categories
    SET name = COALESCE(?, name),
        slug = ?,
        description = COALESCE(?, description),
        image_url = COALESCE(?, image_url),
        icon = COALESCE(?, icon),
        is_featured = COALESCE(?, is_featured),
        display_order = COALESCE(?, display_order)
    WHERE id = ?
  `);
  stmt.run(name, slug, description, image_url, icon, is_featured, display_order, id);
  return getCategoryById(id);
}

function deleteCategory(id) {
  return db.prepare('DELETE FROM categories WHERE id = ?').run(id);
}

// ============ PRODUCTS ============

function getAllProducts(filters = {}) {
  let sql = `
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.onlyActive !== false) {
    sql += ' AND p.is_active = 1';
  }

  if (filters.categoryId) {
    sql += ' AND p.category_id = ?';
    params.push(filters.categoryId);
  }

  if (filters.categorySlug) {
    sql += ' AND c.slug = ?';
    params.push(filters.categorySlug);
  }

  if (filters.search) {
    sql += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ? OR p.fabric LIKE ?)';
    const term = `%${filters.search.trim()}%`;
    params.push(term, term, term, term);
  }

  if (filters.minPrice) {
    sql += ' AND p.price >= ?';
    params.push(Number(filters.minPrice));
  }

  if (filters.maxPrice) {
    sql += ' AND p.price <= ?';
    params.push(Number(filters.maxPrice));
  }

  if (filters.inStock === 'true' || filters.inStock === true) {
    sql += ' AND p.stock_quantity > 0';
  }

  if (filters.isFeatured === 'true' || filters.isFeatured === true) {
    sql += ' AND p.is_featured = 1';
  }

  if (filters.isBestseller === 'true' || filters.isBestseller === true) {
    sql += ' AND p.is_bestseller = 1';
  }

  if (filters.isNew === 'true' || filters.isNew === true) {
    sql += ' AND p.is_new = 1';
  }

  // Sorting
  if (filters.sort === 'price_asc') {
    sql += ' ORDER BY p.price ASC';
  } else if (filters.sort === 'price_desc') {
    sql += ' ORDER BY p.price DESC';
  } else if (filters.sort === 'popular') {
    sql += ' ORDER BY p.is_bestseller DESC, p.id DESC';
  } else {
    // Default newest
    sql += ' ORDER BY p.id DESC';
  }

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(Number(filters.limit));
  }

  const products = db.prepare(sql).all(...params);
  return products.map(formatProduct);
}

function formatProduct(p) {
  if (!p) return null;
  return {
    ...p,
    sizes: p.sizes ? JSON.parse(p.sizes) : [],
    images: p.images ? JSON.parse(p.images) : [],
    discount_percent: p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0,
    is_low_stock: p.stock_quantity <= p.low_stock_alert && p.stock_quantity > 0,
    is_out_of_stock: p.stock_quantity <= 0
  };
}

function getProductById(id) {
  const p = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `).get(id);
  return formatProduct(p);
}

function getProductBySku(sku) {
  const p = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.sku = ?
  `).get(sku);
  return formatProduct(p);
}

function getProductBySlug(slug) {
  const p = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.slug = ?
  `).get(slug);
  return formatProduct(p);
}

function createProduct(data) {
  const sku = data.sku || `RCS-${Date.now().toString().slice(-6)}`;
  const slug = slugify(data.name) + '-' + Math.floor(100 + Math.random() * 900);
  const sizesJson = JSON.stringify(Array.isArray(data.sizes) ? data.sizes : (typeof data.sizes === 'string' ? data.sizes.split(',').map(s => s.trim()) : ['Free Size']));
  const imagesJson = JSON.stringify(Array.isArray(data.images) ? data.images : (typeof data.images === 'string' ? data.images.split(',').map(s => s.trim()) : []));

  const stmt = db.prepare(`
    INSERT INTO products (
      sku, name, slug, category_id, description, mrp, price, purchase_cost,
      stock_quantity, low_stock_alert, fabric, color, sizes, images, work_type,
      is_featured, is_bestseller, is_new, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let categoryId = data.category_id ? Number(data.category_id) : null;
  if (!categoryId && data.category) {
    const foundCat = db.prepare('SELECT id FROM categories WHERE name = ? OR slug = ?').get(data.category, data.category);
    if (foundCat) categoryId = foundCat.id;
  }

  const res = stmt.run(
    sku,
    data.name,
    slug,
    categoryId,
    data.description || '',
    Number(data.mrp) || 0,
    Number(data.price) || 0,
    Number(data.purchase_cost) || 0,
    Number(data.stock_quantity) || 0,
    Number(data.low_stock_alert) || 5,
    data.fabric || '',
    data.color || '',
    sizesJson,
    imagesJson,
    data.work_type || '',
    data.is_featured ? 1 : 0,
    data.is_bestseller ? 1 : 0,
    data.is_new ? 1 : 0,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1
  );

  const productId = res.lastInsertRowid;
  const initialStock = Number(data.stock_quantity) || 0;
  if (initialStock > 0) {
    db.prepare(`
      INSERT INTO inventory_logs (product_id, change_type, quantity, previous_stock, new_stock, reference_id, notes)
      VALUES (?, 'PURCHASE', ?, 0, ?, 'INITIAL-CREATION', 'New Product Catalog Creation')
    `).run(productId, initialStock, initialStock);
  }

  return getProductById(productId);
}

function updateProduct(id, data) {
  const existing = getProductById(id);
  if (!existing) throw new Error('Product not found');

  const sizesJson = data.sizes !== undefined ?
    JSON.stringify(Array.isArray(data.sizes) ? data.sizes : data.sizes.split(',').map(s => s.trim())) :
    JSON.stringify(existing.sizes);

  const imagesJson = data.images !== undefined ?
    JSON.stringify(Array.isArray(data.images) ? data.images : data.images.split(',').map(s => s.trim())) :
    JSON.stringify(existing.images);

  const stmt = db.prepare(`
    UPDATE products
    SET sku = COALESCE(?, sku),
        name = COALESCE(?, name),
        category_id = COALESCE(?, category_id),
        description = COALESCE(?, description),
        mrp = COALESCE(?, mrp),
        price = COALESCE(?, price),
        purchase_cost = COALESCE(?, purchase_cost),
        low_stock_alert = COALESCE(?, low_stock_alert),
        fabric = COALESCE(?, fabric),
        color = COALESCE(?, color),
        sizes = ?,
        images = ?,
        work_type = COALESCE(?, work_type),
        is_featured = COALESCE(?, is_featured),
        is_bestseller = COALESCE(?, is_bestseller),
        is_new = COALESCE(?, is_new),
        is_active = COALESCE(?, is_active)
    WHERE id = ?
  `);

  stmt.run(
    data.sku,
    data.name,
    data.category_id,
    data.description,
    data.mrp !== undefined ? Number(data.mrp) : null,
    data.price !== undefined ? Number(data.price) : null,
    data.purchase_cost !== undefined ? Number(data.purchase_cost) : null,
    data.low_stock_alert !== undefined ? Number(data.low_stock_alert) : null,
    data.fabric,
    data.color,
    sizesJson,
    imagesJson,
    data.work_type,
    data.is_featured !== undefined ? (data.is_featured ? 1 : 0) : null,
    data.is_bestseller !== undefined ? (data.is_bestseller ? 1 : 0) : null,
    data.is_new !== undefined ? (data.is_new ? 1 : 0) : null,
    data.is_active !== undefined ? (data.is_active ? 1 : 0) : null,
    id
  );

  return getProductById(id);
}

function deleteProduct(id) {
  return db.prepare('DELETE FROM products WHERE id = ?').run(id);
}

function getLowStockProducts() {
  const products = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.stock_quantity <= p.low_stock_alert AND p.is_active = 1
    ORDER BY p.stock_quantity ASC
  `).all();
  return products.map(formatProduct);
}

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllProducts,
  getProductById,
  getProductBySku,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts
};
