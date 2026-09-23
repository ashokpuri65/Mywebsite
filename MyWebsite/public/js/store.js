/**
 * Rajputi Cloth Store - Customer Storefront Logic
 */

let appSettings = {};
let allCategories = [
  { id: 1, name: "Rajputi Bhari", slug: "rajputi-bhari" },
  { id: 2, name: "Rajputi Pure Poshak", slug: "rajputi-pure-poshak" },
  { id: 3, name: "Rajputi Hafpure Poshak", slug: "rajputi-hafpure-poshak" },
  { id: 4, name: "Rajputi Japan tora Poshak", slug: "rajputi-japan-tora-poshak" },
  { id: 5, name: "Cotton Suit", slug: "cotton-suit" },
  { id: 6, name: "Other Suit", slug: "other-suit" }
];
let currentCategoryFilter = '';
let currentSearch = '';
let currentSort = 'newest';
let currentMinPrice = '';
let currentMaxPrice = '';
let currentInStockOnly = false;
let selectedProductForModal = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initStore();
  setupEventListeners();
  updateCartBadge();
  updateAuthUI();
});

async function initStore() {
  try {
    // 1. Fetch Store Settings
    const settingsRes = await API.getSettings();
    if (settingsRes.success) {
      appSettings = settingsRes.settings;
      renderStoreInfo();
    }

    // 2. Fetch Categories
    const catRes = await API.getCategories();
    if (catRes.success) {
      allCategories = catRes.categories;
      renderCategories();
    }

    // 3. Fetch Featured & Catalog Products
    await loadProducts();
    await loadFeaturedSections();
  } catch (err) {
    console.error('Failed to initialize storefront:', err);
  }
}

function renderStoreInfo() {
  // Update store titles, phones, WhatsApp links in header & footer
  const nameEls = document.querySelectorAll('.store-title-text');
  nameEls.forEach(el => el.textContent = appSettings.store_name || 'NIDHISH CLOTH STORE');

  const phoneEls = document.querySelectorAll('.store-phone-text');
  phoneEls.forEach(el => el.textContent = appSettings.phone || 'Prem Puri: 9131974022 | Ashok Puri: 9672806509');

  const addressEls = document.querySelectorAll('.store-address-text');
  addressEls.forEach(el => el.textContent = appSettings.address || 'Clock Tower Road, Jodhpur, Rajasthan');

  const emailEls = document.querySelectorAll('.store-email-text');
  emailEls.forEach(el => el.textContent = appSettings.email || 'goswamiashokpuri65@gmail.com');

  // Update floating WhatsApp link
  const waBtn = document.getElementById('whatsappFloatingBtn');
  if (waBtn) {
    waBtn.href = StoreUtils.getWhatsAppLink(
      appSettings.whatsapp || '9672806509',
      `Khamma Ghani! I would like to inquire about traditional royal collection at ${appSettings.store_name || 'Nidhish Cloth Store'}.`
    );
  }
}

function renderCategories() {
  const container = document.getElementById('categoriesGrid');
  if (!container) return;

  container.innerHTML = allCategories.map(cat => `
    <div onclick="filterByCategory('${cat.slug}')" class="cursor-pointer group flex flex-col items-center p-3 sm:p-4 bg-white rounded-lg border border-amber-100 hover:border-amber-400 hover:shadow-lg transition-all duration-300">
      <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-amber-300 p-0.5 mb-2 shadow-sm group-hover:scale-105 transition-transform duration-300 bg-[#fdfbf7]">
        <img src="${cat.image_url || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=300&q=80'}" alt="${cat.name}" class="w-full h-full object-cover rounded-full">
      </div>
      <span class="text-xs sm:text-sm font-medium text-center text-gray-800 group-hover:text-[#7b001c] transition-colors">${cat.name}</span>
    </div>
  `).join('');

  // Also populate category filter dropdown
  const select = document.getElementById('categoryFilterSelect');
  if (select && allCategories && allCategories.length > 0) {
    const curVal = select.value || currentCategoryFilter || '';
    select.innerHTML = '<option value="">All Royal Categories (सभी श्रेणियां)</option>' + allCategories.map(cat => `
      <option value="${cat.slug}" ${cat.slug === curVal ? 'selected' : ''}>${cat.name}</option>
    `).join('');
    if (curVal) select.value = curVal;
  }
}

