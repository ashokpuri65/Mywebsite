/**
 * Rajputi Cloth Store - Central API Client & Local Store
 */
const API = {
  baseUrl: window.location.origin,

  // Token management
  getToken() {
    return localStorage.getItem('rcs_token') || '';
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('rcs_token', token);
      document.cookie = `rcs_token=${token}; path=/; max-age=604800`;
    } else {
      localStorage.removeItem('rcs_token');
      document.cookie = 'rcs_token=; path=/; max-age=0';
    }
  },

  getUser() {
    try {
      const u = localStorage.getItem('rcs_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem('rcs_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('rcs_user');
    }
  },

  // Central Request Handler
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Server request failed');
      }
      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  // Auth Endpoints
  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(data.token);
    this.setUser(data.user);
    return data;
  },

  async register(userData) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    this.setToken(data.token);
    this.setUser(data.user);
    return data;
  },

  logout() {
    this.setToken(null);
    this.setUser(null);
  },

  async getProfile() {
    return this.request('/api/auth/me');
  },

  async forgotPassword(identifier) {
    return this.request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ identifier })
    });
  },

  async resetPassword(identifier, otp, newPassword) {
    return this.request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ identifier, otp, newPassword })
    });
  },

  async getAdminProfile() {
    return this.request('/api/admin/profile');
  },

  async updateAdminProfile(data) {
    return this.request('/api/admin/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Settings
  async getSettings() {
    return this.request('/api/settings');
  },

  async updateSettings(settings) {
    return this.request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  },

  // Categories
  async getCategories() {
    return this.request('/api/categories');
  },

  async createCategory(cat) {
    return this.request('/api/categories', {
      method: 'POST',
      body: JSON.stringify(cat)
    });
  },

  async updateCategory(id, cat) {
    return this.request(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(cat)
    });
  },

  async deleteCategory(id) {
    return this.request(`/api/categories/${id}`, {
      method: 'DELETE'
    });
  },

  // Products
  async getProducts(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/products${q ? '?' + q : ''}`);
  },

  async getProductById(id) {
    return this.request(`/api/products/${id}`);
  },

  async getLowStockProducts() {
    return this.request('/api/products/low-stock');
  },

  async createProduct(product) {
    return this.request('/api/products', {
      method: 'POST',
      body: JSON.stringify(product)
    });
  },

  async updateProduct(id, product) {
    return this.request(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(product)
    });
  },

  async deleteProduct(id) {
    return this.request(`/api/products/${id}`, {
      method: 'DELETE'
    });
  },

  // Orders & Sales
  async getOrders(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/orders${q ? '?' + q : ''}`);
  },

  async getOrderById(id) {
    return this.request(`/api/orders/${id}`);
  },

  async trackOrder(orderNumber) {
    return this.request(`/api/orders/track/${encodeURIComponent(orderNumber)}`);
  },

  async createOrder(orderData) {
    return this.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  },

  async createPosSale(saleData) {
    return this.request('/api/pos/sale', {
      method: 'POST',
      body: JSON.stringify(saleData)
    });
  },

  async updateOrderStatus(id, status) {
    return this.request(`/api/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  async recordOrderPayment(id, paymentData) {
    return this.request(`/api/orders/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify(paymentData)
    });
  },

  // Purchases
  async getPurchases(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/purchases${q ? '?' + q : ''}`);
  },

  async createPurchase(purchaseData) {
    return this.request('/api/purchases', {
      method: 'POST',
      body: JSON.stringify(purchaseData)
    });
  },

  // Inventory
  async getInventoryOverview() {
    return this.request('/api/inventory/overview');
  },

  async adjustStock(adjData) {
    return this.request('/api/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify(adjData)
    });
  },

  async getInventoryLogs(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/inventory/logs${q ? '?' + q : ''}`);
  },

  // Parties
  async getCustomers(search = '') {
    return this.request(`/api/customers${search ? '?search=' + encodeURIComponent(search) : ''}`);
  },

  async createCustomer(data) {
    return this.request('/api/customers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getCustomerLedger(id) {
    return this.request(`/api/customers/${id}/ledger`);
  },

  async getSuppliers(search = '') {
    return this.request(`/api/suppliers${search ? '?search=' + encodeURIComponent(search) : ''}`);
  },

  async createSupplier(data) {
    return this.request('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateSupplier(id, data) {
    return this.request(`/api/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async getSupplierLedger(id) {
    return this.request(`/api/suppliers/${id}/ledger`);
  },

  // Payments
  async getPayments(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/payments${q ? '?' + q : ''}`);
  },

  async recordCustomerPayment(data) {
    return this.request('/api/payments/customer', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async recordSupplierPayment(data) {
    return this.request('/api/payments/supplier', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Reports
  async getDashboardSummary() {
    return this.request('/api/reports/summary');
  },

  async getSalesReport(startDate, endDate) {
    const q = new URLSearchParams({ startDate: startDate || '', endDate: endDate || '' }).toString();
    return this.request(`/api/reports/sales?${q}`);
  },

  async getPurchaseReport(startDate, endDate) {
    const q = new URLSearchParams({ startDate: startDate || '', endDate: endDate || '' }).toString();
    return this.request(`/api/reports/purchases?${q}`);
  },

  async getProfitLossReport(startDate, endDate) {
    const q = new URLSearchParams({ startDate: startDate || '', endDate: endDate || '' }).toString();
    return this.request(`/api/reports/profit-loss?${q}`);
  },

  async getCategorySalesAnalytics() {
    return this.request('/api/reports/category-analytics');
  },

  // Reviews & Wishlist
  async getReviews(productId) {
    return this.request(`/api/reviews?productId=${productId}`);
  },

  async submitReview(data) {
    return this.request('/api/reviews', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getWishlist() {
    return this.request('/api/wishlist');
  },

  async toggleWishlist(productId) {
    return this.request('/api/wishlist/toggle', {
      method: 'POST',
      body: JSON.stringify({ productId })
    });
  }
};

// Utilities & Cart Store
const StoreUtils = {
  formatCurrency(amount) {
    return '₹' + Number(amount || 0).toLocaleString('en-IN');
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  },

  getWhatsAppLink(phone, message) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  },

  // Local Cart State
  getCart() {
    try {
      return JSON.parse(localStorage.getItem('rcs_cart')) || [];
    } catch {
      return [];
    }
  },

  saveCart(cart) {
    localStorage.setItem('rcs_cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cartUpdated'));
  },

  addToCart(product, size = 'Free Size', color = '', quantity = 1) {
    const cart = this.getCart();
    const existingIndex = cart.findIndex(item => item.id === product.id && item.selectedSize === size && item.selectedColor === color);

    if (existingIndex > -1) {
      cart[existingIndex].quantity += Number(quantity);
    } else {
      cart.push({
        id: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        mrp: product.mrp,
        image: (product.images && product.images[0]) || '',
        fabric: product.fabric,
        selectedSize: size,
        selectedColor: color || product.color,
        quantity: Number(quantity)
      });
    }

    this.saveCart(cart);
  },

  updateCartQty(index, newQty) {
    const cart = this.getCart();
    if (newQty <= 0) {
      cart.splice(index, 1);
    } else {
      cart[index].quantity = newQty;
    }
    this.saveCart(cart);
  },

  removeFromCart(index) {
    const cart = this.getCart();
    cart.splice(index, 1);
    this.saveCart(cart);
  },

  clearCart() {
    this.saveCart([]);
  },

  getCartTotals(deliveryFee = 100, freeThreshold = 1999) {
    const cart = this.getCart();
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = subtotal >= freeThreshold || subtotal === 0 ? 0 : Number(deliveryFee);
    const grandTotal = subtotal + shipping;

    return {
      totalItems,
      subtotal,
      shipping,
      grandTotal
    };
  }
};
