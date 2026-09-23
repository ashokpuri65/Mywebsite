/**
 * Rajputi Cloth Store - Admin ERP & Store Management Client Logic
 */

let adminUser = null;
let currentAdminTab = 'dashboard';
let erpSettings = {};
let allProductsList = [];
let allCategoriesList = [
  { id: 1, name: "Rajputi Bhari", slug: "rajputi-bhari" },
  { id: 2, name: "Rajputi Pure Poshak", slug: "rajputi-pure-poshak" },
  { id: 3, name: "Rajputi Hafpure Poshak", slug: "rajputi-hafpure-poshak" },
  { id: 4, name: "Rajputi Japan tora Poshak", slug: "rajputi-japan-tora-poshak" },
  { id: 5, name: "Cotton Suit", slug: "cotton-suit" },
  { id: 6, name: "Other Suit", slug: "other-suit" }
];
let allSuppliersList = [];
let allCustomersList = [];
let posCart = [];
let purchaseCart = [];
let salesChartInstance = null;
let categoryChartInstance = null;
let inventoryCategoryChartInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  await checkAdminAuth();
});

async function checkAdminAuth() {
  const token = API.getToken();
  const user = API.getUser();

  if (!token || !user || user.role !== 'admin') {
    showAdminLoginModal();
    return;
  }

  adminUser = user;
  document.getElementById('adminNameDisplay').textContent = adminUser.name;
  document.getElementById('adminAppContainer').classList.remove('hidden');
  document.getElementById('adminLoginModal').classList.add('hidden');

  await initAdminERP();
}

function showAdminLoginModal() {
  document.getElementById('adminAppContainer').classList.add('hidden');
  document.getElementById('adminLoginModal').classList.remove('hidden');
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const email = document.getElementById('adminEmailInput').value;
  const pwd = document.getElementById('adminPasswordInput').value;

  try {
    const res = await API.login(email, pwd);
    if (res.user.role !== 'admin') {
      API.logout();
      showAdminToast('Access denied. Administrator privileges required.', 'error');
      return;
    }

    adminUser = res.user;
    document.getElementById('adminNameDisplay').textContent = adminUser.name || 'Ashok Puri';
    document.getElementById('adminAppContainer').classList.remove('hidden');
    document.getElementById('adminLoginModal').classList.add('hidden');
    await initAdminERP();
    showAdminToast('Welcome to Nidhish Cloth Store Admin ERP', 'success');
  } catch (err) {
    showAdminToast(err.message || 'Admin login failed', 'error');
  }
}

function handleAdminLogout() {
  API.logout();
  window.location.reload();
}

// =========================================================================
// FORGOT PASSWORD (OTP VERIFICATION)
// =========================================================================
let forgotPasswordIdentifier = '';

function openForgotPasswordModal() {
  document.getElementById('forgotPasswordModal').classList.remove('hidden');
  document.getElementById('requestOtpForm').classList.remove('hidden');
  document.getElementById('verifyOtpForm').classList.add('hidden');
  document.getElementById('forgotIdentifierInput').value = document.getElementById('adminEmailInput').value || 'goswamiashokpuri65@gmail.com';
}

function closeForgotPasswordModal() {
  document.getElementById('forgotPasswordModal').classList.add('hidden');
  document.getElementById('requestOtpForm').classList.remove('hidden');
  document.getElementById('verifyOtpForm').classList.add('hidden');
}

async function handleSendOtp(e) {
  e.preventDefault();
  const idInput = document.getElementById('forgotIdentifierInput').value.trim();
  if (!idInput) {
    showAdminToast('Please enter your registered email or mobile number.', 'error');
    return;
  }

  const btn = document.getElementById('btnSendOtp');
  btn.disabled = true;
  btn.innerHTML = `<span class="inline-block animate-spin mr-2">⏳</span> Generating OTP...`;

  try {
    const res = await API.forgotPassword(idInput);
    if (res.success) {
      forgotPasswordIdentifier = res.identifier;
      document.getElementById('requestOtpForm').classList.add('hidden');
      document.getElementById('verifyOtpForm').classList.remove('hidden');

      const alertEl = document.getElementById('otpSentAlert');
      alertEl.innerHTML = `
        <div class="font-bold mb-1">✅ 6-Digit OTP Generated!</div>
        <div>OTP has been dispatched to <b>${res.targetEmail || idInput}</b> ${res.targetPhone ? `and <b>${res.targetPhone}</b>` : ''}.</div>
        <div class="mt-2 p-2 bg-amber-100 rounded text-amber-900 border border-amber-300 font-mono text-center text-sm font-bold">
          Verification Code: ${res.otp}
        </div>
      `;

      document.getElementById('resetOtpInput').value = res.otp;
      showAdminToast('6-digit OTP code generated successfully!', 'success');
    }
  } catch (err) {
    showAdminToast(err.message || 'Failed to request OTP.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `📲 Get 6-Digit OTP (ओटीपी भेजें)`;
  }
}

async function resendOtp() {
  if (!forgotPasswordIdentifier) {
    document.getElementById('requestOtpForm').classList.remove('hidden');
    document.getElementById('verifyOtpForm').classList.add('hidden');
    return;
  }
  try {
    const res = await API.forgotPassword(forgotPasswordIdentifier);
    if (res.success) {
      document.getElementById('resetOtpInput').value = res.otp;
      showAdminToast(`New OTP Code: ${res.otp}`, 'success');
    }
  } catch (err) {
    showAdminToast(err.message || 'Failed to resend OTP.', 'error');
  }
}

async function handleResetPasswordWithOtp(e) {
  e.preventDefault();
  const otp = document.getElementById('resetOtpInput').value.trim();
  const newPwd = document.getElementById('resetNewPasswordInput').value;
  const confirmPwd = document.getElementById('resetConfirmPasswordInput').value;

  if (newPwd !== confirmPwd) {
    showAdminToast('New password and confirmation do not match.', 'error');
    return;
  }

  if (newPwd.length < 6) {
    showAdminToast('Password must be at least 6 characters long.', 'error');
    return;
  }

  const btn = document.getElementById('btnResetPassword');
  btn.disabled = true;
  btn.innerHTML = `<span class="inline-block animate-spin mr-2">⏳</span> Resetting Password...`;

  try {
    const res = await API.resetPassword(forgotPasswordIdentifier, otp, newPwd);
    if (res.success) {
      showAdminToast('Password reset successfully! Please login with your new password.', 'success');
      closeForgotPasswordModal();
      document.getElementById('adminPasswordInput').value = newPwd;
    }
  } catch (err) {
    showAdminToast(err.message || 'Failed to reset password.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `✅ Reset Password & Login (पासवर्ड बदलें)`;
  }
}

async function initAdminERP() {
  try {
    // 1. Load Settings
    const sRes = await API.getSettings();
    if (sRes.success) {
      erpSettings = sRes.settings;
      renderAdminSettings();
    }

    // 2. Load Core Data
    await reloadCoreData();

    // 3. Switch to default tab (Dashboard)
    switchTab('dashboard');
  } catch (err) {
    console.error('Failed to init Admin ERP:', err);
  }
}

async function reloadCoreData() {
  const [pRes, cRes, supRes, custRes] = await Promise.all([
    API.getProducts({ onlyActive: false }),
    API.getCategories(),
    API.getSuppliers(),
    API.getCustomers()
  ]);

  allProductsList = pRes.products || [];
  allCategoriesList = cRes.categories || [];
  allSuppliersList = supRes.suppliers || [];
  allCustomersList = custRes.customers || [];

  renderPosCustomerSelect();
  renderPosProductPicker();
  renderPurchaseSupplierSelect();
  renderPurchaseProductSelect();
}

// Tab Switching
function switchTab(tabId) {
  currentAdminTab = tabId;

  // Update nav buttons
  document.querySelectorAll('.admin-nav-btn').forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.classList.add('bg-[#7b001c]', 'text-[#f3e5ab]', 'font-bold');
      btn.classList.remove('text-gray-300', 'hover:bg-gray-800');
    } else {
      btn.classList.remove('bg-[#7b001c]', 'text-[#f3e5ab]', 'font-bold');
      btn.classList.add('text-gray-300', 'hover:bg-gray-800');
    }
  });

  // Hide all sections
  document.querySelectorAll('.admin-tab-section').forEach(sec => sec.classList.add('hidden'));

  // Show active section
  const activeSec = document.getElementById(`tabSection-${tabId}`);
  if (activeSec) activeSec.classList.remove('hidden');

  // Trigger tab-specific loader
  if (tabId === 'dashboard') loadDashboardData();
  else if (tabId === 'pos') initPosTerminal();
  else if (tabId === 'products') loadProductsTable();
  else if (tabId === 'purchases') initPurchasesView();
  else if (tabId === 'inventory') loadInventoryView();
  else if (tabId === 'customers') loadCustomersTable();
  else if (tabId === 'suppliers') loadSuppliersTable();
  else if (tabId === 'payments') loadPaymentsTable();
  else if (tabId === 'reports') loadReportsView();
  else if (tabId === 'settings') renderAdminSettings();
  else if (tabId === 'profile') loadAdminProfile();
}