async function loadProducts() {
  const container = document.getElementById('productsGrid');
  if (!container) return;

  container.innerHTML = `
    <div class="col-span-full py-16 text-center text-gray-500">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-600 border-t-transparent mb-3"></div>
      <p class="font-serif">Loading royal collection...</p>
    </div>
  `;

  try {
    const filters = {};
    if (currentCategoryFilter) filters.categorySlug = currentCategoryFilter;
    if (currentSearch) filters.search = currentSearch;
    if (currentSort) filters.sort = currentSort;
    if (currentMinPrice) filters.minPrice = currentMinPrice;
    if (currentMaxPrice) filters.maxPrice = currentMaxPrice;
    if (currentInStockOnly) filters.inStock = true;

    const res = await API.getProducts(filters);
    const products = res.products || [];

    const countEl = document.getElementById('productResultsCount');
    if (countEl) countEl.textContent = `${products.length} Products Found`;

    if (products.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center bg-white rounded-xl border border-amber-200 p-8 shadow-sm">
          <span class="text-5xl mb-3 block">👑</span>
          <h3 class="text-lg font-royal text-[#7b001c] font-semibold mb-2">Welcome! Store is starting from 0</h3>
          <p class="text-gray-500 text-xs sm:text-sm max-w-md mx-auto mb-5">अभी स्टोर में कोई प्रोडक्ट नहीं है। एडमिन पैनल से नए प्रोडक्ट्स, तस्वीरें, साइज़ और कीमतें जोड़ी जा सकती हैं।</p>
          <a href="/admin" class="btn-royal-maroon px-6 py-2.5 rounded-full text-xs font-semibold inline-flex items-center gap-2 shadow">
            <span>Admin ERP Panel में जाएं (+ Add Products) →</span>
          </a>
        </div>
      `;
      return;
    }

    container.innerHTML = products.map(renderProductCard).join('');
  } catch (err) {
    container.innerHTML = `<div class="col-span-full text-center text-red-600 py-10">Failed to load products. Please check connection.</div>`;
  }
}

async function loadFeaturedSections() {
  try {
    // 1. Best Sellers
    const bestSellersRes = await API.getProducts({ isBestseller: true, limit: 4 });
    const bestSellerContainer = document.getElementById('bestsellerGrid');
    if (bestSellerContainer) {
      if (bestSellersRes.products && bestSellersRes.products.length > 0) {
        bestSellerContainer.innerHTML = bestSellersRes.products.map(renderProductCard).join('');
      } else {
        bestSellerContainer.innerHTML = `
          <div class="col-span-full py-8 text-center bg-white/70 rounded-xl border border-dashed border-amber-200 p-6">
            <span class="text-3xl block mb-1">👑</span>
            <h4 class="font-royal text-sm font-semibold text-[#7b001c]">शाही कलेक्शन जल्द उपलब्ध होगा</h4>
            <p class="text-xs text-gray-400 mt-1">Products added from Admin Panel will appear here.</p>
          </div>
        `;
      }
    }

    // 2. New Arrivals
    const newArrivalsRes = await API.getProducts({ isNew: true, limit: 4 });
    const newArrivalsContainer = document.getElementById('newArrivalsGrid');
    if (newArrivalsContainer) {
      if (newArrivalsRes.products && newArrivalsRes.products.length > 0) {
        newArrivalsContainer.innerHTML = newArrivalsRes.products.map(renderProductCard).join('');
      } else {
        newArrivalsContainer.innerHTML = `
          <div class="col-span-full py-8 text-center bg-white/70 rounded-xl border border-dashed border-amber-200 p-6">
            <span class="text-3xl block mb-1">✨</span>
            <h4 class="font-royal text-sm font-semibold text-[#7b001c]">शाही नया संग्रह जल्द आ रहा है</h4>
            <p class="text-xs text-gray-400 mt-1">Fresh royal arrivals arriving soon.</p>
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('Failed to load featured sections:', err);
  }
}

function renderProductCard(p) {
  const mainImage = (p.images && p.images[0]) || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80';
  const discountBadge = p.discount_percent > 0 ?
    `<span class="absolute top-2.5 left-2.5 badge-maroon shadow">- ${p.discount_percent}% OFF</span>` : '';

  const stockBadge = p.is_out_of_stock ?
    `<span class="absolute top-2.5 right-2.5 bg-gray-800 text-white text-[11px] font-semibold px-2 py-0.5 rounded">Out of Stock</span>` :
    (p.is_low_stock ? `<span class="absolute top-2.5 right-2.5 bg-amber-600 text-white text-[11px] font-semibold px-2 py-0.5 rounded">Only ${p.stock_quantity} Left</span>` : '');

  const waOrderMsg = `Khamma Ghani! I would like to order: *${p.name}* (SKU: ${p.sku}) at price *₹${p.price.toLocaleString('en-IN')}*. Please share delivery details.`;
  const waOrderUrl = StoreUtils.getWhatsAppLink(appSettings.whatsapp || '9672806509', waOrderMsg);

  return `
    <div class="product-card group flex flex-col justify-between">
      <div>
        <div class="product-image-container aspect-[3/4] relative cursor-pointer" onclick="openProductModal(${p.id})">
          <img src="${mainImage}" alt="${p.name}" class="w-full h-full object-cover">
          ${discountBadge}
          ${stockBadge}
          <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button onclick="event.stopPropagation(); openProductModal(${p.id})" class="bg-white/95 text-gray-800 hover:text-[#7b001c] p-2.5 rounded-full shadow-lg transition-transform hover:scale-110" title="Quick View">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            </button>
            <button onclick="event.stopPropagation(); toggleWishlist(${p.id})" class="bg-white/95 text-gray-800 hover:text-red-600 p-2.5 rounded-full shadow-lg transition-transform hover:scale-110" title="Add to Wishlist">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
            </button>
          </div>
        </div>

        <div class="p-4">
          <div class="text-[11px] uppercase tracking-wider text-amber-700 font-semibold mb-1">${p.category_name || 'Royal Wear'} • ${p.fabric || 'Pure Fabric'}</div>
          <h3 onclick="openProductModal(${p.id})" class="font-serif font-medium text-gray-900 text-sm line-clamp-2 hover:text-[#7b001c] cursor-pointer mb-2 transition-colors">
            ${p.name}
          </h3>

          <div class="flex items-baseline gap-2 mb-3">
            <span class="text-base font-bold text-[#7b001c]">₹${p.price.toLocaleString('en-IN')}</span>
            ${p.mrp > p.price ? `<span class="text-xs text-gray-400 line-through">₹${p.mrp.toLocaleString('en-IN')}</span>` : ''}
          </div>

          <div class="flex flex-wrap gap-1 mb-3">
            ${(p.sizes || []).slice(0, 3).map(sz => `<span class="text-[10px] bg-[#f8f3e6] text-gray-700 px-1.5 py-0.5 rounded border border-amber-200">${sz}</span>`).join('')}
            ${(p.sizes && p.sizes.length > 3) ? `<span class="text-[10px] text-gray-500 self-center">+${p.sizes.length - 3}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="px-4 pb-4 pt-0 flex flex-col gap-2">
        <button onclick="quickAddToCart(${p.id})" ${p.is_out_of_stock ? 'disabled' : ''} class="w-full ${p.is_out_of_stock ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'btn-royal-maroon'} text-xs py-2 rounded flex items-center justify-center gap-1.5 font-medium transition-all">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
          ${p.is_out_of_stock ? 'Out of Stock' : 'Add to Cart'}
        </button>

        <a href="${waOrderUrl}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-order w-full text-center text-xs py-1.5 rounded flex items-center justify-center gap-1.5 font-medium">
          <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.541 1.961.828 2.796.828 3.182 0 5.768-2.587 5.769-5.766.001-3.182-2.585-5.768-5.769-5.768zm7.391 5.765c-.002 4.075-3.318 7.39-7.393 7.39-.778 0-1.637-.152-2.399-.481l-4.103 1.077 1.096-4.004c-.383-.758-.584-1.604-.585-2.483.002-4.075 3.319-7.391 7.394-7.391 4.074.001 7.39 3.318 7.39 7.392z"/></svg>
          Order on WhatsApp
        </a>
      </div>
    </div>
  `;
}

// Quick Add to Cart
async function quickAddToCart(productId) {
  try {
    const res = await API.getProductById(productId);
    if (res.product) {
      const p = res.product;
      const defaultSize = (p.sizes && p.sizes[0]) || 'Free Size';
      StoreUtils.addToCart(p, defaultSize, p.color, 1);
      showNotification(`Added "${p.name}" to cart!`, 'success');
      updateCartBadge();
      openCartDrawer();
    }
  } catch (err) {
    showNotification('Unable to add item to cart', 'error');
  }
}

// Product Details Modal
async function openProductModal(productId) {
  try {
    const res = await API.getProductById(productId);
    if (!res.product) return;

    selectedProductForModal = res.product;
    const p = selectedProductForModal;

    document.getElementById('modalProductSku').textContent = `SKU: ${p.sku}`;
    document.getElementById('modalProductName').textContent = p.name;
    document.getElementById('modalProductCategory').textContent = p.category_name || 'Traditional Wear';
    document.getElementById('modalProductPrice').textContent = `₹${p.price.toLocaleString('en-IN')}`;
    
    const mrpEl = document.getElementById('modalProductMrp');
    if (p.mrp > p.price) {
      mrpEl.textContent = `MRP: ₹${p.mrp.toLocaleString('en-IN')}`;
      mrpEl.classList.remove('hidden');
    } else {
      mrpEl.classList.add('hidden');
    }

    const discountEl = document.getElementById('modalProductDiscount');
    if (p.discount_percent > 0) {
      discountEl.textContent = `${p.discount_percent}% OFF`;
      discountEl.classList.remove('hidden');
    } else {
      discountEl.classList.add('hidden');
    }

    document.getElementById('modalProductFabric').textContent = p.fabric || 'Pure Fabric';
    document.getElementById('modalProductWork').textContent = p.work_type || 'Royal Handcraft';
    document.getElementById('modalProductColor').textContent = p.color || 'Royal Multi';
    document.getElementById('modalProductDescription').textContent = p.description || '';

    // Stock status indicator
    const stockEl = document.getElementById('modalProductStock');
    if (p.stock_quantity <= 0) {
      stockEl.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-100 text-red-800 text-xs font-semibold">● Out of Stock</span>`;
    } else if (p.stock_quantity <= p.low_stock_alert) {
      stockEl.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-100 text-amber-800 text-xs font-semibold">● Only ${p.stock_quantity} left in stock - Order Soon!</span>`;
    } else {
      stockEl.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-semibold">● In Stock (${p.stock_quantity} available)</span>`;
    }

    // Images gallery
    const images = p.images && p.images.length > 0 ? p.images : ['https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80'];
    const mainImg = document.getElementById('modalMainImage');
    mainImg.src = images[0];

    const thumbsContainer = document.getElementById('modalThumbnails');
    thumbsContainer.innerHTML = images.map((img, idx) => `
      <img src="${img}" onclick="document.getElementById('modalMainImage').src = '${img}'" class="w-16 h-20 object-cover rounded border-2 border-amber-200 hover:border-amber-600 cursor-pointer shadow-sm transition-all">
    `).join('');

    // Sizes options
    const sizesContainer = document.getElementById('modalSizeOptions');
    sizesContainer.innerHTML = (p.sizes || ['Free Size']).map((sz, idx) => `
      <label class="cursor-pointer">
        <input type="radio" name="modalSize" value="${sz}" ${idx === 0 ? 'checked' : ''} class="peer sr-only">
        <div class="px-3.5 py-1.5 text-xs font-medium border border-gray-300 rounded peer-checked:border-[#7b001c] peer-checked:bg-[#7b001c] peer-checked:text-white transition-all">
          ${sz}
        </div>
      </label>
    `).join('');

    // Quantity reset
    document.getElementById('modalQuantity').value = 1;

    // Direct WhatsApp Button
    const waOrderBtn = document.getElementById('modalWhatsAppOrderBtn');
    const updateWaBtn = () => {
      const selectedSize = document.querySelector('input[name="modalSize"]:checked')?.value || 'Standard';
      const qty = document.getElementById('modalQuantity').value;
      const msg = `Khamma Ghani! I want to order from *${appSettings.store_name || 'Nidhish Cloth Store'}*:\n\n*Product:* ${p.name}\n*SKU:* ${p.sku}\n*Size:* ${selectedSize}\n*Color:* ${p.color}\n*Quantity:* ${qty}\n*Price:* ₹${(p.price * qty).toLocaleString('en-IN')}\n\nPlease confirm availability and payment details.`;
      waOrderBtn.href = StoreUtils.getWhatsAppLink(appSettings.whatsapp || '9672806509', msg);
    };
    updateWaBtn();

    // Listeners for size/qty update for WhatsApp URL
    document.querySelectorAll('input[name="modalSize"]').forEach(r => r.addEventListener('change', updateWaBtn));
    document.getElementById('modalQuantity').onchange = updateWaBtn;

    // Load Reviews
    await loadProductReviews(p.id);

    // Show modal
    document.getElementById('productDetailModal').classList.remove('hidden');
  } catch (err) {
    console.error('Failed to open product modal:', err);
  }
}

