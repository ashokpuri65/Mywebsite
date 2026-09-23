/**
 * Migration Script:
 * 1. Rebrand to Nidhish Cloth Store
 * 2. Set contacts: Prem Puri (9131974022) & Ashok Puri (9672806509)
 * 3. Update Admin user to Ashok Puri (goswamiashokpuri65@gmail.com / Ashokpuri65@9691)
 * 4. Add alternate_phone column to users table if missing
 */
const { db, hashPassword } = require('../data/database');

console.log('🔄 Running store and admin rebranding migration...');

// 1. Add alternate_phone column if not exists
try {
  db.exec('ALTER TABLE users ADD COLUMN alternate_phone TEXT;');
  console.log('✅ Added alternate_phone column to users table');
} catch (err) {
  if (err.message.includes('duplicate column name')) {
    console.log('ℹ️ alternate_phone column already exists');
  } else {
    console.warn('Column add note:', err.message);
  }
}

// 2. Update Settings
const settingsToUpdate = [
  ['store_name', 'NIDHISH CLOTH STORE'],
  ['tagline', 'Royal Rajasthani Heritage & Contemporary Fashion'],
  ['phone', 'Prem Puri: 9131974022 | Ashok Puri: 9672806509'],
  ['phone_prem', '9131974022'],
  ['phone_ashok', '9672806509'],
  ['whatsapp', '9672806509'],
  ['email', 'goswamiashokpuri65@gmail.com'],
  ['invoice_prefix', 'NCS-2026-'],
  ['address', 'Rajputana Heritage Bazaar, Clock Tower Road, Jodhpur, Rajasthan - 342001']
];

const upsertSetting = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

for (const [k, v] of settingsToUpdate) {
  upsertSetting.run(k, v);
}
console.log('✅ Updated store settings to NIDHISH CLOTH STORE and dual contacts');

// 3. Update Admin User
const newPasswordHash = hashPassword('Ashokpuri65@9691');

const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();

if (adminExists) {
  db.prepare(`
    UPDATE users
    SET name = 'Ashok Puri',
        email = 'goswamiashokpuri65@gmail.com',
        phone = '9672806509',
        alternate_phone = '9131974022',
        password_hash = ?
    WHERE id = ?
  `).run(newPasswordHash, adminExists.id);
  console.log(`✅ Updated Admin user ID ${adminExists.id} to Ashok Puri (goswamiashokpuri65@gmail.com)`);
} else {
  db.prepare(`
    INSERT INTO users (name, email, phone, alternate_phone, password_hash, role, address, city, state, pincode)
    VALUES ('Ashok Puri', 'goswamiashokpuri65@gmail.com', '9672806509', '9131974022', ?, 'admin', 'Clock Tower Road', 'Jodhpur', 'Rajasthan', '342001')
  `).run(newPasswordHash);
  console.log('✅ Created new Admin user: Ashok Puri (goswamiashokpuri65@gmail.com)');
}

// Verification
const currentSettings = db.prepare('SELECT key, value FROM settings WHERE key IN (\'store_name\',\'phone\',\'whatsapp\',\'email\')').all();
console.log('Current Settings:', currentSettings);

const currentAdmin = db.prepare('SELECT id, name, email, phone, alternate_phone, role FROM users WHERE role = \'admin\'').all();
console.log('Current Admin:', currentAdmin);

console.log('🎉 Migration completed successfully!');
