/**
 * Settings Service
 * Store profile, GSTIN, WhatsApp, Delivery Charges, Invoice Prefix, etc.
 */
const { db } = require('../data/database');

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settingsObj = {};
  for (const row of rows) {
    settingsObj[row.key] = row.value;
  }
  return settingsObj;
}

function updateSettings(settingsMap) {
  const stmt = db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);

  for (const [key, value] of Object.entries(settingsMap)) {
    stmt.run(key, String(value));
  }

  return getAllSettings();
}

module.exports = {
  getAllSettings,
  updateSettings
};