function closeProductModal() {
  document.getElementById('productDetailModal').classList.add('hidden');
  selectedProductForModal = null;
}

// Add to Cart from Modal
function addModalProductToCart(buyNow = false) {
  if (!selectedProductForModal) return;
  const p = selectedProductForModal;

  if (p.stock_quantity <= 0) {
    showNotification('This product is currently out of stock.', 'error');
    return;
  }

  const selectedSize = document.querySelector('input[name="modalSize"]:checked')?.value || 'Free Size';
  const qty = parseInt(document.getElementById('modalQuantity').value) || 1;

  StoreUtils.addToCart(p, selectedSize, p.color, qty);
  showNotification(`Added ${qty} item(s) to royal bag!`, 'success');
  updateCartBadge();
  closeProductModal();

  if (buyNow) {
    openCheckoutModal();
  } else {
    openCartDrawer();
  }
}

// Product Reviews
async function loadProductReviews(productId) {
  const container = document.getElementById('modalReviewsList');
  if (!container) return;

  try {
    const res = await API.getReviews(productId);
    const reviews = res.reviews || [];

    if (reviews.length === 0) {
      container.innerHTML = `<p class="text-xs text-gray-500 italic py-2">No reviews yet for this royal creation. Be the first to review!</p>`;
      return;
    }

    container.innerHTML = reviews.map(r => `
      <div class="border-b border-gray-100 pb-2.5 mb-2.5">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-semibold text-gray-800">${r.customer_name}</span>
          <span class="text-amber-500 text-xs">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
        </div>
        <p class="text-xs text-gray-600">${r.comment || ''}</p>
        <span class="text-[10px] text-gray-400">${StoreUtils.formatDate(r.created_at)}</span>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load reviews:', err);
  }
}

async function submitModalReview(e) {
  e.preventDefault();
  if (!selectedProductForModal) return;

  const name = document.getElementById('reviewAuthorName').value;
  const rating = document.getElementById('reviewRating').value;
  const comment = document.getElementById('reviewComment').value;

  try {
    await API.submitReview({
      product_id: selectedProductForModal.id,
      customer_name: name,
      rating,
      comment
    });
    showNotification('Thank you for your royal review!', 'success');
    document.getElementById('reviewComment').value = '';
    await loadProductReviews(selectedProductForModal.id);
  } catch (err) {
    showNotification(err.message || 'Failed to submit review', 'error');
  }
}

// Cart Drawer & Rendering
function openCartDrawer() {
  renderCartDrawer();
  document.getElementById('cartDrawer').classList.remove('hidden');
}

function closeCartDrawer() {
  document.getElementById('cartDrawer').classList.add('hidden');
}

function renderCartDrawer() {
  const cart = StoreUtils.getCart();
  const container = document.getElementById('cartDrawerItems');
  const totals = StoreUtils.getCartTotals(appSettings.delivery_charge || 100, appSettings.free_delivery_threshold || 1999);

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16">
        <div class="w-16 h-16 mx-auto mb-3 text-amber-300">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
        </div>
        <h4 class="font-royal text-base text-gray-800 mb-1">Your Royal Bag is Empty</h4>
        <p class="text-xs text-gray-500 mb-4">Discover royal poshaaks and heritage attire.</p>
        <button onclick="closeCartDrawer()" class="btn-royal-maroon text-xs px-5 py-2 rounded">Start Shopping</button>
      </div>
    `;
    document.getElementById('cartDrawerFooter').classList.add('hidden');
    return;
  }

  document.getElementById('cartDrawerFooter').classList.remove('hidden');

  container.innerHTML = cart.map((item, index) => `
    <div class="flex gap-3 p-3 bg-white rounded border border-amber-100 shadow-sm mb-3">
      <img src="${item.image || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=300&q=80'}" alt="${item.name}" class="w-20 h-24 object-cover rounded border border-amber-200">
      <div class="flex-1 flex flex-col justify-between">
        <div>
          <div class="flex items-start justify-between">
            <h4 class="text-xs font-semibold text-gray-900 line-clamp-1">${item.name}</h4>
            <button onclick="StoreUtils.removeFromCart(${index}); renderCartDrawer(); updateCartBadge();" class="text-gray-400 hover:text-red-600 text-sm pl-1">✕</button>
          </div>
          <div class="text-[11px] text-gray-500 mt-0.5">Size: <span class="font-medium text-gray-700">${item.selectedSize}</span> ${item.selectedColor ? `| Color: <span class="font-medium text-gray-700">${item.selectedColor}</span>` : ''}</div>
          <div class="text-xs font-bold text-[#7b001c] mt-1">₹${item.price.toLocaleString('en-IN')}</div>
        </div>

        <div class="flex items-center justify-between mt-2 pt-1 border-t border-gray-100">
          <div class="flex items-center border border-gray-300 rounded overflow-hidden">
            <button onclick="StoreUtils.updateCartQty(${index}, ${item.quantity - 1}); renderCartDrawer(); updateCartBadge();" class="px-2 py-0.5 text-xs bg-gray-50 hover:bg-gray-200 text-gray-700">-</button>
            <span class="px-2.5 py-0.5 text-xs font-medium text-gray-800">${item.quantity}</span>
            <button onclick="StoreUtils.updateCartQty(${index}, ${item.quantity + 1}); renderCartDrawer(); updateCartBadge();" class="px-2 py-0.5 text-xs bg-gray-50 hover:bg-gray-200 text-gray-700">+</button>
          </div>
          <span class="text-xs font-semibold text-gray-800">₹${(item.price * item.quantity).toLocaleString('en-IN')}</span>
        </div>
      </div>
    </div>
  `).join('');

  // Update Totals
  document.getElementById('cartDrawerSubtotal').textContent = `₹${totals.subtotal.toLocaleString('en-IN')}`;
  document.getElementById('cartDrawerShipping').textContent = totals.shipping === 0 ? 'FREE' : `₹${totals.shipping.toLocaleString('en-IN')}`;
  document.getElementById('cartDrawerTotal').textContent = `₹${totals.grandTotal.toLocaleString('en-IN')}`;

  // Free shipping alert
  const threshold = Number(appSettings.free_delivery_threshold || 1999);
  const diff = threshold - totals.subtotal;
  const shippingMsgEl = document.getElementById('freeShippingProgressMsg');
  if (shippingMsgEl) {
    if (diff <= 0) {
      shippingMsgEl.innerHTML = `<span class="text-emerald-700 font-semibold">🎉 Congratulations! You have unlocked FREE Royal Delivery!</span>`;
    } else {
      shippingMsgEl.innerHTML = `Add <span class="font-bold text-[#7b001c]">₹${diff.toLocaleString('en-IN')}</span> more to qualify for <b>FREE Delivery</b>!`;
    }
  }
}

function updateCartBadge() {
  const cart = StoreUtils.getCart();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const badges = document.querySelectorAll('.cart-badge-count');
  badges.forEach(b => {
    b.textContent = count;
    b.style.display = count > 0 ? 'inline-flex' : 'none';
  });
}

// Checkout Modal
function openCheckoutModal() {
  const cart = StoreUtils.getCart();
  if (cart.length === 0) {
    showNotification('Your royal shopping bag is empty.', 'error');
    return;
  }

  closeCartDrawer();
  const totals = StoreUtils.getCartTotals(appSettings.delivery_charge || 100, appSettings.free_delivery_threshold || 1999);

  // Autofill user details if logged in
  const user = API.getUser();
  if (user) {
    document.getElementById('checkoutName').value = user.name || '';
    document.getElementById('checkoutPhone').value = user.phone || '';
    document.getElementById('checkoutEmail').value = user.email || '';
    document.getElementById('checkoutAddress').value = user.address || '';
    document.getElementById('checkoutCity').value = user.city || '';
    document.getElementById('checkoutState').value = user.state || 'Rajasthan';
    document.getElementById('checkoutPincode').value = user.pincode || '';
  }

  // Populate checkout summary
  document.getElementById('checkoutItemsCount').textContent = `${totals.totalItems} Items`;
  document.getElementById('checkoutSubtotal').textContent = `₹${totals.subtotal.toLocaleString('en-IN')}`;
  document.getElementById('checkoutShipping').textContent = totals.shipping === 0 ? 'FREE' : `₹${totals.shipping.toLocaleString('en-IN')}`;
  document.getElementById('checkoutGrandTotal').textContent = `₹${totals.grandTotal.toLocaleString('en-IN')}`;

  // Update QR Code for Online Payment
  const upiId = appSettings.upi_id || 'nidhishcloth@sbi';
  const upiName = encodeURIComponent(appSettings.store_name || 'Nidhish Cloth Store');
  const upiUrl = `upi://pay?pa=${upiId}&pn=${upiName}&am=${totals.grandTotal}&cu=INR`;
  const qrImg = document.getElementById('checkoutUpiQrImage');
  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiUrl)}`;
  }
  document.getElementById('checkoutUpiIdText').textContent = upiId;

  document.getElementById('checkoutModal').classList.remove('hidden');
}

function closeCheckoutModal() {
  document.getElementById('checkoutModal').classList.add('hidden');
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  const cart = StoreUtils.getCart();
  if (cart.length === 0) return;

  const totals = StoreUtils.getCartTotals(appSettings.delivery_charge || 100, appSettings.free_delivery_threshold || 1999);
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
  const user = API.getUser();

  const orderPayload = {
    customer_id: user ? user.id : null,
    customer_name: document.getElementById('checkoutName').value,
    customer_phone: document.getElementById('checkoutPhone').value,
    customer_email: document.getElementById('checkoutEmail').value,
    shipping_address: document.getElementById('checkoutAddress').value,
    city: document.getElementById('checkoutCity').value,
    state: document.getElementById('checkoutState').value,
    pincode: document.getElementById('checkoutPincode').value,
    items: cart.map(item => ({
      product_id: item.id,
      sku: item.sku,
      product_name: item.name,
      size: item.selectedSize,
      color: item.selectedColor,
      price: item.price,
      quantity: item.quantity
    })),
    shipping_charge: totals.shipping,
    discount_amount: 0,
    paid_amount: paymentMethod === 'UPI' ? totals.grandTotal : 0,
    payment_method: paymentMethod,
    payment_status: paymentMethod === 'UPI' ? 'PAID' : 'UNPAID',
    notes: document.getElementById('checkoutNotes').value
  };

  const submitBtn = document.getElementById('btnPlaceOrder');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `
    <span class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></span>
    Placing Royal Order...
  `;

  try {
    const res = await API.createOrder(orderPayload);
    if (res.success && res.order) {
      StoreUtils.clearCart();
      updateCartBadge();
      closeCheckoutModal();
      showOrderSuccessModal(res.order);
    }
  } catch (err) {
    showNotification(err.message || 'Failed to place order. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `Confirm & Place Order`;
  }
}

function showOrderSuccessModal(order) {
  document.getElementById('successOrderNumber').textContent = order.order_number;
  document.getElementById('successCustomerName').textContent = order.customer_name;
  document.getElementById('successOrderTotal').textContent = `₹${order.grand_total.toLocaleString('en-IN')}`;
  document.getElementById('successPaymentMethod').textContent = order.payment_method === 'COD' ? 'Cash on Delivery' : 'Online UPI Paid';

  // WhatsApp Order Confirmation link
  const waMsg = `Khamma Ghani! I have placed an order at *${appSettings.store_name || 'Nidhish Cloth Store'}*.\n\n*Order Number:* ${order.order_number}\n*Total Amount:* ₹${order.grand_total.toLocaleString('en-IN')}\n*Payment Method:* ${order.payment_method}\n*Delivery Address:* ${order.shipping_address}, ${order.city}, ${order.state} - ${order.pincode}.\n\nPlease send me shipping tracking updates.`;
  const waBtn = document.getElementById('successWhatsAppBtn');
  if (waBtn) {
    waBtn.href = StoreUtils.getWhatsAppLink(appSettings.whatsapp || '9672806509', waMsg);
  }

  document.getElementById('orderSuccessModal').classList.remove('hidden');
}

function closeOrderSuccessModal() {
  document.getElementById('orderSuccessModal').classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Order Tracking
async function trackCustomerOrder(e) {
  if (e) e.preventDefault();
  const orderNumber = document.getElementById('trackOrderInput').value.trim();
  if (!orderNumber) {
    showNotification('Please enter your Order Number (e.g. RCS-ORD-XXXXXX)', 'error');
    return;
  }

  const resultContainer = document.getElementById('trackOrderResult');
  resultContainer.innerHTML = `<div class="text-center py-6 text-gray-500">Searching royal records...</div>`;
  resultContainer.classList.remove('hidden');

  try {
    const res = await API.trackOrder(orderNumber);
    if (!res.order) return;
    const o = res.order;

    const statuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered'];
    const currentIdx = statuses.indexOf(o.order_status);

    resultContainer.innerHTML = `
      <div class="bg-amber-50/50 p-4 rounded border border-amber-200 mt-4">
        <div class="flex items-center justify-between pb-3 border-b border-amber-200">
          <div>
            <span class="text-xs text-gray-500 block">Order Number</span>
            <span class="font-royal font-bold text-[#7b001c]">${o.order_number}</span>
          </div>
          <span class="badge-maroon">${o.order_status}</span>
        </div>

        <!-- Stepper -->
        <div class="py-6">
          <div class="flex items-center justify-between relative">
            <div class="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 -translate-y-1/2 z-0"></div>
            <div class="absolute top-1/2 left-0 h-1 bg-[#7b001c] -translate-y-1/2 z-0 transition-all duration-500" style="width: ${Math.max(0, currentIdx) / (statuses.length - 1) * 100}%"></div>

            ${statuses.map((st, i) => `
              <div class="relative z-10 flex flex-col items-center">
                <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= currentIdx ? 'bg-[#7b001c] text-white border-2 border-amber-400' : 'bg-gray-200 text-gray-600'}">
                  ${i < currentIdx ? '✓' : i + 1}
                </div>
                <span class="text-[10px] mt-1 font-medium ${i <= currentIdx ? 'text-[#7b001c] font-bold' : 'text-gray-400'}">${st}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="text-xs space-y-1 text-gray-700 pt-2 border-t border-amber-100">
          <div><b>Customer:</b> ${o.customer_name} (${o.customer_phone})</div>
          <div><b>Delivery Address:</b> ${o.shipping_address}, ${o.city}, ${o.state} - ${o.pincode}</div>
          <div><b>Total Amount:</b> ₹${o.grand_total.toLocaleString('en-IN')} (${o.payment_method})</div>
        </div>
      </div>
    `;
  } catch (err) {
    resultContainer.innerHTML = `
      <div class="p-4 bg-red-50 text-red-700 text-xs rounded border border-red-200 mt-4 text-center">
        Order not found. Please verify your Order Number.
      </div>
    `;
  }
}

