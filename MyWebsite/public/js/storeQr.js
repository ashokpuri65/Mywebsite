/**
 * Nidhish Cloth Store - QR Code & Royal Standee Module
 * Generates live scannable QR codes for the store, printable counter standees, and photo downloads.
 * Supports Direct Online Public Link (works on mobile data without Wi-Fi).
 */

const StoreQR = {
  currentUrl: 'https://05ccafd7a85fc5.lhr.life',
  networkData: null,
  activeTab: 'standee', // 'standee' | 'photo'

  async init() {
    try {
      const res = await fetch('/api/system/network-info');
      if (res.ok) {
        this.networkData = await res.json();
        // Priority 1: Direct Public Online Link (works over mobile data without Wi-Fi)
        if (this.networkData && this.networkData.publicLiveUrl) {
          this.currentUrl = this.networkData.publicLiveUrl;
        } else if (this.networkData && this.networkData.localUrl) {
          this.currentUrl = this.networkData.localUrl;
        }
      }
    } catch (e) {
      console.warn('Could not fetch network info:', e);
    }
  },

  openModal() {
    let modal = document.getElementById('storeQrModal');
    if (!modal) {
      this.injectModal();
      modal = document.getElementById('storeQrModal');
    }
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    this.refreshQrDisplay();
  },

  closeModal() {
    const modal = document.getElementById('storeQrModal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  },

  setTab(tab) {
    this.activeTab = tab;
    const tabStandee = document.getElementById('tabContentStandee');
    const tabPhoto = document.getElementById('tabContentPhoto');
    const btnStandee = document.getElementById('btnTabStandee');
    const btnPhoto = document.getElementById('btnTabPhoto');

    if (tab === 'standee') {
      if (tabStandee) tabStandee.classList.remove('hidden');
      if (tabPhoto) tabPhoto.classList.add('hidden');
      if (btnStandee) {
        btnStandee.className = 'flex-1 py-2 px-3 text-center text-xs font-bold rounded-lg bg-[#7b001c] text-white shadow transition-all';
      }
      if (btnPhoto) {
        btnPhoto.className = 'flex-1 py-2 px-3 text-center text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all';
      }
    } else {
      if (tabStandee) tabStandee.classList.add('hidden');
      if (tabPhoto) tabPhoto.classList.remove('hidden');
      if (btnPhoto) {
        btnPhoto.className = 'flex-1 py-2 px-3 text-center text-xs font-bold rounded-lg bg-[#7b001c] text-white shadow transition-all';
      }
      if (btnStandee) {
        btnStandee.className = 'flex-1 py-2 px-3 text-center text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all';
      }
    }
  },

  setUrlMode(mode) {
    const input = document.getElementById('storeQrCustomUrlInput');
    if (mode === 'public') {
      this.currentUrl = (this.networkData && this.networkData.publicLiveUrl) || 'https://05ccafd7a85fc5.lhr.life';
    } else if (mode === 'wifi' && this.networkData && this.networkData.localUrl) {
      this.currentUrl = this.networkData.localUrl;
    } else if (mode === 'localhost') {
      this.currentUrl = (this.networkData && this.networkData.localhostUrl) || 'http://localhost:3000';
    } else if (mode === 'custom' && input) {
      this.currentUrl = input.value.trim() || window.location.origin;
    }

    if (input) {
      input.value = this.currentUrl;
    }
    this.refreshQrDisplay();
    this.showToast('QR लिंक सेट किया गया: ' + this.currentUrl, 'success');
  },

  onCustomUrlChange(newUrl) {
    if (newUrl && newUrl.trim()) {
      this.currentUrl = newUrl.trim();
      this.refreshQrDisplay();
    }
  },

  refreshQrDisplay() {
    const qrImg = document.getElementById('storeStandeeQrImage');
    const urlDisplay = document.getElementById('storeStandeeUrlDisplay');
    const input = document.getElementById('storeQrCustomUrlInput');

    if (input && (!input.value || input.value === '')) {
      input.value = this.currentUrl;
    }

    if (urlDisplay) {
      urlDisplay.textContent = this.currentUrl;
    }

    if (qrImg) {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(this.currentUrl)}&margin=10`;
      qrImg.src = qrApiUrl;
    }
  },

  async copyLink() {
    try {
      await navigator.clipboard.writeText(this.currentUrl);
      this.showToast('डायरेक्ट लिंक कॉपी हो गया: ' + this.currentUrl, 'success');
    } catch (e) {
      const input = document.getElementById('storeQrCustomUrlInput');
      if (input) {
        input.select();
        document.execCommand('copy');
        this.showToast('लिंक कॉपी हो गया!', 'success');
      }
    }
  },

  printStandee() {
    const qrSrc = document.getElementById('storeStandeeQrImage')?.src || '';
    const storeUrl = this.currentUrl;

    const printWin = window.open('', '_blank', 'width=850,height=1050');
    if (!printWin) {
      alert('कृपया पॉपअप विंडो को अनुमति दें (Allow Popups) ताकि स्टैंडी प्रिंट हो सके।');
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Nidhish Cloth Store - Counter QR Standee</title>
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Poppins', sans-serif; }
          body {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: #ffffff;
            padding: 20px;
          }
          .standee-card {
            width: 440px;
            border: 6px solid #d4af37;
            outline: 2px solid #7b001c;
            border-radius: 24px;
            background: linear-gradient(145deg, #7b001c 0%, #4a0011 100%);
            color: #ffffff;
            text-align: center;
            padding: 32px 24px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            position: relative;
          }
          .crown { font-size: 36px; margin-bottom: 4px; }
          .store-name {
            font-family: 'Cinzel', serif;
            font-size: 24px;
            font-weight: 900;
            color: #fce892;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            line-height: 1.2;
            margin-bottom: 4px;
          }
          .tagline {
            font-family: 'Playfair Display', serif;
            font-size: 13px;
            color: #e5c158;
            margin-bottom: 6px;
            font-style: italic;
          }
          .badge-mobile {
            display: inline-block;
            background: rgba(16, 185, 129, 0.2);
            border: 1px solid #10b981;
            color: #a7f3d0;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 16px;
          }
          .arch-box {
            background: #ffffff;
            border: 4px solid #d4af37;
            border-radius: 16px;
            padding: 16px;
            display: inline-block;
            box-shadow: inset 0 0 10px rgba(0,0,0,0.1);
            margin-bottom: 16px;
          }
          .qr-img {
            width: 220px;
            height: 220px;
            display: block;
          }
          .scan-title {
            font-size: 16px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 4px;
          }
          .scan-sub {
            font-size: 11px;
            color: #f7d070;
            margin-bottom: 12px;
          }
          .url-box {
            background: rgba(0,0,0,0.35);
            border: 1px dashed #d4af37;
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 12px;
            font-family: monospace;
            color: #fce892;
            word-break: break-all;
            margin-bottom: 16px;
          }
          .contacts {
            border-top: 1px solid rgba(212, 175, 55, 0.4);
            padding-top: 12px;
            font-size: 12px;
            color: #ffffff;
          }
          .contacts b { color: #fce892; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="standee-card">
          <div class="crown">👑</div>
          <div class="store-name">NIDHISH CLOTH STORE</div>
          <div class="tagline">Royal Rajputi Poshak & Traditional Wear</div>
          <div class="badge-mobile">🌐 4G/5G मोबाइल डेटा से डायरेक्ट खुलेगा (No Wi-Fi Needed)</div>
          
          <div class="arch-box">
            <img class="qr-img" src="${qrSrc}" alt="Store QR Code">
          </div>

          <div class="scan-title">वेबसाइट देखने व ऑनलाइन ऑर्डर हेतु स्कैन करें</div>
          <div class="scan-sub">Scan with any Camera, Google Lens, or Paytm App</div>

          <div class="url-box">${storeUrl}</div>

          <div class="contacts">
            <div>📞 संपर्क: <b>अशोक पुरी: 9672806509</b> | <b>प्रेम पुरी: 9131974022</b></div>
            <div style="font-size: 10px; color: #e5c158; margin-top: 4px;">📍 जोधपुर (राजस्थान) • शुद्ध राजपूती परिधान संग्रह</div>
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(() => { window.print(); }, 400);
          };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  },

  async downloadStandeeImage() {
    try {
      this.showToast('स्टैंडी पोस्टर फ़ोटो तैयार की जा रही है...', 'info');
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 1150;
      const ctx = canvas.getContext('2d');

      // Background Gradient (Deep Maroon to Wine)
      const grad = ctx.createLinearGradient(0, 0, 0, 1150);
      grad.addColorStop(0, '#7b001c');
      grad.addColorStop(0.5, '#520013');
      grad.addColorStop(1, '#38000d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 800, 1150);

      // Gold Ornamental Double Border
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 10;
      ctx.strokeRect(20, 20, 760, 1110);

      ctx.strokeStyle = '#997a15';
      ctx.lineWidth = 2;
      ctx.strokeRect(32, 32, 736, 1086);

      // Crown Emoji
      ctx.font = '54px serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑', 400, 105);

      // Store Title
      ctx.fillStyle = '#fce892';
      ctx.font = 'bold 38px "Cinzel", Georgia, serif';
      ctx.fillText('NIDHISH CLOTH STORE', 400, 165);

      // Tagline
      ctx.fillStyle = '#e5c158';
      ctx.font = 'italic 19px "Playfair Display", serif';
      ctx.fillText('निधिश क्लॉथ स्टोर - Royal Rajputi Couture', 400, 200);

      // Mobile Data Green Pill Badge
      ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.beginPath();
      ctx.roundRect(140, 218, 520, 36, 18);
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#a7f3d0';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('🌐 4G/5G मोबाइल डेटा से कहीं भी स्कैन करके खोलें', 400, 242);

      // QR Code Box (White Card with Gold Border)
      const qrBoxSize = 440;
      const qrBoxX = (800 - qrBoxSize) / 2;
      const qrBoxY = 275;

      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 6;
      ctx.beginPath();
      ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 20);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Load and Draw QR Code Image
      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=380x380&data=${encodeURIComponent(this.currentUrl)}&margin=10`;
      
      await new Promise((resolve, reject) => {
        qrImg.onload = resolve;
        qrImg.onerror = reject;
        qrImg.src = qrSrc;
      });

      ctx.drawImage(qrImg, qrBoxX + 30, qrBoxY + 30, 380, 380);

      // Instructions
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('वेबसाइट देखने व ऑनलाइन ऑर्डर हेतु स्कैन करें', 400, 765);

      ctx.fillStyle = '#fce892';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('Scan with any Camera, Google Lens, or Paytm App', 400, 798);

      // URL Pill Box
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.roundRect(80, 825, 640, 50, 25);
      ctx.fill();
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#fce892';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(this.currentUrl, 400, 856);

      // Footer divider
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
      ctx.beginPath();
      ctx.moveTo(120, 915);
      ctx.lineTo(680, 915);
      ctx.stroke();

      // Contact Details
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('📞 अशोक पुरी: 9672806509  |  प्रेम पुरी: 9131974022', 400, 955);

      ctx.fillStyle = '#e5c158';
      ctx.font = '15px sans-serif';
      ctx.fillText('📍 जोधपुर (राजस्थान)  •  राजपूती पोशाक एवं परिधान', 400, 990);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '12px sans-serif';
      ctx.fillText('NIDHISH CLOTH STORE • ROYAL RAJASTHANI HERITAGE', 400, 1030);

      // Trigger download
      const link = document.createElement('a');
      link.download = 'Nidhish_Cloth_Store_Mobile_QR_Standee.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.showToast('स्टैंडी पोस्टर फ़ोटो सफलतापूर्वक डाउनलोड हो गई!', 'success');
    } catch (err) {
      console.error('Failed to generate standee canvas:', err);
      const link = document.createElement('a');
      link.download = 'Nidhish_Cloth_Store_QR.png';
      link.href = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(this.currentUrl)}`;
      link.target = '_blank';
      link.click();
      this.showToast('QR कोड डाउनलोड किया गया!', 'success');
    }
  },

  downloadAcrylicMockupPhoto() {
    const link = document.createElement('a');
    link.href = '/images/nidhish_store_qr_standee.jpg';
    link.download = 'Nidhish_Cloth_Store_Acrylic_Standee_Photo.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('रॉयल काउंटर स्टैंडी फ़ोटो डाउनलोड हो रही है!', 'success');
  },

  showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-6 right-6 z-[9999] px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 transition-all transform translate-y-0 ${
      type === 'success' ? 'bg-emerald-800 text-white' : 'bg-gray-900 text-amber-200'
    }`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : 'ℹ'}</span> <span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  },

  injectModal() {
    const modalHtml = `
      <div id="storeQrModal" class="hidden fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div class="bg-white rounded-2xl shadow-2xl border-2 border-amber-400 max-w-2xl w-full max-h-[95vh] flex flex-col overflow-hidden relative animate-fadeIn">
          
          <!-- Modal Header -->
          <div class="bg-gradient-to-r from-[#7b001c] via-[#520013] to-[#38000d] p-4 text-white flex items-center justify-between border-b-2 border-amber-400">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-full bg-amber-400 text-maroon flex items-center justify-center text-lg font-bold shadow">
                👑
              </div>
              <div>
                <h3 class="font-royal text-sm sm:text-base font-bold text-amber-200 leading-tight">Nidhish Cloth Store - Direct Mobile QR & Standee</h3>
                <p class="text-[11px] text-amber-100/80">मोबाइल डेटा (4G/5G) से सीधे खुलने वाला QR कोड व काउंटर स्टैंडी</p>
              </div>
            </div>
            <button onclick="StoreQR.closeModal()" class="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center text-sm font-bold transition-colors">
              ✕
            </button>
          </div>

          <!-- Tabs: Standee Poster vs Real Acrylic Photo -->
          <div class="flex bg-amber-50 p-2 gap-2 border-b border-amber-200">
            <button id="btnTabStandee" onclick="StoreQR.setTab('standee')" class="flex-1 py-2 px-3 text-center text-xs font-bold rounded-lg bg-[#7b001c] text-white shadow transition-all">
              📱 Live QR Standee (डायरेक्ट मोबाइल QR)
            </button>
            <button id="btnTabPhoto" onclick="StoreQR.setTab('photo')" class="flex-1 py-2 px-3 text-center text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all">
              🖼️ Counter Photo (काउंटर स्टैंडी फ़ोटो)
            </button>
          </div>

          <!-- Modal Body (Scrollable) -->
          <div class="p-4 overflow-y-auto flex-1 space-y-4">
            
            <!-- TAB 1: Live Scannable Standee -->
            <div id="tabContentStandee" class="space-y-4">
              
              <!-- URL Selection Bar -->
              <div class="bg-amber-50/80 border border-amber-300 rounded-xl p-3 text-xs space-y-2">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-semibold text-gray-800">
                  <span>🌐 किस लिंक का QR कोड बनाना है? (Select Link):</span>
                  <div class="flex flex-wrap gap-1.5">
                    <button type="button" onclick="StoreQR.setUrlMode('public')" class="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-[11px] text-white font-bold shadow-sm flex items-center gap-1">
                      <span>🌐</span> <span>डायरेक्ट लिंक (मोबाइल डेटा)</span>
                    </button>
                    <button type="button" onclick="StoreQR.setUrlMode('wifi')" class="px-2 py-1 rounded bg-amber-200 hover:bg-amber-300 text-[11px] text-amber-900 font-semibold">
                      📶 Wi-Fi IP
                    </button>
                    <button type="button" onclick="StoreQR.setUrlMode('localhost')" class="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-[11px] text-gray-800 font-semibold">
                      💻 Localhost
                    </button>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <input 
                    type="text" 
                    id="storeQrCustomUrlInput" 
                    oninput="StoreQR.onCustomUrlChange(this.value)"
                    placeholder="e.g. https://05ccafd7a85fc5.lhr.life या https://nidhishclothstore.com" 
                    class="flex-1 text-xs p-2 border border-gray-300 rounded-lg font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#7b001c]"
                  >
                  <button type="button" onclick="StoreQR.copyLink()" class="px-3 py-2 bg-gray-800 hover:bg-black text-white rounded-lg text-xs font-semibold whitespace-nowrap shadow-sm">
                    📋 Copy Link
                  </button>
                </div>
                <div class="bg-emerald-50 text-emerald-900 border border-emerald-200 p-2 rounded-lg text-[11px] flex items-center gap-2">
                  <span class="text-base">✅</span>
                  <span>
                    <b>डायरेक्ट ऑनलाइन लिंक एक्टिव है:</b> इस QR कोड को किसी भी मोबाइल डेटा (Jio, Airtel 4G/5G) से कहीं भी स्कैन करने पर दुकान की वेबसाइट सीधे खुलेगी! वाई-फाई की कोई आवश्यकता नहीं है।
                  </span>
                </div>
              </div>

              <!-- Royal Standee Card Preview (Printable Area) -->
              <div id="printableStandeeArea" class="max-w-sm mx-auto bg-gradient-to-b from-[#7b001c] via-[#520013] to-[#38000d] rounded-2xl p-5 text-white text-center border-4 border-amber-400 shadow-xl relative overflow-hidden">
                <div class="text-2xl mb-1">👑</div>
                <h4 class="font-royal text-lg font-extrabold text-amber-200 uppercase tracking-wider leading-tight">NIDHISH CLOTH STORE</h4>
                <p class="font-serif italic text-xs text-amber-300 mb-1">Royal Rajputi Poshak & Traditional Wear</p>
                <div class="inline-block bg-emerald-900/60 border border-emerald-400/80 text-emerald-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold mb-2">
                  🌐 4G/5G मोबाइल डेटा से सीधे खुलेगा
                </div>

                <!-- Center QR Code -->
                <div class="bg-white p-3 rounded-xl border-2 border-amber-400 inline-block shadow-inner mb-2.5">
                  <img id="storeStandeeQrImage" src="" alt="Store QR Code" class="w-48 h-48 mx-auto block object-contain">
                </div>

                <div class="text-xs font-bold text-white mb-0.5">वेबसाइट देखने व ऑनलाइन ऑर्डर के लिए स्कैन करें</div>
                <div class="text-[10px] text-amber-300 mb-2">Scan with Camera, Google Lens, or Paytm</div>

                <!-- URL Pill -->
                <div class="bg-black/40 border border-amber-400/40 rounded-full px-3 py-1 text-[10px] font-mono text-amber-200 truncate mb-3">
                  <span id="storeStandeeUrlDisplay"></span>
                </div>

                <!-- Contact & Address -->
                <div class="border-t border-amber-400/30 pt-2 text-[11px] text-amber-100 space-y-0.5">
                  <div>📞 <b>अशोक पुरी:</b> 9672806509 | <b>प्रेम पुरी:</b> 9131974022</div>
                  <div class="text-[10px] text-amber-300">📍 जोधपुर (राजस्थान) • होम डिलीवरी उपलब्ध</div>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                <button type="button" onclick="StoreQR.downloadStandeeImage()" class="btn-royal-gold py-2.5 px-4 rounded-xl text-xs font-bold shadow flex items-center justify-center gap-2">
                  <span>⬇️</span> <span>Download Poster Photo (फ़ोटो डाउनलोड करें)</span>
                </button>
                <button type="button" onclick="StoreQR.printStandee()" class="btn-royal-maroon py-2.5 px-4 rounded-xl text-xs font-bold shadow flex items-center justify-center gap-2">
                  <span>🖨️</span> <span>Print Counter Standee (प्रिंट निकालें)</span>
                </button>
              </div>

            </div>

            <!-- TAB 2: Counter Photo Preview -->
            <div id="tabContentPhoto" class="hidden space-y-3 text-center">
              <div class="bg-slate-900 rounded-xl overflow-hidden border border-amber-400/50 shadow-lg relative max-h-[60vh] flex items-center justify-center">
                <img src="/images/nidhish_store_qr_standee.jpg" alt="Nidhish Cloth Store Counter QR Standee" class="w-full h-auto max-h-[58vh] object-contain mx-auto">
              </div>

              <div class="bg-amber-50 p-3 rounded-xl border border-amber-200 text-left text-xs space-y-1">
                <div class="font-bold text-[#7b001c]">🖼️ Nidhish Cloth Store - Direct Mobile Data Standee Photo</div>
                <p class="text-gray-600 text-[11px]">
                  यह राजपूती पोशाक और हवेली काउंटर के साथ 'निधिश क्लॉथ स्टोर' का असली ऐक्रेलिक स्टैंडी फ़ोटो है, जिस पर लिखा है: <b>"Direct Online Ordering & Mobile Data Access"</b>। इसे आप सीधे डाउनलोड करके अपने व्हाट्सएप स्टेटस, दुकान के काउंटर या सोशल मीडिया पर लगा सकते हैं।
                </p>
              </div>

              <div class="flex flex-col sm:flex-row gap-2 pt-1">
                <button type="button" onclick="StoreQR.downloadAcrylicMockupPhoto()" class="flex-1 btn-royal-gold py-2.5 px-4 rounded-xl text-xs font-bold shadow flex items-center justify-center gap-2">
                  <span>⬇️</span> <span>Download Full Photo (फ़ोटो डाउनलोड करें)</span>
                </button>
                <a href="/images/nidhish_store_qr_standee.jpg" target="_blank" class="flex-1 bg-gray-800 hover:bg-black text-white py-2.5 px-4 rounded-xl text-xs font-bold shadow flex items-center justify-center gap-2">
                  <span>🔍</span> <span>View Full Screen (पूरी फ़ोटो देखें)</span>
                </a>
              </div>
            </div>

          </div>

          <!-- Modal Footer -->
          <div class="bg-gray-50 px-4 py-2.5 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
            <span>दुकान संपर्क: अशोक पुरी (9672806509) / प्रेम पुरी (9131974022)</span>
            <button type="button" onclick="StoreQR.closeModal()" class="text-gray-600 hover:text-black font-semibold">
              बंद करें (Close)
            </button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }
};

// Global helper functions
function openStoreQrModal() {
  StoreQR.openModal();
}

function closeStoreQrModal() {
  StoreQR.closeModal();
}

// Auto initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => StoreQR.init());
} else {
  StoreQR.init();
}
