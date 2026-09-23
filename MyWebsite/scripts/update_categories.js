/**
 * Update Categories in SQLite database to the 6 specified by the user
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const DB_PATH = path.join(__dirname, '..', 'data', 'rajputi_store.db');
const db = new DatabaseSync(DB_PATH);

console.log('🔄 Updating categories in database to the 6 requested...');

const newCategories = [
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

db.exec('PRAGMA foreign_keys = OFF;');
db.exec('DELETE FROM categories;');
db.exec("DELETE FROM sqlite_sequence WHERE name = 'categories';");

const insertCat = db.prepare(`
  INSERT INTO categories (name, slug, description, image_url, icon, is_featured, display_order)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (const c of newCategories) {
  insertCat.run(c.name, c.slug, c.description, c.image_url, c.icon, c.is_featured, c.display_order);
}

db.exec('PRAGMA foreign_keys = ON;');

const categories = db.prepare('SELECT id, name, slug, display_order FROM categories ORDER BY display_order ASC').all();
console.log('\n✅ Updated Categories in Database:');
console.table(categories);
console.log(`Total Categories: ${categories.length}`);
process.exit(0);