// User Auth State & Modals
function updateAuthUI() {
  const user = API.getUser();
  const guestEls = document.querySelectorAll('.auth-guest-only');
  const userEls = document.querySelectorAll('.auth-user-only');
  const nameEl = document.getElementById('authUserName');

  if (user) {
    guestEls.forEach(el => el.classList.add('hidden'));
    userEls.forEach(el => el.classList.remove('hidden'));
    if (nameEl) nameEl.textContent = user.name.split(' ')[0];
  } else {
    guestEls.forEach(el => el.classList.remove('hidden'));
    userEls.forEach(el => el.classList.add('hidden'));
  }
}

function openAuthModal(mode = 'login') {
  document.getElementById('authModal').classList.remove('hidden');
  switchAuthTab(mode);
}

function closeAuthModal() {
  document.getElementById('authModal').classList.add('hidden');
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginTabBtn = document.getElementById('tabBtnLogin');
  const regTabBtn = document.getElementById('tabBtnRegister');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    loginTabBtn.classList.add('text-[#7b001c]', 'border-[#7b001c]', 'font-bold');
    loginTabBtn.classList.remove('text-gray-400');
    regTabBtn.classList.remove('text-[#7b001c]', 'border-[#7b001c]', 'font-bold');
    regTabBtn.classList.add('text-gray-400');
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    regTabBtn.classList.add('text-[#7b001c]', 'border-[#7b001c]', 'font-bold');
    regTabBtn.classList.remove('text-gray-400');
    loginTabBtn.classList.remove('text-[#7b001c]', 'border-[#7b001c]', 'font-bold');
    loginTabBtn.classList.add('text-gray-400');
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const pwd = document.getElementById('loginPassword').value;

  try {
    const res = await API.login(email, pwd);
    showNotification(`Welcome back, ${res.user.name}!`, 'success');
    closeAuthModal();
    updateAuthUI();
  } catch (err) {
    showNotification(err.message || 'Login failed. Invalid credentials.', 'error');
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const data = {
    name: document.getElementById('regName').value,
    email: document.getElementById('regEmail').value,
    phone: document.getElementById('regPhone').value,
    password: document.getElementById('regPassword').value,
    address: document.getElementById('regAddress').value,
    city: document.getElementById('regCity').value,
    state: document.getElementById('regState').value,
    pincode: document.getElementById('regPincode').value
  };

  try {
    const res = await API.register(data);
    showNotification(`Royal account created! Welcome, ${res.user.name}!`, 'success');
    closeAuthModal();
    updateAuthUI();
  } catch (err) {
    showNotification(err.message || 'Registration failed.', 'error');
  }
}

function handleLogout() {
  API.logout();
  updateAuthUI();
  showNotification('Logged out successfully.', 'info');
}

// Wishlist
async function toggleWishlist(productId) {
  const user = API.getUser();
  if (!user) {
    showNotification('Please login to save items to your Royal Wishlist.', 'info');
    openAuthModal('login');
    return;
  }

  try {
    const res = await API.toggleWishlist(productId);
    showNotification(res.isFavorited ? 'Added to Royal Wishlist!' : 'Removed from Wishlist', 'success');
  } catch (err) {
    showNotification('Wishlist update failed.', 'error');
  }
}

// Filter and Search Handlers
function filterByCategory(slug) {
  currentCategoryFilter = slug;
  const select = document.getElementById('categoryFilterSelect');
  if (select) select.value = slug;
  loadProducts();

  const catalogSection = document.getElementById('catalogSection');
  if (catalogSection) catalogSection.scrollIntoView({ behavior: 'smooth' });
}

function applyFilters() {
  currentCategoryFilter = document.getElementById('categoryFilterSelect').value;
  currentSort = document.getElementById('sortFilterSelect').value;
  currentMinPrice = document.getElementById('minPriceInput').value;
  currentMaxPrice = document.getElementById('maxPriceInput').value;
  currentInStockOnly = document.getElementById('inStockCheckbox').checked;
  loadProducts();
}

function resetFilters() {
  currentCategoryFilter = '';
  currentSearch = '';
  currentSort = 'newest';
  currentMinPrice = '';
  currentMaxPrice = '';
  currentInStockOnly = false;

  document.getElementById('categoryFilterSelect').value = '';
  document.getElementById('sortFilterSelect').value = 'newest';
  document.getElementById('minPriceInput').value = '';
  document.getElementById('maxPriceInput').value = '';
  document.getElementById('inStockCheckbox').checked = false;
  document.getElementById('mainSearchInput').value = '';

  loadProducts();
}

function setupEventListeners() {
  // Live search input
  const searchInput = document.getElementById('mainSearchInput');
  let debounceTimeout = null;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        currentSearch = e.target.value.trim();
        loadProducts();
      }, 400);
    });
  }

  // Payment method switcher on checkout
  const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');
  paymentRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const upiSection = document.getElementById('checkoutUpiBox');
      if (e.target.value === 'UPI') {
        upiSection.classList.remove('hidden');
      } else {
        upiSection.classList.add('hidden');
      }
    });
  });
}

// Notification Toast
function showNotification(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-[#7b001c] text-white' : (type === 'error' ? 'bg-red-700 text-white' : 'bg-gray-900 text-white');
  toast.className = `flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-xs font-medium border border-amber-300 transform transition-all duration-300 translate-y-2 opacity-0 ${bgClass}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '👑' : (type === 'error' ? '⚠️' : 'ℹ️')}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
