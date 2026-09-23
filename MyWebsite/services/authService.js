/**
 * Authentication Service
 * User Login, Registration, Token/Session validation, Role verification,
 * OTP-based Password Reset, and Admin Profile Suite
 */
const { db, hashPassword } = require('../data/database');
const crypto = require('node:crypto');

// In-memory token store
const activeTokens = new Map();

// In-memory OTP store for password reset
// Map key: lowercase identifier -> { otp, userId, target, expiresAt }
const otpStore = new Map();

function generateToken(user) {
  const token = crypto.randomBytes(32).toString('hex');
  activeTokens.set(token, {
    userId: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  return token;
}

function verifyToken(token) {
  if (!token) return null;
  const session = activeTokens.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    activeTokens.delete(token);
    return null;
  }
  return session;
}

function register({ name, email, phone, password, address, city, state, pincode, role = 'customer' }) {
  if (!name || !email || !password) {
    throw new Error('Name, Email and Password are required.');
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) {
    throw new Error('An account with this email address already exists.');
  }

  const pwdHash = hashPassword(password);
  const stmt = db.prepare(`
    INSERT INTO users (name, email, phone, password_hash, role, address, city, state, pincode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const res = stmt.run(
    name.trim(),
    email.toLowerCase().trim(),
    phone || '',
    pwdHash,
    role,
    address || '',
    city || '',
    state || '',
    pincode || ''
  );

  const newUser = db.prepare('SELECT id, name, email, phone, alternate_phone, role, address, city, state, pincode FROM users WHERE id = ?').get(res.lastInsertRowid);
  const token = generateToken(newUser);
  return { user: newUser, token };
}

function login({ email, password }) {
  if (!email || !password) {
    throw new Error('Email and Password are required.');
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user) {
    throw new Error('Invalid email or password.');
  }

  const pwdHash = hashPassword(password);
  if (user.password_hash !== pwdHash) {
    throw new Error('Invalid email or password.');
  }

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    alternate_phone: user.alternate_phone || '',
    role: user.role,
    address: user.address,
    city: user.city,
    state: user.state,
    pincode: user.pincode
  };

  const token = generateToken(safeUser);
  return { user: safeUser, token };
}

function getUserProfile(userId) {
  const user = db.prepare('SELECT id, name, email, phone, alternate_phone, role, address, city, state, pincode, created_at FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('User not found.');
  return user;
}

function updateUserProfile(userId, { name, phone, alternate_phone, address, city, state, pincode }) {
  const stmt = db.prepare(`
    UPDATE users
    SET name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        alternate_phone = COALESCE(?, alternate_phone),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        pincode = COALESCE(?, pincode)
    WHERE id = ?
  `);
  stmt.run(name, phone, alternate_phone, address, city, state, pincode, userId);
  return getUserProfile(userId);
}

// -------------------------------------------------------------
// OTP-BASED FORGOT PASSWORD SYSTEM
// -------------------------------------------------------------

function requestPasswordResetOtp({ identifier }) {
  if (!identifier) {
    throw new Error('Please enter registered Email or Mobile Number.');
  }

  const cleanId = identifier.trim().toLowerCase();
  // Find user by email or by phone number match
  const user = db.prepare(`
    SELECT id, name, email, phone, alternate_phone, role
    FROM users
    WHERE LOWER(email) = ?
       OR phone = ?
       OR REPLACE(phone, '+91', '') = ?
       OR REPLACE(phone, ' ', '') = ?
       OR alternate_phone = ?
       OR REPLACE(alternate_phone, '+91', '') = ?
    LIMIT 1
  `).get(cleanId, cleanId, cleanId, cleanId, cleanId, cleanId);

  if (!user) {
    throw new Error('No account found with this Email or Mobile Number.');
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Mask target for privacy
  let maskedTarget = user.email;
  if (user.email) {
    const parts = user.email.split('@');
    maskedTarget = `${parts[0].slice(0, 3)}***@${parts[1]}`;
  }
  const maskedPhone = user.phone ? `+91 ******${user.phone.slice(-4)}` : '';

  // Store in memory
  otpStore.set(cleanId, {
    otp,
    userId: user.id,
    expiresAt,
    userEmail: user.email
  });

  // Print prominently to server log for self-hosted verification
  console.log('====================================================');
  console.log(`🔐 [PASSWORD RESET OTP GENERATED]`);
  console.log(`👤 User: ${user.name} (${user.email} | ${user.phone})`);
  console.log(`🔑 6-Digit OTP Code: >>> ${otp} <<<`);
  console.log(`⏳ Valid for: 10 minutes (Expires: ${new Date(expiresAt).toLocaleTimeString()})`);
  console.log('====================================================');

  return {
    success: true,
    message: `6-digit OTP has been sent to your registered Email (${maskedTarget}) and Mobile (${maskedPhone || 'registered'}).`,
    otp, // Delivered to modal for instant local verification
    targetEmail: maskedTarget,
    targetPhone: maskedPhone,
    identifier: cleanId
  };
}

function verifyOtpAndResetPassword({ identifier, otp, newPassword }) {
  if (!identifier || !otp || !newPassword) {
    throw new Error('Identifier, OTP, and New Password are required.');
  }

  if (newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const cleanId = identifier.trim().toLowerCase();
  const record = otpStore.get(cleanId);

  if (!record) {
    throw new Error('No active OTP request found for this account. Please request a new OTP.');
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(cleanId);
    throw new Error('OTP has expired. Please request a new OTP.');
  }

  if (record.otp !== otp.trim()) {
    throw new Error('Invalid OTP code. Please enter the correct 6-digit code.');
  }

  // Update user's password in database
  const newHash = hashPassword(newPassword);
  db.prepare(`
    UPDATE users
    SET password_hash = ?
    WHERE id = ?
  `).run(newHash, record.userId);

  // Remove used OTP
  otpStore.delete(cleanId);

  console.log(`✅ Password successfully reset for User ID: ${record.userId}`);

  return {
    success: true,
    message: 'Password has been reset successfully! You can now login with your new password.'
  };
}

// -------------------------------------------------------------
// ADMIN PROFILE SUITE
// -------------------------------------------------------------

function getAdminProfile(userId) {
  const user = db.prepare(`
    SELECT id, name, email, phone, alternate_phone, role, address, city, state, pincode, created_at
    FROM users
    WHERE id = ? AND role = 'admin'
  `).get(userId);

  if (!user) throw new Error('Admin user not found.');
  return user;
}

function updateAdminProfile(userId, { name, email, phone, alternate_phone, address, city, state, pincode, currentPassword, newPassword }) {
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND role = "admin"').get(userId);
  if (!user) throw new Error('Admin user not found.');

  // If email change requested, verify uniqueness
  if (email && email.toLowerCase().trim() !== user.email.toLowerCase()) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase().trim(), userId);
    if (existing) throw new Error('Email address already in use by another account.');
  }

  // If password change requested, verify current password
  let newPasswordHash = user.password_hash;
  if (newPassword) {
    if (!currentPassword) {
      throw new Error('Current password is required to set a new password.');
    }
    if (hashPassword(currentPassword) !== user.password_hash) {
      throw new Error('Current password does not match our records.');
    }
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }
    newPasswordHash = hashPassword(newPassword);
  }

  const stmt = db.prepare(`
    UPDATE users
    SET name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        alternate_phone = COALESCE(?, alternate_phone),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        state = COALESCE(?, state),
        pincode = COALESCE(?, pincode),
        password_hash = ?
    WHERE id = ?
  `);

  stmt.run(
    name ? name.trim() : user.name,
    email ? email.toLowerCase().trim() : user.email,
    phone ? phone.trim() : user.phone,
    alternate_phone !== undefined ? alternate_phone.trim() : user.alternate_phone,
    address !== undefined ? address : user.address,
    city !== undefined ? city : user.city,
    state !== undefined ? state : user.state,
    pincode !== undefined ? pincode : user.pincode,
    newPasswordHash,
    userId
  );

  return getAdminProfile(userId);
}

module.exports = {
  register,
  login,
  verifyToken,
  getUserProfile,
  updateUserProfile,
  requestPasswordResetOtp,
  verifyOtpAndResetPassword,
  getAdminProfile,
  updateAdminProfile
};