// =========================================================================
// 1. DASHBOARD
// =========================================================================
async function loadDashboardData() {
  try {
    const res = await API.getDashboardSummary();
    if (!res.summary) return;
    const s = res.summary;

    // Metrics Cards
    document.getElementById('metricTotalSales').textContent = `₹${s.sales.total_sales_amount.toLocaleString('en-IN')}`;
    document.getElementById('metricTodaySales').textContent = `₹${s.sales.today_sales_amount.toLocaleString('en-IN')} (${s.sales.today_orders_count} orders)`;
    document.getElementById('metricCustomerOutstanding').textContent = `₹${s.sales.total_customer_outstanding.toLocaleString('en-IN')}`;
    
    document.getElementById('metricTotalPurchases').textContent = `₹${s.purchases.total_purchases_amount.toLocaleString('en-IN')}`;
    document.getElementById('metricSupplierOutstanding').textContent = `₹${s.purchases.total_supplier_outstanding.toLocaleString('en-IN')}`;
    
    document.getElementById('metricStockUnits').textContent = `${s.inventory.total_stock_units} Units`;
    document.getElementById('metricStockValue').textContent = `₹${s.inventory.total_stock_cost_value.toLocaleString('en-IN')}`;
    document.getElementById('metricLowStockCount').textContent = `${s.inventory.low_stock_count} Products`;

    // Pending Orders
    document.getElementById('metricPendingOrders').textContent = `${s.sales.pending_orders_count}`;

    // Recent Orders Table
    const recentOrdersContainer = document.getElementById('dashboardRecentOrdersTable');
    if (recentOrdersContainer) {
      if (s.recent_orders.length === 0) {
        recentOrdersContainer.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-gray-500">No orders placed yet.</td></tr>`;
      } else {
        recentOrdersContainer.innerHTML = s.recent_orders.map(o => `
          <tr class="border-b border-gray-100 hover:bg-gray-50 text-xs">
            <td class="py-2.5 px-3 font-mono font-bold text-[#7b001c]">${o.order_number}</td>
            <td class="py-2.5 px-3">${o.customer_name}<div class="text-[10px] text-gray-400">${o.customer_phone}</div></td>
            <td class="py-2.5 px-3"><span class="badge-gold">${o.sale_type}</span></td>
            <td class="py-2.5 px-3 font-semibold">₹${o.grand_total.toLocaleString('en-IN')}</td>
            <td class="py-2.5 px-3"><span class="badge-maroon text-[10px]">${o.order_status}</span></td>
            <td class="py-2.5 px-3 text-right">
              <button onclick="viewOrderDetails(${o.id})" class="text-xs text-[#7b001c] font-semibold hover:underline">View / Bill</button>
            </td>
          </tr>
        `).join('');
      }
    }

    // Visual Charts (using Chart.js if loaded)
    renderDashboardCharts(s.trends);
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

function renderDashboardCharts(trends) {
  if (typeof Chart === 'undefined') return;

  // Monthly Sales Chart
  const salesCtx = document.getElementById('monthlySalesChart')?.getContext('2d');
  if (salesCtx && trends.monthly_sales) {
    if (salesChartInstance) salesChartInstance.destroy();
    salesChartInstance = new Chart(salesCtx, {
      type: 'bar',
      data: {
        labels: trends.monthly_sales.map(m => m.month),
        datasets: [{
          label: 'Total Sales (₹)',
          data: trends.monthly_sales.map(m => m.total_sales),
          backgroundColor: '#7b001c',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // Category Sales Pie Chart
  const catCtx = document.getElementById('categoryPieChart')?.getContext('2d');
  if (catCtx && trends.category_sales) {
    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(catCtx, {
      type: 'doughnut',
      data: {
        labels: trends.category_sales.map(c => c.category_name),
        datasets: [{
          data: trends.category_sales.map(c => c.total_sales),
          backgroundColor: ['#7b001c', '#d4af37', '#aa820a', '#9c0024', '#f3e5ab', '#2b2b2b']
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }
}

// =========================================================================
// 2. POS COUNTER SALES BILLING TERMINAL
// =========================================================================
function initPosTerminal() {
  posCart = [];
  renderPosCustomerSelect();
  renderPosProductPicker();
  renderPosCart();

  const barcodeInput = document.getElementById('posBarcodeItemCodeInput');
  if (barcodeInput) {
    barcodeInput.value = '';
  }
}

function renderPosCustomerSelect() {
  const select = document.getElementById('posCustomerSelect');
  if (!select) return;

  select.innerHTML = '<option value="">-- New / Walk-in Customer --</option>' + allCustomersList.map(c => `
    <option value="${c.id}" data-name="${c.name}" data-phone="${c.phone}" data-address="${c.address || ''}">${c.name} (${c.phone}) - Due: ₹${c.outstanding_balance.toLocaleString('en-IN')}</option>
  `).join('');
}

function handlePosCustomerSelectChange() {
  const select = document.getElementById('posCustomerSelect');
  if (!select) return;

  const opt = select.options[select.selectedIndex];
  if (opt && opt.value) {
    document.getElementById('posCustomerName').value = opt.dataset.name || '';
    document.getElementById('posCustomerPhone').value = opt.dataset.phone || '';
    document.getElementById('posCustomerAddress').value = opt.dataset.address || '';
  } else {
    document.getElementById('posCustomerName').value = '';
    document.getElementById('posCustomerPhone').value = '';
    document.getElementById('posCustomerAddress').value = '';
  }
}

function handlePosBarcodeScan() {
  const input = document.getElementById('posBarcodeItemCodeInput');
  if (!input) return;
  const rawCode = input.value.trim();
  if (!rawCode) {
    showAdminToast('कृपया आइटम कोड या बारकोड दर्ज करें।', 'error');
    input.focus();
    return;
  }

  const cleanCode = rawCode.toLowerCase();
  const found = allProductsList.find(p => 
    p.sku.toLowerCase() === cleanCode || 
    p.id.toString() === cleanCode ||
    p.name.toLowerCase() === cleanCode
  ) || allProductsList.find(p => p.sku.toLowerCase().includes(cleanCode));

  if (!found) {
    showAdminToast(`आइटम कोड "${rawCode}" का प्रोडक्ट नहीं मिला!`, 'error');
    input.select();
    return;
  }

  addPosItem(found.id);
  input.value = '';
  input.focus();
  showAdminToast(`जोड़ा गया: ${found.name} (Code: ${found.sku})`, 'success');
}

function renderPosProductPicker(search = '') {
  const container = document.getElementById('posProductSearchResults');
  if (!container) return;

  const filtered = allProductsList.filter(p => {
    if (!p.is_active) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    return p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term) || (p.fabric && p.fabric.toLowerCase().includes(term));
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-xs text-gray-500">No matching products in catalog.</div>`;
    return;
  }

  container.innerHTML = filtered.slice(0, 20).map(p => `
    <div onclick="addPosItem(${p.id})" class="p-2.5 bg-white border border-gray-200 hover:border-amber-400 rounded cursor-pointer transition-all flex items-center justify-between text-xs hover:shadow-sm">
      <div>
        <div class="font-semibold text-gray-800">${p.name}</div>
        <div class="text-[11px] text-gray-400">Code: <span class="font-mono text-gray-700 font-bold">${p.sku}</span> | Stock: <span class="font-bold ${p.stock_quantity <= p.low_stock_alert ? 'text-red-600' : 'text-emerald-700'}">${p.stock_quantity}</span></div>
      </div>
      <div class="text-right">
        <div class="font-bold text-[#7b001c]">₹${p.price.toLocaleString('en-IN')}</div>
        <span class="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-medium">+ Add</span>
      </div>
    </div>
  `).join('');
}

function addPosItem(productId) {
  const p = allProductsList.find(x => x.id === productId);
  if (!p) return;

  if (p.stock_quantity <= 0) {
    showAdminToast(`"${p.name}" का स्टॉक समाप्त (Out of Stock) है!`, 'error');
    return;
  }

  const existing = posCart.find(item => item.product_id === productId);
  if (existing) {
    if (existing.quantity >= p.stock_quantity) {
      showAdminToast(`स्टॉक सीमा पार: कुल केवल ${p.stock_quantity} उपलब्ध हैं।`, 'error');
      return;
    }
    existing.quantity = Math.round((existing.quantity + 1) * 100) / 100;
  } else {
    posCart.push({
      product_id: p.id,
      sku: p.sku,
      product_name: p.name,
      size: (p.sizes && p.sizes[0]) || 'Free Size',
      color: p.color || '',
      price: p.price,
      quantity: 1,
      available_stock: p.stock_quantity
    });
  }

  renderPosCart();
}

function updatePosItemQty(index, qty) {
  if (qty <= 0) {
    posCart.splice(index, 1);
  } else {
    const item = posCart[index];
    if (qty > item.available_stock) {
      showAdminToast(`केवल ${item.available_stock} यूनिट्स/मीटर स्टॉक में उपलब्ध हैं।`, 'error');
      item.quantity = item.available_stock;
    } else {
      item.quantity = Math.round(qty * 100) / 100;
    }
  }
  renderPosCart();
}

function updatePosItemPrice(index, price) {
  if (price < 0) price = 0;
  if (posCart[index]) {
    posCart[index].price = Number(price) || 0;
  }
  renderPosCart();
}

function renderPosCart() {
  const tableBody = document.getElementById('posCartTableBody');
  if (!tableBody) return;

  if (posCart.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-400 text-xs">No items in billing cart. ऊपर बारकोड/आइटम कोड डालें या लिस्ट से चुनें।</td></tr>`;
    updatePosTotals(0);
    return;
  }

  let subtotal = 0;
  tableBody.innerHTML = posCart.map((item, idx) => {
    const lineTotal = item.price * item.quantity;
    subtotal += lineTotal;
    return `
      <tr class="border-b border-gray-100 text-xs hover:bg-amber-50/20">
        <td class="py-2.5 px-2 text-center font-bold text-gray-500">${idx + 1}</td>
        <td class="py-2.5 px-2">
          <div class="font-semibold text-gray-900">${item.product_name}</div>
          <div class="text-[10px] text-gray-400 font-mono">Code: ${item.sku} ${item.size ? '| ' + item.size : ''}</div>
        </td>
        <td class="py-2.5 px-2 text-center">
          <div class="inline-flex items-center border border-gray-300 rounded bg-white shadow-sm overflow-hidden">
            <button type="button" onclick="updatePosItemQty(${idx}, ${Math.max(0, item.quantity - 1)})" class="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700">-</button>
            <input type="number" step="any" min="0.1" value="${item.quantity}" onchange="updatePosItemQty(${idx}, parseFloat(this.value) || 1)" class="w-14 text-center text-xs p-1 font-bold focus:outline-none">
            <button type="button" onclick="updatePosItemQty(${idx}, ${item.quantity + 1})" class="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700">+</button>
          </div>
        </td>
        <td class="py-2.5 px-2 text-center">
          <input type="number" step="any" min="0" value="${item.price}" onchange="updatePosItemPrice(${idx}, parseFloat(this.value) || 0)" class="w-20 text-center border border-gray-300 rounded text-xs p-1 font-semibold focus:outline-none focus:ring-1 focus:ring-[#7b001c]">
        </td>
        <td class="py-2.5 px-2 text-right font-extrabold text-gray-900">₹${lineTotal.toLocaleString('en-IN')}</td>
        <td class="py-2.5 px-2 text-center">
          <button type="button" onclick="posCart.splice(${idx}, 1); renderPosCart();" class="text-red-500 hover:text-red-700 font-bold p-1">✕</button>
        </td>
      </tr>
    `;
  }).join('');

  updatePosTotals(subtotal);
}

function updatePosTotals(subtotal) {
  const discountInput = document.getElementById('posDiscountAmount');
  const discount = Number(discountInput ? discountInput.value : 0) || 0;
  
  const taxRate = Number(erpSettings.tax_rate || 5);
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = Math.round((taxable * (taxRate / 100)) * 100) / 100;
  const grandTotal = Math.round((taxable + taxAmount) * 100) / 100;

  document.getElementById('posSubtotalDisplay').textContent = `₹${subtotal.toLocaleString('en-IN')}`;
  document.getElementById('posTaxDisplay').textContent = `₹${taxAmount.toLocaleString('en-IN')} (${taxRate}% GST)`;
  document.getElementById('posGrandTotalDisplay').textContent = `₹${grandTotal.toLocaleString('en-IN')}`;

  const paidInput = document.getElementById('posPaidAmount');
  if (paidInput && (!paidInput.value || Number(paidInput.value) > grandTotal)) {
    paidInput.value = grandTotal; // Default fully paid
  }

  const paid = Number(paidInput ? paidInput.value : grandTotal) || 0;
  const due = Math.max(0, grandTotal - paid);
  document.getElementById('posDueDisplay').textContent = `₹${due.toLocaleString('en-IN')}`;
}

async function handleCompletePosSale() {
  if (posCart.length === 0) {
    showAdminToast('कृपया बिल में सामान (Items) जोड़ें।', 'error');
    return;
  }

  const customerSelect = document.getElementById('posCustomerSelect');
  const customerId = customerSelect ? (customerSelect.value ? Number(customerSelect.value) : null) : null;
  const customerName = (document.getElementById('posCustomerName').value || '').trim();
  const customerPhone = (document.getElementById('posCustomerPhone').value || '').trim();
  const shippingAddress = (document.getElementById('posCustomerAddress').value || '').trim();
  const paymentMethod = document.getElementById('posPaymentMethod').value;
  const discount = Number(document.getElementById('posDiscountAmount').value) || 0;
  const paidAmount = Number(document.getElementById('posPaidAmount').value) || 0;
  const notes = document.getElementById('posNotes').value;

  if (!customerName || !customerPhone) {
    showAdminToast('बिल बनाने के लिए ग्राहक का नाम और मोबाइल नंबर आवश्यक है।', 'error');
    return;
  }

  const payload = {
    sale_type: 'WALK_IN',
    customer_id: customerId,
    customer_name: customerName,
    customer_phone: customerPhone,
    shipping_address: shippingAddress,
    items: posCart,
    discount_amount: discount,
    paid_amount: paidAmount,
    payment_method: paymentMethod,
    notes: notes
  };

  try {
    const res = await API.createPosSale(payload);
    if (res.success && res.sale) {
      showAdminToast(`बिल सफलतापूर्वक बन गया! Invoice: ${res.sale.order_number}`, 'success');
      await reloadCoreData();
      initPosTerminal();
      openInvoiceModal(res.sale.id);
    }
  } catch (err) {
    showAdminToast(err.message || 'Failed to complete sale', 'error');
  }
}

// =========================================================================
// 3. PRODUCTS & CATALOG MANAGEMENT
// =========================================================================
async function loadProductsTable() {
  const container = document.getElementById('adminProductsTableBody');
  if (!container) return;

  container.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-500">Loading products...</td></tr>`;

  try {
    const res = await API.getProducts({ onlyActive: false });
    allProductsList = res.products || [];

    if (allProductsList.length === 0) {
      container.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-500">No products found. Click "Add New Product" to create one.</td></tr>`;
      return;
    }

    container.innerHTML = allProductsList.map(p => `
      <tr class="border-b border-gray-100 hover:bg-gray-50 text-xs">
        <td class="py-2.5 px-3">
          <div class="flex items-center gap-2">
            <img src="${(p.images && p.images[0]) || ''}" class="w-8 h-10 object-cover rounded border border-gray-200">
            <div>
              <div class="font-semibold text-gray-900">${p.name}</div>
              <div class="text-[11px] text-gray-400 font-mono">SKU: ${p.sku}</div>
            </div>
          </div>
        </td>
        <td class="py-2.5 px-3">${p.category_name || 'Unassigned'}</td>
        <td class="py-2.5 px-3">
          <div><b>₹${p.price.toLocaleString('en-IN')}</b></div>
          <div class="text-[10px] text-gray-400">Cost: ₹${p.purchase_cost.toLocaleString('en-IN')} | MRP: ₹${p.mrp.toLocaleString('en-IN')}</div>
        </td>
        <td class="py-2.5 px-3">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${p.stock_quantity <= 0 ? 'bg-red-100 text-red-800' : (p.stock_quantity <= p.low_stock_alert ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')}">
            ${p.stock_quantity} in stock
          </span>
        </td>
        <td class="py-2.5 px-3 text-gray-600">${p.fabric || '-'}</td>
        <td class="py-2.5 px-3">
          <span class="px-2 py-0.5 rounded text-[10px] ${p.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}">
            ${p.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td class="py-2.5 px-3 text-right space-x-2">
          <button onclick="openEditProductModal(${p.id})" class="text-blue-600 hover:underline font-semibold">Edit</button>
          <button onclick="handleDeleteProduct(${p.id})" class="text-red-600 hover:underline">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    container.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-red-500">Failed to load products.</td></tr>`;
  }
}

function openAddProductModal() {
  document.getElementById('productFormModalTitle').textContent = 'Add New Royal Product';
  document.getElementById('editProductId').value = '';
  document.getElementById('prodName').value = '';
  document.getElementById('prodSku').value = `RCS-${Date.now().toString().slice(-6)}`;
  document.getElementById('prodCategory').innerHTML = allCategoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('prodPrice').value = '';
  document.getElementById('prodMrp').value = '';
  document.getElementById('prodCost').value = '';
  document.getElementById('prodStock').value = '10';
  document.getElementById('prodLowStock').value = '3';
  document.getElementById('prodFabric').value = 'Pure Thakurji';
  document.getElementById('prodColor').value = 'Maroon & Gold';
  document.getElementById('prodWorkType').value = 'Gota Patti';
  document.getElementById('prodSizes').value = 'S, M, L, XL, Free Size';
  document.getElementById('prodImages').value = 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80';
  document.getElementById('prodDescription').value = '';
  document.getElementById('prodIsFeatured').checked = true;
  document.getElementById('prodIsBestseller').checked = false;
  document.getElementById('prodIsActive').checked = true;

  document.getElementById('productFormModal').classList.remove('hidden');
}

function openEditProductModal(id) {
  const p = allProductsList.find(x => x.id === id);
  if (!p) return;

  document.getElementById('productFormModalTitle').textContent = `Edit Product: ${p.name}`;
  document.getElementById('editProductId').value = p.id;
  document.getElementById('prodName').value = p.name;
  document.getElementById('prodSku').value = p.sku;
  document.getElementById('prodCategory').innerHTML = allCategoriesList.map(c => `
    <option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>${c.name}</option>
  `).join('');
  document.getElementById('prodPrice').value = p.price;
  document.getElementById('prodMrp').value = p.mrp;
  document.getElementById('prodCost').value = p.purchase_cost;
  document.getElementById('prodStock').value = p.stock_quantity;
  document.getElementById('prodLowStock').value = p.low_stock_alert;
  document.getElementById('prodFabric').value = p.fabric || '';
  document.getElementById('prodColor').value = p.color || '';
  document.getElementById('prodWorkType').value = p.work_type || '';
  document.getElementById('prodSizes').value = (p.sizes || []).join(', ');
  document.getElementById('prodImages').value = (p.images || []).join(', ');
  document.getElementById('prodDescription').value = p.description || '';
  document.getElementById('prodIsFeatured').checked = !!p.is_featured;
  document.getElementById('prodIsBestseller').checked = !!p.is_bestseller;
  document.getElementById('prodIsActive').checked = !!p.is_active;

  document.getElementById('productFormModal').classList.remove('hidden');
}

function closeProductFormModal() {
  document.getElementById('productFormModal').classList.add('hidden');
}

async function handleProductFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editProductId').value;

  const data = {
    name: document.getElementById('prodName').value,
    sku: document.getElementById('prodSku').value,
    category_id: document.getElementById('prodCategory').value,
    price: Number(document.getElementById('prodPrice').value),
    mrp: Number(document.getElementById('prodMrp').value),
    purchase_cost: Number(document.getElementById('prodCost').value),
    stock_quantity: Number(document.getElementById('prodStock').value),
    low_stock_alert: Number(document.getElementById('prodLowStock').value),
    fabric: document.getElementById('prodFabric').value,
    color: document.getElementById('prodColor').value,
    work_type: document.getElementById('prodWorkType').value,
    sizes: document.getElementById('prodSizes').value.split(',').map(s => s.trim()),
    images: document.getElementById('prodImages').value.split(',').map(s => s.trim()),
    description: document.getElementById('prodDescription').value,
    is_featured: document.getElementById('prodIsFeatured').checked,
    is_bestseller: document.getElementById('prodIsBestseller').checked,
    is_active: document.getElementById('prodIsActive').checked
  };

  try {
    if (id) {
      await API.updateProduct(id, data);
      showAdminToast('Product updated successfully', 'success');
    } else {
      await API.createProduct(data);
      showAdminToast('New product added to catalog', 'success');
    }
    closeProductFormModal();
    await reloadCoreData();
    loadProductsTable();
  } catch (err) {
    showAdminToast(err.message || 'Failed to save product', 'error');
  }
}

async function handleDeleteProduct(id) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  try {
    await API.deleteProduct(id);
    showAdminToast('Product removed', 'info');
    await reloadCoreData();
    loadProductsTable();
  } catch (err) {
    showAdminToast(err.message || 'Cannot delete product', 'error');
  }
}

// =========================================================================
// 4. PURCHASES & PROCUREMENT
// =========================================================================
function initPurchasesView() {
  purchaseCart = [];
  const dateInput = document.getElementById('purchaseDate');
  if (dateInput) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
  const billNumInput = document.getElementById('purchaseBillNumber');
  if (billNumInput) {
    billNumInput.value = '';
  }
  const supNameInput = document.getElementById('purchaseSupplierName');
  if (supNameInput) supNameInput.value = '';
  const supPhoneInput = document.getElementById('purchaseSupplierPhone');
  if (supPhoneInput) supPhoneInput.value = '';
  const supAddrInput = document.getElementById('purchaseSupplierAddress');
  if (supAddrInput) supAddrInput.value = '';

  renderPurchasesTable();
  renderPurchaseSupplierSelect();
  renderPurchaseProductSelect();
  renderPurchaseCart();
}

async function renderPurchasesTable() {
  const container = document.getElementById('purchasesTableBody');
  if (!container) return;

  try {
    const res = await API.getPurchases();
    const purchases = res.purchases || [];

    if (purchases.length === 0) {
      container.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-gray-500">No purchases recorded yet.</td></tr>`;
      return;
    }

    container.innerHTML = purchases.map(p => {
      const itemsCount = (p.items && p.items.length) || 0;
      const totalUnits = (p.items && p.items.reduce((s, it) => s + Number(it.quantity || 0), 0)) || 0;
      return `
        <tr class="border-b border-gray-100 hover:bg-gray-50 text-xs">
          <td class="py-2.5 px-3 font-mono font-bold text-gray-800">${p.purchase_number}</td>
          <td class="py-2.5 px-3 font-mono text-amber-900 font-semibold">${p.bill_number || '-'}</td>
          <td class="py-2.5 px-3">
            <div class="font-semibold text-gray-900">${p.supplier_name || 'Supplier'}</div>
            <div class="text-[10px] text-gray-400">${p.supplier_company || ''}</div>
          </td>
          <td class="py-2.5 px-3">${StoreUtils.formatDate(p.purchase_date)}</td>
          <td class="py-2.5 px-3 text-center">
            <span class="inline-block bg-blue-50 text-blue-800 px-2 py-0.5 rounded font-bold">${itemsCount} items (${totalUnits} qty)</span>
          </td>
          <td class="py-2.5 px-3 font-semibold text-gray-900">₹${p.grand_total.toLocaleString('en-IN')}</td>
          <td class="py-2.5 px-3 text-emerald-700 font-medium">₹${p.paid_amount.toLocaleString('en-IN')}</td>
          <td class="py-2.5 px-3 text-red-600 font-bold">₹${p.due_amount.toLocaleString('en-IN')}</td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${p.payment_status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
              ${p.payment_status}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load purchases:', err);
  }
}

function renderPurchaseSupplierSelect() {
  const select = document.getElementById('purchaseSupplierSelect');
  if (!select) return;

  select.innerHTML = '<option value="">-- New Supplier / नया सप्लायर दर्ज करें --</option>' + allSuppliersList.map(s => `
    <option value="${s.id}" data-name="${s.name}" data-phone="${s.phone}" data-address="${s.address || ''}">
      ${s.name} (${s.company_name || s.name}) - Due: ₹${s.outstanding_balance.toLocaleString('en-IN')}
    </option>
  `).join('');
}

function handlePurchaseSupplierSelectChange() {
  const select = document.getElementById('purchaseSupplierSelect');
  if (!select) return;

  const opt = select.options[select.selectedIndex];
  if (opt && opt.value) {
    document.getElementById('purchaseSupplierName').value = opt.dataset.name || '';
    document.getElementById('purchaseSupplierPhone').value = opt.dataset.phone || '';
    document.getElementById('purchaseSupplierAddress').value = opt.dataset.address || '';
  } else {
    document.getElementById('purchaseSupplierName').value = '';
    document.getElementById('purchaseSupplierPhone').value = '';
    document.getElementById('purchaseSupplierAddress').value = '';
  }
}

function renderPurchaseProductSelect() {
  const select = document.getElementById('purchaseProductSelect');
  if (!select) return;

  select.innerHTML = '<option value="">-- Choose Product / कपड़ा आइटम चुनें --</option>' + allProductsList.map(p => `
    <option value="${p.id}" data-name="${p.name}" data-sku="${p.sku}" data-cost="${p.purchase_cost}">
      ${p.name} (Code: ${p.sku}) - Stock: ${p.stock_quantity}
    </option>
  `).join('');
}

function handlePurchaseProductSelectChange() {
  const select = document.getElementById('purchaseProductSelect');
  if (!select) return;
  const opt = select.options[select.selectedIndex];
  if (opt && opt.value) {
    const cost = Number(opt.dataset.cost) || 0;
    const costInput = document.getElementById('purchaseItemCost');
    if (costInput) costInput.value = cost;
  }
}

function addPurchaseItemFromSelect() {
  const select = document.getElementById('purchaseProductSelect');
  const opt = select.options[select.selectedIndex];
  if (!opt || !opt.value) {
    showAdminToast('कृपया पहले प्रोडक्ट चुनें।', 'error');
    return;
  }

  const prodId = Number(opt.value);
  const cost = Number(document.getElementById('purchaseItemCost').value) || Number(opt.dataset.cost) || 0;
  const qty = parseFloat(document.getElementById('purchaseItemQty').value) || 1;

  if (qty <= 0) {
    showAdminToast('मात्रा शून्य से अधिक होनी चाहिए।', 'error');
    return;
  }

  const existing = purchaseCart.find(it => it.product_id === prodId);
  if (existing) {
    existing.quantity = Math.round((existing.quantity + qty) * 100) / 100;
    existing.cost_price = cost;
  } else {
    purchaseCart.push({
      product_id: prodId,
      sku: opt.dataset.sku,
      product_name: opt.dataset.name,
      cost_price: cost,
      quantity: qty
    });
  }

  renderPurchaseCart();
  showAdminToast(`खरीद बिल में जोड़ा गया: ${opt.dataset.name} (${qty})`, 'success');
}

function renderPurchaseCart() {
  const tbody = document.getElementById('purchaseCartTableBody');
  if (!tbody) return;

  const totalItemsEl = document.getElementById('purchaseTotalItemsCount');
  const totalQtyEl = document.getElementById('purchaseTotalQtyDisplay');
  const totalAmountEl = document.getElementById('purchaseTotalAmountDisplay');

  if (purchaseCart.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-400 text-xs">No items added to purchase bill yet. ऊपर से प्रोडक्ट जोड़ें।</td></tr>`;
    if (totalItemsEl) totalItemsEl.textContent = '0';
    if (totalQtyEl) totalQtyEl.textContent = '0';
    if (totalAmountEl) totalAmountEl.textContent = '₹0';
    return;
  }

  let totalCost = 0;
  let totalUnits = 0;

  tbody.innerHTML = purchaseCart.map((item, idx) => {
    const lineTotal = item.cost_price * item.quantity;
    totalCost += lineTotal;
    totalUnits += item.quantity;

    return `
      <tr class="border-b border-gray-100 text-xs hover:bg-slate-50">
        <td class="py-2.5 px-3 text-center font-bold text-gray-500">${idx + 1}</td>
        <td class="py-2.5 px-3">
          <div class="font-semibold text-gray-900">${item.product_name}</div>
          <div class="text-[10px] text-gray-400 font-mono">Code: ${item.sku || '-'}</div>
        </td>
        <td class="py-2.5 px-3 text-center">
          <input type="number" step="any" min="0.1" value="${item.quantity}" onchange="purchaseCart[${idx}].quantity = parseFloat(this.value) || 1; renderPurchaseCart();" class="w-20 text-center border border-gray-300 rounded text-xs p-1.5 font-bold focus:ring-1 focus:ring-[#7b001c]">
        </td>
        <td class="py-2.5 px-3 text-center">
          <input type="number" step="any" min="0" value="${item.cost_price}" onchange="purchaseCart[${idx}].cost_price = parseFloat(this.value) || 0; renderPurchaseCart();" class="w-24 text-center border border-gray-300 rounded text-xs p-1.5 font-semibold focus:ring-1 focus:ring-[#7b001c]">
        </td>
        <td class="py-2.5 px-3 text-right font-extrabold text-gray-900">₹${lineTotal.toLocaleString('en-IN')}</td>
        <td class="py-2.5 px-3 text-center">
          <button type="button" onclick="purchaseCart.splice(${idx}, 1); renderPurchaseCart();" class="text-red-500 hover:text-red-700 font-bold p-1">✕</button>
        </td>
      </tr>
    `;
  }).join('');

  const discount = Number(document.getElementById('purchaseDiscount').value) || 0;
  const grandTotal = Math.max(0, totalCost - discount);

  if (totalItemsEl) totalItemsEl.textContent = purchaseCart.length.toString();
  if (totalQtyEl) totalQtyEl.textContent = (Math.round(totalUnits * 100) / 100).toString();
  if (totalAmountEl) totalAmountEl.textContent = `₹${grandTotal.toLocaleString('en-IN')}`;

  const paidInput = document.getElementById('purchasePaidAmount');
  if (paidInput && (!paidInput.value || Number(paidInput.value) > grandTotal)) {
    paidInput.value = grandTotal;
  }
}

function updatePurchaseDueDisplay() {
  const discount = Number(document.getElementById('purchaseDiscount').value) || 0;
  let totalCost = 0;
  for (const item of purchaseCart) {
    totalCost += item.cost_price * item.quantity;
  }
  const grandTotal = Math.max(0, totalCost - discount);
  const paidInput = document.getElementById('purchasePaidAmount');
  const paid = Number(paidInput ? paidInput.value : grandTotal) || 0;
  const due = Math.max(0, grandTotal - paid);
  const totalAmountEl = document.getElementById('purchaseTotalAmountDisplay');
  if (totalAmountEl) totalAmountEl.textContent = `₹${grandTotal.toLocaleString('en-IN')}`;
}

async function handleSavePurchase() {
  const supplierSelect = document.getElementById('purchaseSupplierSelect');
  const supplierId = supplierSelect ? (supplierSelect.value ? Number(supplierSelect.value) : null) : null;
  const supplierName = (document.getElementById('purchaseSupplierName').value || '').trim();
  const supplierPhone = (document.getElementById('purchaseSupplierPhone').value || '').trim();
  const supplierAddress = (document.getElementById('purchaseSupplierAddress').value || '').trim();
  const purchaseDate = document.getElementById('purchaseDate').value || new Date().toISOString().slice(0, 10);
  const billNumber = (document.getElementById('purchaseBillNumber').value || '').trim();

  if (!supplierId && (!supplierName || !supplierPhone)) {
    showAdminToast('सप्लायर का चयन करें या सप्लायर का नाम और मोबाइल नंबर दर्ज करें।', 'error');
    return;
  }

  if (purchaseCart.length === 0) {
    showAdminToast('कृपया खरीद बिल में कम से कम एक सामान जोड़ें।', 'error');
    return;
  }

  const payload = {
    supplier_id: supplierId,
    supplier_name: supplierName,
    supplier_phone: supplierPhone,
    supplier_address: supplierAddress,
    bill_number: billNumber,
    purchase_date: purchaseDate,
    items: purchaseCart,
    discount: Number(document.getElementById('purchaseDiscount').value) || 0,
    paid_amount: Number(document.getElementById('purchasePaidAmount').value) || 0,
    payment_method: document.getElementById('purchasePaymentMethod').value,
    notes: document.getElementById('purchaseNotes').value
  };

  try {
    const res = await API.createPurchase(payload);
    if (res.success && res.purchase) {
      showAdminToast(`खरीद बिल सफलतापूर्वक सेव हुआ! नया स्टॉक जुड़ा। Bill: ${res.purchase.purchase_number}`, 'success');
      await reloadCoreData();
      initPurchasesView();
      switchTab('purchases');
    }
  } catch (err) {
    showAdminToast(err.message || 'Failed to save purchase', 'error');
  }
}

// =========================================================================
// 5. INVENTORY & STOCK AUDIT
// =========================================================================
async function loadInventoryView() {
  try {
    const [overviewRes, logsRes] = await Promise.all([
      API.getInventoryOverview(),
      API.getInventoryLogs({ limit: 50 })
    ]);

    // Inventory Stats
    const ov = overviewRes.overview;
    document.getElementById('invTotalProducts').textContent = ov.total_products;
    document.getElementById('invTotalUnits').textContent = ov.total_units;
    document.getElementById('invCostValue').textContent = `₹${ov.total_inventory_cost_value.toLocaleString('en-IN')}`;
    document.getElementById('invRetailValue').textContent = `₹${ov.total_inventory_retail_value.toLocaleString('en-IN')}`;
    document.getElementById('invLowStock').textContent = ov.low_stock_count;

    // Stock Audit Logs Table
    const logsTbody = document.getElementById('inventoryLogsTableBody');
    if (logsTbody && logsRes.logs) {
      logsTbody.innerHTML = logsRes.logs.map(log => `
        <tr class="border-b border-gray-100 text-xs">
          <td class="py-2.5 px-3">${StoreUtils.formatDate(log.created_at)}</td>
          <td class="py-2.5 px-3 font-semibold text-gray-800">${log.product_name}<div class="text-[10px] text-gray-400 font-mono">${log.product_sku}</div></td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${log.change_type.includes('IN') || log.change_type === 'PURCHASE' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
              ${log.change_type}
            </span>
          </td>
          <td class="py-2.5 px-3 font-bold">${log.quantity}</td>
          <td class="py-2.5 px-3">${log.previous_stock} → <b>${log.new_stock}</b></td>
          <td class="py-2.5 px-3 text-gray-500">${log.notes || log.reference_id || '-'}</td>
        </tr>
      `).join('');
    }

    // Load Category Sales Comparison Graph
    await loadInventoryCategorySalesChart();
  } catch (err) {
    console.error('Failed to load inventory:', err);
  }
}

async function loadInventoryCategorySalesChart() {
  const canvas = document.getElementById('inventoryCategorySalesChart');
  if (!canvas) return;

  try {
    const res = await API.getCategorySalesAnalytics();
    if (!res.success) return;

    const { categories, topCategory, lowestCategory, totalUnitsSold, totalRevenue } = res;

    // Update Highlights
    const topNameEl = document.getElementById('invTopCategoryName');
    const topStatsEl = document.getElementById('invTopCategoryStats');
    if (topNameEl && topStatsEl) {
      if (topCategory && topCategory.units_sold > 0) {
        topNameEl.textContent = topCategory.name;
        topStatsEl.textContent = `${topCategory.units_sold} Units Sold (₹${topCategory.revenue.toLocaleString('en-IN')})`;
      } else {
        topNameEl.textContent = 'None yet (0 sales)';
        topStatsEl.textContent = 'Awaiting sales';
      }
    }

    const lowNameEl = document.getElementById('invLowestCategoryName');
    const lowStatsEl = document.getElementById('invLowestCategoryStats');
    if (lowNameEl && lowStatsEl) {
      if (lowestCategory) {
        lowNameEl.textContent = lowestCategory.name;
        lowStatsEl.textContent = `${lowestCategory.units_sold} Units Sold (₹${lowestCategory.revenue.toLocaleString('en-IN')})`;
      } else {
        lowNameEl.textContent = '-';
        lowStatsEl.textContent = '0 Units Sold';
      }
    }

    const totalSoldEl = document.getElementById('invTotalUnitsSoldDisplay');
    const totalRevEl = document.getElementById('invTotalRevenueDisplay');
    if (totalSoldEl) totalSoldEl.textContent = `${totalUnitsSold} Units / Meters Sold`;
    if (totalRevEl) totalRevEl.textContent = `₹${totalRevenue.toLocaleString('en-IN')} Total Revenue`;

    // Render Table
    const tableBody = document.getElementById('inventoryCategoryComparisonTableBody');
    if (tableBody) {
      tableBody.innerHTML = categories.map((cat, idx) => {
        let badge = '<span class="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-700">Standard</span>';
        if (idx === 0 && cat.units_sold > 0) {
          badge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">🏆 Top Selling</span>';
        } else if (idx === categories.length - 1 && cat.units_sold === 0) {
          badge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">🔻 Lowest Selling</span>';
        } else if (cat.units_sold > 0) {
          badge = '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">Active Demand</span>';
        }

        return `
          <tr class="border-b border-gray-100 text-xs hover:bg-slate-50">
            <td class="py-2.5 px-3 font-semibold text-gray-900">${cat.name}</td>
            <td class="py-2.5 px-3 text-center font-bold text-gray-800">${cat.units_sold}</td>
            <td class="py-2.5 px-3 text-right font-semibold text-[#7b001c]">₹${cat.revenue.toLocaleString('en-IN')}</td>
            <td class="py-2.5 px-3 text-center">
              <span class="inline-block px-2 py-0.5 rounded font-medium ${cat.current_stock <= 5 ? 'bg-orange-100 text-orange-800 font-bold' : 'bg-slate-100 text-slate-800'}">
                ${cat.current_stock}
              </span>
            </td>
            <td class="py-2.5 px-3 text-center">${badge}</td>
          </tr>
        `;
      }).join('');
    }

    // Render Chart.js Bar Chart
    if (inventoryCategoryChartInstance) {
      inventoryCategoryChartInstance.destroy();
    }

    const labels = categories.map(c => c.name);
    const unitsData = categories.map(c => c.units_sold);
    const revenueData = categories.map(c => c.revenue);

    const ctx = canvas.getContext('2d');
    inventoryCategoryChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'बिक्री मात्रा / मीटर (Units Sold)',
            data: unitsData,
            backgroundColor: '#7b001c',
            borderColor: '#520013',
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y'
          },
          {
            label: 'बिक्री राशि ₹ (Revenue)',
            data: revenueData,
            backgroundColor: '#d4af37',
            borderColor: '#b8941f',
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 10, weight: 'bold' }
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Units / Meters Sold',
              font: { size: 10 }
            },
            grid: { color: '#f1f5f9' },
            ticks: { stepSize: 1 }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Revenue (₹)',
              font: { size: 10 }
            },
            grid: { drawOnChartArea: false },
            ticks: {
              callback: function(val) {
                return '₹' + val.toLocaleString('en-IN');
              }
            }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, font: { size: 11, weight: 'bold' } }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                if (context.datasetIndex === 0) {
                  return `बिक्री मात्रा: ${context.parsed.y} Units/Meters`;
                } else {
                  return `कुल बिक्री: ₹${context.parsed.y.toLocaleString('en-IN')}`;
                }
              }
            }
          }
        }
      }
    });

  } catch (err) {
    console.error('Failed to load category sales analytics:', err);
  }
}

function openStockAdjustmentModal() {
  const select = document.getElementById('adjProductSelect');
  select.innerHTML = allProductsList.map(p => `
    <option value="${p.id}">${p.name} (Current Stock: ${p.stock_quantity})</option>
  `).join('');
  document.getElementById('stockAdjustmentModal').classList.remove('hidden');
}

function closeStockAdjustmentModal() {
  document.getElementById('stockAdjustmentModal').classList.add('hidden');
}

async function handleStockAdjustmentSubmit(e) {
  e.preventDefault();
  const payload = {
    productId: Number(document.getElementById('adjProductSelect').value),
    adjustmentType: document.getElementById('adjType').value,
    quantity: Number(document.getElementById('adjQuantity').value),
    notes: document.getElementById('adjNotes').value
  };

  try {
    await API.adjustStock(payload);
    showAdminToast('Stock adjusted successfully', 'success');
    closeStockAdjustmentModal();
    await reloadCoreData();
    loadInventoryView();
  } catch (err) {
    showAdminToast(err.message || 'Stock adjustment failed', 'error');
  }
}

// =========================================================================
// 6. CUSTOMER & SUPPLIER LEDGERS
// =========================================================================
async function loadCustomersTable() {
  const tbody = document.getElementById('customersTableBody');
  if (!tbody) return;

  try {
    const res = await API.getCustomers();
    allCustomersList = res.customers || [];

    tbody.innerHTML = allCustomersList.map(c => `
      <tr class="border-b border-gray-100 hover:bg-gray-50 text-xs">
        <td class="py-2.5 px-3 font-semibold text-gray-900">${c.name}</td>
        <td class="py-2.5 px-3">${c.phone}</td>
        <td class="py-2.5 px-3">${c.city || '-'}, ${c.state || '-'}</td>
        <td class="py-2.5 px-3">${c.total_orders} Orders</td>
        <td class="py-2.5 px-3 font-semibold">₹${c.total_purchases.toLocaleString('en-IN')}</td>
        <td class="py-2.5 px-3 text-red-600 font-bold">₹${c.outstanding_balance.toLocaleString('en-IN')}</td>
        <td class="py-2.5 px-3 text-right space-x-2">
          <button onclick="openCustomerLedgerModal(${c.id})" class="text-[#7b001c] font-semibold hover:underline">Ledger</button>
          <button onclick="openRecordPaymentModal('CUSTOMER', ${c.id}, '${c.name}', ${c.outstanding_balance})" class="text-emerald-700 font-semibold hover:underline">+ Payment</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load customers:', err);
  }
}

async function loadSuppliersTable() {
  const tbody = document.getElementById('suppliersTableBody');
  if (!tbody) return;

  try {
    const res = await API.getSuppliers();
    allSuppliersList = res.suppliers || [];

    if (allSuppliersList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-gray-500">No suppliers registered yet. "Record New Purchase" से नया सप्लायर जोड़ें।</td></tr>`;
      return;
    }

    tbody.innerHTML = allSuppliersList.map(s => `
      <tr class="border-b border-gray-100 hover:bg-gray-50 text-xs">
        <td class="py-2.5 px-3">
          <div class="font-semibold text-gray-900">${s.name}</div>
          <div class="text-[10px] text-gray-400">${s.company_name || ''} ${s.gstin ? '| GST: ' + s.gstin : ''}</div>
        </td>
        <td class="py-2.5 px-3">
          <div class="font-medium text-gray-800">${s.phone}</div>
          <div class="text-[10px] text-gray-400">${s.address || s.city || '-'}</div>
        </td>
        <td class="py-2.5 px-3 text-center">
          <span class="inline-block bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded font-bold">${s.total_items_purchased || 0} Units/Meters</span>
        </td>
        <td class="py-2.5 px-3 text-center">
          <span class="text-gray-600 font-semibold">${s.total_bills || 0} Bills</span>
        </td>
        <td class="py-2.5 px-3 font-semibold text-gray-900">₹${s.total_purchases.toLocaleString('en-IN')}</td>
        <td class="py-2.5 px-3 text-emerald-700 font-medium">₹${s.total_paid.toLocaleString('en-IN')}</td>
        <td class="py-2.5 px-3 text-red-600 font-extrabold text-sm">₹${s.outstanding_balance.toLocaleString('en-IN')}</td>
        <td class="py-2.5 px-3 text-right space-x-2">
          <button onclick="openSupplierLedgerModal(${s.id})" class="text-[#7b001c] font-semibold hover:underline">Ledger (खाता)</button>
          <button onclick="openRecordPaymentModal('SUPPLIER', ${s.id}, '${s.name}', ${s.outstanding_balance})" class="text-blue-700 font-semibold hover:underline">+ Pay</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load suppliers:', err);
  }
}

async function openCustomerLedgerModal(customerId) {
  try {
    const res = await API.getCustomerLedger(customerId);
    const { customer, totalPurchases, totalPaid, outstandingBalance, orders, payments } = res;

    document.getElementById('ledgerModalTitle').textContent = `Customer Ledger: ${customer.name}`;
    document.getElementById('ledgerPartyInfo').innerHTML = `
      <div><b>Phone:</b> ${customer.phone} | <b>Address:</b> ${customer.address || ''}, ${customer.city || ''}</div>
      <div class="mt-1 flex flex-wrap gap-4 text-xs">
        <span>Total Sales: <b>₹${totalPurchases.toLocaleString('en-IN')}</b></span>
        <span>Total Paid: <b class="text-emerald-700">₹${totalPaid.toLocaleString('en-IN')}</b></span>
        <span>Current Outstanding: <b class="text-red-600">₹${outstandingBalance.toLocaleString('en-IN')}</b></span>
      </div>
    `;

    const ordersTable = document.getElementById('ledgerOrdersTable');
    ordersTable.innerHTML = orders.map(o => `
      <tr class="border-b border-gray-100 text-xs">
        <td class="py-2 px-2 font-mono font-bold">${o.order_number}</td>
        <td class="py-2 px-2">${StoreUtils.formatDate(o.created_at)}</td>
        <td class="py-2 px-2">₹${o.grand_total.toLocaleString('en-IN')}</td>
        <td class="py-2 px-2 text-emerald-700">₹${o.paid_amount.toLocaleString('en-IN')}</td>
        <td class="py-2 px-2 text-red-600 font-bold">₹${o.due_amount.toLocaleString('en-IN')}</td>
        <td class="py-2 px-2"><span class="badge-maroon text-[10px]">${o.payment_status}</span></td>
      </tr>
    `).join('');

    const paymentsTable = document.getElementById('ledgerPaymentsTable');
    paymentsTable.innerHTML = payments.map(p => `
      <tr class="border-b border-gray-100 text-xs">
        <td class="py-2 px-2">${StoreUtils.formatDate(p.payment_date)}</td>
        <td class="py-2 px-2 font-mono">${p.reference_id}</td>
        <td class="py-2 px-2 font-bold text-emerald-700">₹${p.amount.toLocaleString('en-IN')}</td>
        <td class="py-2 px-2">${p.payment_method}</td>
        <td class="py-2 px-2 text-gray-500">${p.notes || '-'}</td>
      </tr>
    `).join('');

    document.getElementById('partyLedgerModal').classList.remove('hidden');
  } catch (err) {
    showAdminToast('Failed to open customer ledger', 'error');
  }
}

async function openSupplierLedgerModal(supplierId) {
  try {
    const res = await API.getSupplierLedger(supplierId);
    const { supplier, purchases, payments } = res;

    document.getElementById('ledgerModalTitle').textContent = `Supplier Ledger: ${supplier.name} (${supplier.company_name || supplier.name})`;
    document.getElementById('ledgerPartyInfo').innerHTML = `
      <div><b>Phone:</b> ${supplier.phone} | <b>Address:</b> ${supplier.address || ''}, ${supplier.city || ''}</div>
      <div class="mt-1 flex flex-wrap gap-4 text-xs">
        <span>Total Items Purchased: <b class="text-blue-700 font-bold">${supplier.total_items_purchased || 0} Units/Meters</b></span>
        <span>Total Purchases: <b>₹${supplier.total_purchases.toLocaleString('en-IN')}</b></span>
        <span>Total Paid: <b class="text-emerald-700">₹${supplier.total_paid.toLocaleString('en-IN')}</b></span>
        <span>Outstanding Due: <b class="text-red-600 font-bold">₹${supplier.outstanding_balance.toLocaleString('en-IN')}</b></span>
      </div>
    `;

    const ordersTable = document.getElementById('ledgerOrdersTable');
    ordersTable.innerHTML = purchases.map(p => `
      <tr class="border-b border-gray-100 text-xs">
        <td class="py-2 px-2 font-mono font-bold">
          ${p.purchase_number}
          ${p.bill_number ? '<div class="text-[10px] text-amber-900 font-semibold font-mono">Bill #: ' + p.bill_number + '</div>' : ''}
          ${p.items_summary ? '<div class="text-[10px] text-gray-500 font-normal mt-0.5">' + p.items_summary + '</div>' : ''}
        </td>
        <td class="py-2 px-2">${StoreUtils.formatDate(p.purchase_date)}</td>
        <td class="py-2 px-2 font-bold">₹${p.grand_total.toLocaleString('en-IN')}</td>
        <td class="py-2 px-2 text-emerald-700 font-medium">₹${p.paid_amount.toLocaleString('en-IN')}</td>
        <td class="py-2 px-2 text-red-600 font-bold">₹${p.due_amount.toLocaleString('en-IN')}</td>
        <td class="py-2 px-2"><span class="badge-maroon text-[10px]">${p.payment_status}</span></td>
      </tr>
    `).join('');

    const paymentsTable = document.getElementById('ledgerPaymentsTable');
    paymentsTable.innerHTML = payments.map(p => `
      <tr class="border-b border-gray-100 text-xs">
        <td class="py-2 px-2">${StoreUtils.formatDate(p.payment_date)}</td>
        <td class="py-2 px-2 font-mono">${p.reference_id}</td>
        <td class="py-2 px-2 font-bold text-blue-700">₹${p.amount.toLocaleString('en-IN')}</td>
        <td class="py-2 px-2">${p.payment_method}</td>
        <td class="py-2 px-2 text-gray-500">${p.notes || '-'}</td>
      </tr>
    `).join('');

    document.getElementById('partyLedgerModal').classList.remove('hidden');
  } catch (err) {
    showAdminToast('Failed to open supplier ledger', 'error');
  }
}

function closePartyLedgerModal() {
  document.getElementById('partyLedgerModal').classList.add('hidden');
}

// Payment Voucher Modal
function openRecordPaymentModal(partyType, partyId, partyName, currentDue = 0) {
  document.getElementById('payPartyType').value = partyType;
  document.getElementById('payPartyId').value = partyId;
  document.getElementById('payPartyName').textContent = `${partyType === 'CUSTOMER' ? 'Customer' : 'Supplier'}: ${partyName}`;
  document.getElementById('payCurrentDue').textContent = `Current Due Balance: ₹${currentDue.toLocaleString('en-IN')}`;
  document.getElementById('payAmount').value = currentDue > 0 ? currentDue : '';
  document.getElementById('payNotes').value = '';
  document.getElementById('recordPaymentModal').classList.remove('hidden');
}

function closeRecordPaymentModal() {
  document.getElementById('recordPaymentModal').classList.add('hidden');
}

async function handleRecordPaymentSubmit(e) {
  e.preventDefault();
  const partyType = document.getElementById('payPartyType').value;
  const partyId = Number(document.getElementById('payPartyId').value);
  const amount = Number(document.getElementById('payAmount').value);
  const method = document.getElementById('payMethod').value;
  const notes = document.getElementById('payNotes').value;

  try {
    if (partyType === 'CUSTOMER') {
      await API.recordCustomerPayment({
        customerId: partyId,
        amount,
        paymentMethod: method,
        notes
      });
      showAdminToast('Customer payment recorded successfully!', 'success');
      loadCustomersTable();
    } else {
      await API.recordSupplierPayment({
        supplierId: partyId,
        amount,
        paymentMethod: method,
        notes
      });
      showAdminToast('Supplier disbursement recorded successfully!', 'success');
      loadSuppliersTable();
    }

    closeRecordPaymentModal();
    await reloadCoreData();
  } catch (err) {
    showAdminToast(err.message || 'Payment recording failed', 'error');
  }
}

// =========================================================================
// 7. PAYMENTS AUDIT
// =========================================================================
async function loadPaymentsTable() {
  const tbody = document.getElementById('allPaymentsTableBody');
  if (!tbody) return;

  try {
    const res = await API.getPayments();
    const payments = res.payments || [];

    tbody.innerHTML = payments.map(p => `
      <tr class="border-b border-gray-100 text-xs">
        <td class="py-2.5 px-3">${StoreUtils.formatDate(p.payment_date)}</td>
        <td class="py-2.5 px-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${p.payment_type === 'CUSTOMER_RECEIPT' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">
            ${p.payment_type === 'CUSTOMER_RECEIPT' ? 'Customer Receipt' : 'Supplier Payment'}
          </span>
        </td>
        <td class="py-2.5 px-3 font-semibold text-gray-800">${p.party_name}</td>
        <td class="py-2.5 px-3 font-bold text-gray-900">₹${p.amount.toLocaleString('en-IN')}</td>
        <td class="py-2.5 px-3">${p.payment_method}</td>
        <td class="py-2.5 px-3 font-mono text-[11px] text-gray-500">${p.reference_id}</td>
        <td class="py-2.5 px-3 text-gray-500">${p.notes || '-'}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load payments:', err);
  }
}

// =========================================================================
// 8. FINANCIAL REPORTS & ANALYTICS
// =========================================================================
async function loadReportsView() {
  await generateSalesReport();
  await generateProfitLossReport();
}

async function generateSalesReport() {
  const startDate = document.getElementById('reportStartDate')?.value || '';
  const endDate = document.getElementById('reportEndDate')?.value || '';

  try {
    const res = await API.getSalesReport(startDate, endDate);
    const { rows, totals } = res;

    document.getElementById('reportTotalSalesSum').textContent = `₹${totals.totalSales.toLocaleString('en-IN')}`;
    document.getElementById('reportTotalPaidSum').textContent = `₹${totals.totalPaid.toLocaleString('en-IN')}`;
    document.getElementById('reportTotalDueSum').textContent = `₹${totals.totalDue.toLocaleString('en-IN')}`;
    document.getElementById('reportTotalOrdersCount').textContent = `${totals.totalOrders} Orders`;

    const tbody = document.getElementById('salesReportTableBody');
    if (tbody) {
      tbody.innerHTML = rows.map(r => `
        <tr class="border-b border-gray-100 text-xs">
          <td class="py-2 px-2 font-medium">${StoreUtils.formatDate(r.sale_date)}</td>
          <td class="py-2 px-2">${r.order_count}</td>
          <td class="py-2 px-2">₹${r.subtotal_sum.toLocaleString('en-IN')}</td>
          <td class="py-2 px-2">₹${r.discount_sum.toLocaleString('en-IN')}</td>
          <td class="py-2 px-2">₹${r.tax_sum.toLocaleString('en-IN')}</td>
          <td class="py-2 px-2 font-bold text-gray-900">₹${r.grand_total_sum.toLocaleString('en-IN')}</td>
          <td class="py-2 px-2 text-emerald-700">₹${r.paid_sum.toLocaleString('en-IN')}</td>
          <td class="py-2 px-2 text-red-600 font-bold">₹${r.due_sum.toLocaleString('en-IN')}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to generate sales report:', err);
  }
}

async function generateProfitLossReport() {
  const startDate = document.getElementById('reportStartDate')?.value || '';
  const endDate = document.getElementById('reportEndDate')?.value || '';

  try {
    const pl = await API.getProfitLossReport(startDate, endDate);
    document.getElementById('plRevenue').textContent = `₹${pl.revenue.toLocaleString('en-IN')}`;
    document.getElementById('plCogs').textContent = `₹${pl.costOfGoodsSold.toLocaleString('en-IN')}`;
    document.getElementById('plGrossProfit').textContent = `₹${pl.grossProfit.toLocaleString('en-IN')}`;
    document.getElementById('plDiscounts').textContent = `₹${pl.discountsGiven.toLocaleString('en-IN')}`;
    document.getElementById('plNetProfit').textContent = `₹${pl.netProfit.toLocaleString('en-IN')}`;
    document.getElementById('plMargin').textContent = `${pl.profitMarginPercent}%`;
  } catch (err) {
    console.error('Failed to load P&L:', err);
  }
}

function exportSalesReportToCSV() {
  const table = document.getElementById('salesReportTable');
  if (!table) return;

  let csv = [];
  const rows = table.querySelectorAll('tr');
  for (const row of rows) {
    const cols = row.querySelectorAll('th, td');
    const rowData = [];
    for (const col of cols) {
      rowData.push(`"${col.innerText.replace(/"/g, '""')}"`);
    }
    csv.push(rowData.join(','));
  }

  const csvContent = 'data:text/csv;charset=utf-8,' + csv.join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `sales_report_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// =========================================================================
// 9. GST TAX INVOICE GENERATION & PRINT
// =========================================================================
async function openInvoiceModal(orderId) {
  try {
    const res = await API.getOrderById(orderId);
    if (!res.order) return;
    const o = res.order;

    document.getElementById('invStoreName').textContent = erpSettings.store_name || 'NIDHISH CLOTH STORE';
    document.getElementById('invStoreAddress').textContent = erpSettings.address || 'Clock Tower Road, Jodhpur, Rajasthan';
    document.getElementById('invStoreGstin').textContent = `GSTIN: ${erpSettings.gstin || '08AAACR1234R1ZP'}`;
    document.getElementById('invStorePhone').textContent = `Phone: ${erpSettings.phone || 'Prem Puri: 9131974022 | Ashok Puri: 9672806509'}`;

    document.getElementById('invNumber').textContent = o.order_number;
    document.getElementById('invDate').textContent = StoreUtils.formatDate(o.created_at);
    document.getElementById('invSaleType').textContent = o.sale_type === 'WALK_IN' ? 'Walk-in Counter Sale' : 'Online Store Order';

    document.getElementById('invCustName').textContent = o.customer_name;
    document.getElementById('invCustPhone').textContent = o.customer_phone;
    document.getElementById('invCustAddress').textContent = `${o.shipping_address || ''} ${o.city ? ', ' + o.city : ''} ${o.state ? ', ' + o.state : ''} ${o.pincode || ''}`.trim() || 'Counter Walk-in';

    const tbody = document.getElementById('invItemsTableBody');
    tbody.innerHTML = (o.items || []).map((item, i) => `
      <tr class="border-b border-gray-200 text-xs">
        <td class="py-2 px-2 text-center font-bold text-gray-500">${i + 1}</td>
        <td class="py-2 px-2 font-medium">
          <div class="font-semibold text-gray-900">${item.product_name}</div>
          <div class="text-[10px] text-gray-500 font-mono">Code: ${item.sku} ${item.size ? '| Size: ' + item.size : ''}</div>
        </td>
        <td class="py-2 px-2 text-center font-bold text-gray-800">${item.quantity}</td>
        <td class="py-2 px-2 text-right">₹${item.price.toLocaleString('en-IN')}</td>
        <td class="py-2 px-2 text-right font-extrabold text-gray-900">₹${item.total.toLocaleString('en-IN')}</td>
      </tr>
    `).join('');

    document.getElementById('invSubtotal').textContent = `₹${o.subtotal.toLocaleString('en-IN')}`;
    document.getElementById('invDiscount').textContent = `₹${(o.discount_amount || 0).toLocaleString('en-IN')}`;
    document.getElementById('invTax').textContent = `₹${(o.tax_amount || 0).toLocaleString('en-IN')}`;
    document.getElementById('invGrandTotal').textContent = `₹${o.grand_total.toLocaleString('en-IN')}`;
    document.getElementById('invPaidAmount').textContent = `₹${o.paid_amount.toLocaleString('en-IN')}`;
    document.getElementById('invDueAmount').textContent = `₹${o.due_amount.toLocaleString('en-IN')}`;
    document.getElementById('invPaymentMethod').textContent = o.payment_method;

    // UPI QR Code
    const upiUrl = `upi://pay?pa=${erpSettings.upi_id || '9672806509@upi'}&pn=${encodeURIComponent(erpSettings.store_name || 'Nidhish Cloth Store')}&am=${o.due_amount > 0 ? o.due_amount : o.grand_total}&cu=INR`;
    const qrImg = document.getElementById('invUpiQr');
    if (qrImg) {
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(upiUrl)}`;
    }

    // WhatsApp Send Button in Modal
    const waMsg = `Khamma Ghani ${o.customer_name}! Your invoice for Order ${o.order_number} from ${erpSettings.store_name || 'Nidhish Cloth Store'} is ready. Grand Total: ₹${o.grand_total.toLocaleString('en-IN')}. Thank you for shopping with us!`;
    const waShareBtn = document.getElementById('invWhatsAppShareBtn');
    if (waShareBtn) {
      waShareBtn.href = StoreUtils.getWhatsAppLink(o.customer_phone, waMsg);
    }

    document.getElementById('invoiceModal').classList.remove('hidden');
  } catch (err) {
    showAdminToast('Failed to generate invoice', 'error');
  }
}

function closeInvoiceModal() {
  document.getElementById('invoiceModal').classList.add('hidden');
}

function printCurrentInvoice() {
  window.print();
}

// =========================================================================
// 10. STORE SETTINGS
// =========================================================================
function renderAdminSettings() {
  if (!erpSettings) return;
  document.getElementById('settStoreName').value = erpSettings.store_name || '';
  document.getElementById('settTagline').value = erpSettings.tagline || '';
  document.getElementById('settPhone').value = erpSettings.phone || '';
  document.getElementById('settWhatsapp').value = erpSettings.whatsapp || '';
  document.getElementById('settEmail').value = erpSettings.email || '';
  document.getElementById('settAddress').value = erpSettings.address || '';
  document.getElementById('settGstin').value = erpSettings.gstin || '';
  document.getElementById('settDeliveryFee').value = erpSettings.delivery_charge || '100';
  document.getElementById('settFreeDelivery').value = erpSettings.free_delivery_threshold || '1999';
  document.getElementById('settTaxRate').value = erpSettings.tax_rate || '5';
  document.getElementById('settUpiId').value = erpSettings.upi_id || '';
}

async function handleSaveSettingsSubmit(e) {
  e.preventDefault();
  const settingsObj = {
    store_name: document.getElementById('settStoreName').value,
    tagline: document.getElementById('settTagline').value,
    phone: document.getElementById('settPhone').value,
    whatsapp: document.getElementById('settWhatsapp').value,
    email: document.getElementById('settEmail').value,
    address: document.getElementById('settAddress').value,
    gstin: document.getElementById('settGstin').value,
    delivery_charge: document.getElementById('settDeliveryFee').value,
    free_delivery_threshold: document.getElementById('settFreeDelivery').value,
    tax_rate: document.getElementById('settTaxRate').value,
    upi_id: document.getElementById('settUpiId').value
  };

  try {
    const res = await API.updateSettings(settingsObj);
    if (res.success) {
      erpSettings = res.settings;
      showAdminToast('Store settings updated successfully!', 'success');
    }
  } catch (err) {
    showAdminToast(err.message || 'Failed to update settings', 'error');
  }
}

// =========================================================================
// 11. ADMIN PROFILE MANAGEMENT
// =========================================================================
async function loadAdminProfile() {
  try {
    const res = await API.getAdminProfile();
    if (res.success && res.profile) {
      const p = res.profile;
      document.getElementById('profAdminName').value = p.name || 'Ashok Puri';
      document.getElementById('profAdminEmail').value = p.email || 'goswamiashokpuri65@gmail.com';
      document.getElementById('profAdminPhone').value = p.phone || '9672806509';
      document.getElementById('profAdminAltPhone').value = p.alternate_phone || '9131974022';
      document.getElementById('profAdminAddress').value = p.address || '';
      document.getElementById('profAdminCity').value = p.city || '';
      document.getElementById('profAdminState').value = p.state || 'Rajasthan';
      document.getElementById('profAdminPincode').value = p.pincode || '';

      document.getElementById('profSummaryName').textContent = p.name || 'Ashok Puri';
      document.getElementById('profNoticeEmail').textContent = p.email || 'goswamiashokpuri65@gmail.com';
      document.getElementById('profNoticePhone').textContent = p.phone || '9672806509';
      document.getElementById('adminNameDisplay').textContent = p.name || 'Ashok Puri';
    }
  } catch (err) {
    showAdminToast('Failed to load admin profile', 'error');
  }
}

async function handleSaveAdminProfile(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSaveAdminProfile');
  btn.disabled = true;
  btn.innerHTML = `Saving...`;

  const payload = {
    name: document.getElementById('profAdminName').value.trim(),
    email: document.getElementById('profAdminEmail').value.trim(),
    phone: document.getElementById('profAdminPhone').value.trim(),
    alternate_phone: document.getElementById('profAdminAltPhone').value.trim(),
    address: document.getElementById('profAdminAddress').value.trim(),
    city: document.getElementById('profAdminCity').value.trim(),
    state: document.getElementById('profAdminState').value.trim(),
    pincode: document.getElementById('profAdminPincode').value.trim()
  };

  try {
    const res = await API.updateAdminProfile(payload);
    if (res.success && res.profile) {
      adminUser = { ...adminUser, ...res.profile };
      document.getElementById('adminNameDisplay').textContent = res.profile.name;
      document.getElementById('profSummaryName').textContent = res.profile.name;
      document.getElementById('profNoticeEmail').textContent = res.profile.email;
      document.getElementById('profNoticePhone').textContent = res.profile.phone;
      showAdminToast('Admin profile details updated successfully!', 'success');
    }
  } catch (err) {
    showAdminToast(err.message || 'Failed to update profile.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `Save Profile Changes`;
  }
}

async function handleChangeAdminPassword(e) {
  e.preventDefault();
  const cur = document.getElementById('profCurrentPassword').value;
  const nw = document.getElementById('profNewPassword').value;
  const cf = document.getElementById('profConfirmPassword').value;

  if (nw !== cf) {
    showAdminToast('New password and confirmation do not match.', 'error');
    return;
  }

  if (nw.length < 6) {
    showAdminToast('New password must be at least 6 characters long.', 'error');
    return;
  }

  const btn = document.getElementById('btnChangePassword');
  btn.disabled = true;
  btn.innerHTML = `Updating Password...`;

  try {
    const res = await API.updateAdminProfile({
      currentPassword: cur,
      newPassword: nw
    });
    if (res.success) {
      document.getElementById('profCurrentPassword').value = '';
      document.getElementById('profNewPassword').value = '';
      document.getElementById('profConfirmPassword').value = '';
      document.getElementById('adminPasswordInput').value = nw;
      showAdminToast('Admin password changed successfully!', 'success');
    }
  } catch (err) {
    showAdminToast(err.message || 'Failed to change password.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `Update Password`;
  }
}

// Toast Notification
function showAdminToast(message, type = 'info') {
  const container = document.getElementById('adminToastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-[#7b001c] text-white border-amber-400' : (type === 'error' ? 'bg-red-700 text-white border-red-400' : 'bg-gray-900 text-white border-gray-600');
  toast.className = `flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-xs font-medium border transform transition-all duration-300 translate-y-2 opacity-0 ${bgClass}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '👑' : (type === 'error' ? '⚠️' : 'ℹ️')}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
