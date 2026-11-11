window.__deferredPrompt = null;
window.__isPwaStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: minimal-ui)").matches ||
  window.navigator.standalone === true;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  if (window.__isPwaStandalone()) return;
  localStorage.removeItem("pwa_installed");
  window.__deferredPrompt = e;
  const topPwaBtn = document.getElementById("pwa-top-btn");
  if (topPwaBtn) topPwaBtn.classList.remove("hidden");
});

window.addEventListener("appinstalled", () => {
  localStorage.setItem("pwa_installed", "true");
  window.__deferredPrompt = null;
  const banner = document.getElementById("pwa-install-banner");
  if (banner) banner.classList.add("hidden");
  const topPwaBtn = document.getElementById("pwa-top-btn");
  if (topPwaBtn) topPwaBtn.classList.add("hidden");
});

/**
 * ========================================================
 * 🚀 Photo Earn - Core Application Engine (app.js)
 * সম্পূর্ণ ইউজার ইন্টারফেস, কনটেস্ট টাইমার, আর্নিং ও মডাল লজিক
 * ========================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  window.APP = new PicPrizeApp();
});

class PicPrizeApp {
  constructor() {
    this.cfg = window.APP_CONFIG || {};
    this.db = window.DB;
    this.currentTab = "all";
    this.searchQuery = "";
    this.activeUser = null;
    this.isVoteCooldown = false;

    this.init();
  }

  async init() {
    this.initTheme();
    this.initNotifications();
    this.checkAuth();
    this.setupEventListeners();
    this.startContestTimers();
    this.setupPopups();
    this.initLiveChat();
    this.checkUrlParams();
    // সব ডাটা প্যারালালি ফেচ করে তাৎক্ষণিক লোড নিশ্চিত করা
    await Promise.all([
      this.renderHeader(),
      this.renderGallery(),
      this.updateInboxBadge()
    ]);
    setInterval(() => {
      if (!document.hidden) this.updateInboxBadge();
    }, 120000);
  }

  // মোবাইল সার্চ ড্রপডাউন টগল
  toggleMobileSearch() {
    const el = document.getElementById("mobile-search-bar");
    if (el) {
      el.classList.toggle("hidden");
      if (!el.classList.contains("hidden")) {
        const input = document.getElementById("search-input-m");
        if (input) input.focus();
      }
    }
  }

  // থিম ইনিশিয়ালাইজেশন
  initTheme() {
    const saved = localStorage.getItem("peg_theme_mode") || "light";
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    const btn = document.getElementById("theme-toggle-btn");
    if (btn) {
      btn.innerHTML = (saved === "dark") ? "🌙" : "☀️";
      btn.title = (saved === "dark") ? "লাইট মোডে পরিবর্তন করুন" : "ডার্ক মোডে পরিবর্তন করুন";
    }
  }

  // থিম টগল (ডার্ক / লাইট মোড)
  toggleTheme() {
    const isDark = document.documentElement.classList.contains("dark");
    const btn = document.getElementById("theme-toggle-btn");
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("peg_theme_mode", "light");
      if (btn) {
        btn.innerHTML = "☀️";
        btn.title = "ডার্ক মোডে পরিবর্তন করুন";
      }
      this.showToast("☀️ লাইট মোড সক্রিয় করা হয়েছে", "info");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("peg_theme_mode", "dark");
      if (btn) {
        btn.innerHTML = "🌙";
        btn.title = "লাইট মোডে পরিবর্তন করুন";
      }
      this.showToast("🌙 ডার্ক মোড সক্রিয় করা হয়েছে", "info");
    }
  }

  // নোটিফিকেশন ইনিশিয়ালাইজেশন
  initNotifications() {
    const enabled = localStorage.getItem("peg_notifications_enabled") !== "false";
    const btn = document.getElementById("ad-toggle-btn");
    if (btn) {
      btn.innerHTML = enabled ? "🔔" : "🔕";
      btn.title = enabled ? "নোটিফিকেশন মিউট করুন" : "নোটিফিকেশন চালু করুন";
    }
  }

  // নোটিফিকেশন / সাউন্ড টগল
  async toggleAdsNotice() {
    const enabled = localStorage.getItem("peg_notifications_enabled") !== "false";
    const btn = document.getElementById("ad-toggle-btn");
    if (enabled) {
      localStorage.setItem("peg_notifications_enabled", "false");
      if (btn) {
        btn.innerHTML = "🔕";
        btn.title = "নোটিফিকেশন চালু করুন";
      }
      this.showToast("🔕 নোটিফিকেশন মিউট করা হয়েছে", "info");
    } else {
      localStorage.setItem("peg_notifications_enabled", "true");
      if (btn) {
        btn.innerHTML = "🔔";
        btn.title = "নোটিফিকেশন মিউট করুন";
      }
      if ("Notification" in window && Notification.permission === "default") {
        try {
          await Notification.requestPermission();
        } catch (e) {}
      }
      this.showToast("🔔 নোটিফিকেশন সক্রিয় করা হয়েছে!", "success");
    }
  }

  // সুবিধাজনক অ্যালিয়াস
  toggleNotifications() {
    this.toggleAdsNotice();
  }


  // ১. ইউজার অথেনটিকেশন চেক (তাৎক্ষণিক ক্যাশ লোড + ব্যাকগ্রাউন্ডে Firebase লাইভ ব্যালেন্স সিঙ্ক)
  checkAuth() {
    const savedPin = localStorage.getItem("peg_auth_pin");
    if (savedPin) {
      const user = this.db.getUser(savedPin);
      if (user) {
        this.activeUser = user;
      }
      if (this.db && this.db.fetchFirebaseUser) {
        this.db.fetchFirebaseUser(savedPin).then(liveUser => {
          if (liveUser) {
            this.activeUser = liveUser;
            this.updateUserNavButton();
          } else if (!user) {
            localStorage.removeItem("peg_auth_pin");
          }
        }).catch(() => {});
      } else if (!user) {
        localStorage.removeItem("peg_auth_pin");
      }
    }
  }

  // ২. হেডার ও সাইট ব্র্যান্ডিং রেন্ডারিং
  async renderHeader() {
    // লোগো ও নাম
    const logoEl = document.getElementById("brand-logo-text");
    if (logoEl) {
      logoEl.innerHTML = `<b>${this.cfg.logoTextPrimary || "Photo"}</b> <em class="text-pink-500 not-italic font-black">${this.cfg.logoTextSecondary || "Earn"}</em>`;
    }

    // ভিজিটর কাউন্টার
    const stats = await this.db.getVisitorStats();
    const visitorEl = document.getElementById("visitor-stats");
    if (visitorEl) {
      visitorEl.innerHTML = `মোট ভিজিটর: <span class="text-amber-400 font-bold">${(stats.total || 12450).toLocaleString()}</span> · আজ: <span class="text-emerald-400 font-bold">${(stats.today || 120).toLocaleString()}</span>`;
    }

    // ইউজার বাটন স্ট্যাটাস
    this.updateUserNavButton();

    // অ্যাড স্লট রেন্ডারিং
    const topAdEl = document.getElementById("ad-top-slot");
    if (topAdEl && this.cfg.ads && this.cfg.ads.enabled) {
      topAdEl.innerHTML = this.cfg.ads.topBannerSlot || "";
    }
    const stickyAdEl = document.getElementById("ad-sticky-slot");
    if (stickyAdEl && this.cfg.ads && this.cfg.ads.enabled) {
      stickyAdEl.innerHTML = this.cfg.ads.stickyBottomSlot || "";
    }
  }

  updateUserNavButton() {
    const userBtn = document.getElementById("auth-nav-btn");
    if (!userBtn) return;

    if (this.activeUser) {
      userBtn.innerHTML = `
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0"></span>
        <span class="max-w-[70px] sm:max-w-[100px] truncate text-xs sm:text-sm">${this.activeUser.name}</span>
        <span class="bg-indigo-100 dark:bg-indigo-500/30 text-indigo-800 dark:text-indigo-300 text-xs px-2 py-0.5 rounded-full font-black border border-indigo-200 dark:border-transparent shrink-0">৳${parseFloat(this.activeUser.taka || 0).toFixed(1)}</span>
      `;
      userBtn.classList.remove("border-gray-700");
      userBtn.classList.add("border-indigo-500/50");
    } else {
      userBtn.innerHTML = `
        <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
        <span class="hidden sm:inline">লগইন / একাউন্ট</span>
        <span class="sm:hidden text-xs">লগইন</span>
      `;
    }
  }

  // ৩. ইভেন্ট লিসেনার সেটআপ
  setupEventListeners() {
    // সার্চ ইনপুট
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderGallery();
      });
    }

    // কনটেস্ট ন্যাভ ট্যাব ক্লিক (.cn-pill ও [data-tab] সম্পূর্ণ সাপোর্ট)
    document.querySelectorAll(".cn-pill, .nav-chip, [data-tab]").forEach(chip => {
      chip.addEventListener("click", (e) => {
        e.preventDefault();
        const tab = chip.getAttribute("data-tab");
        if (tab) this.switchTab(tab);
      });
    });

    // মোবাইল সার্চ ইনপুট সাপোর্ট
    const searchM = document.getElementById("search-input-m");
    if (searchM) {
      searchM.addEventListener("input", (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderGallery();
      });
    }

    // ছবি জমা দিন বাটন
    const uploadBtn = document.getElementById("upload-trigger-btn");
    if (uploadBtn) {
      uploadBtn.addEventListener("click", () => this.openUploadModal());
    }

    // লগইন বা প্রোফাইল বাটন
    const authBtn = document.getElementById("auth-nav-btn");
    if (authBtn) {
      authBtn.addEventListener("click", () => {
        if (this.activeUser) {
          this.openProfileModal();
        } else {
          this.openAuthModal();
        }
      });
    }

    // সাব-ফিল্টার অনুপাত ও প্রাইসিং ক্লিক (.sub-chip)
    document.querySelectorAll("#ratio-filters .sub-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#ratio-filters .sub-chip").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.currentSub = btn.getAttribute("data-sub") || "all";
        this.renderGallery();
      });
    });

    // থিম চিপস ক্লিক (.sub-chip)
    document.querySelectorAll("#theme-chips-bar .sub-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#theme-chips-bar .sub-chip").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.currentTheme = btn.getAttribute("data-theme") || "";
        this.renderGallery();
      });
    });
  }

  // ৪. ট্যাব পরিবর্তন লজিক
  changeSort(val) {
    this.currentSort = val;
    const s1 = document.getElementById("sort-select");
    const s2 = document.getElementById("sort-select-m");
    if (s1) s1.value = val;
    if (s2) s2.value = val;
    this.renderGallery();
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    document.querySelectorAll(".cn-pill, .nav-chip, [data-tab]").forEach(c => {
      if (c.getAttribute("data-tab") === tabName) {
        c.classList.add("active");
      } else {
        c.classList.remove("active");
      }
    });

    // সেকশন কন্ট্রোল
    const bannerSection = document.getElementById("contest-hero-banner");
    const gallerySection = document.getElementById("gallery-container");
    const leaderboardSection = document.getElementById("leaderboard-container");
    const rulesSection = document.getElementById("income-rules-container");
    const themeVoteSection = document.getElementById("theme-vote-container");
    const hofSection = document.getElementById("hof-container");
    const storySection = document.getElementById("story-container");

    // সব সেকশন ডিফল্ট হাইড
    if (leaderboardSection) leaderboardSection.classList.add("hidden");
    if (rulesSection) rulesSection.classList.add("hidden");
    if (themeVoteSection) themeVoteSection.classList.add("hidden");
    if (hofSection) hofSection.classList.add("hidden");
    if (storySection) storySection.classList.add("hidden");
    if (gallerySection) gallerySection.classList.remove("hidden");

    if (tabName === "lb") {
      if (gallerySection) gallerySection.classList.add("hidden");
      if (leaderboardSection) leaderboardSection.classList.remove("hidden");
      this.renderLeaderboard();
    } else if (tabName === "income") {
      if (gallerySection) gallerySection.classList.add("hidden");
      if (rulesSection) rulesSection.classList.remove("hidden");
    } else if (tabName === "theme") {
      if (gallerySection) gallerySection.classList.add("hidden");
      if (themeVoteSection) themeVoteSection.classList.remove("hidden");
      this.renderThemeVotes();
    } else if (tabName === "hof") {
      if (gallerySection) gallerySection.classList.add("hidden");
      if (hofSection) hofSection.classList.remove("hidden");
    } else if (tabName === "story") {
      if (gallerySection) gallerySection.classList.add("hidden");
      if (storySection) storySection.classList.remove("hidden");
    } else {
      this.renderGallery();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ৫. গ্যালারি রেন্ডারিং (০ms ক্যাশড ফার্স্ট পেইন্ট + ব্যাকগ্রাউন্ড লাইভ আপডেট)
  async renderGallery() {
    const container = document.getElementById("photo-grid");
    if (!container) return;

    let cachedSig = "";
    try {
      const cachedRaw = localStorage.getItem("peg_photos");
      const cached = cachedRaw ? JSON.parse(cachedRaw) : [];
      if (Array.isArray(cached) && cached.length > 0) {
        this.db.lastPhotosList = cached;
        cachedSig = this._gallerySig(cached);
        this._paintGallery(container, cached);
      }
    } catch (e) {}

    if (!cachedSig) {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center text-gray-400">
          <svg class="animate-spin h-8 w-8 mx-auto mb-3 text-indigo-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          <span>ছবি লোড হচ্ছে…</span>
        </div>
      `;
    }

    const allPhotos = await this.db.getPhotos();
    this.db.lastPhotosList = allPhotos;
    const liveSig = this._gallerySig(allPhotos);
    if (!cachedSig || liveSig !== cachedSig || container.children.length === 0) {
      this._paintGallery(container, allPhotos);
    }
  }

  _gallerySig(photos) {
    return `${this.currentTab}|${this.currentSub || 'all'}|${this.currentTheme || ''}|${this.currentSort || 'newest'}|${this.searchQuery || ''}|` +
      (photos || []).map(p => `${p.id}:${p.votes || 0}:${p.views || 0}:${p.approved}`).join(",");
  }

  _paintGallery(container, allPhotos) {
    // কেবল অনুমোদিত ছবিগুলো সাধারণ গ্যালারিতে দেখাবে (পেন্ডিং ছবি অ্যাডমিন অনুমোদনের অপেক্ষায় থাকবে)
    let filtered = allPhotos.filter(p => p.approved !== false);

    // ট্যাব ফিল্টারিং
    if (this.currentTab === "c24") {
      filtered = filtered.filter(p => p.contestType === "c24");
    } else if (this.currentTab === "c7") {
      filtered = filtered.filter(p => p.contestType === "c7");
    } else if (this.currentTab === "c30") {
      filtered = filtered.filter(p => p.contestType === "c30");
    } else if (this.currentTab === "potd") {
      // আজকের সেরা (সর্বোচ্চ ভোট পাওয়া ছবি)
      filtered = [...filtered].sort((a, b) => (b.votes || 0) - (a.votes || 0)).slice(0, 10);
    }

    // সার্চ ফিল্টারিং
    if (this.searchQuery) {
      filtered = filtered.filter(p =>
        (p.title && p.title.toLowerCase().includes(this.searchQuery)) ||
        (p.authorName && p.authorName.toLowerCase().includes(this.searchQuery)) ||
        (p.category && p.category.toLowerCase().includes(this.searchQuery))
      );
    }

    // সাব-ফিল্টারিং (অনুপাত ও ধরন)
    if (this.currentSub && this.currentSub !== "all") {
      if (this.currentSub === "free") {
        filtered = filtered.filter(p => !p.price || p.price === "0" || p.price === 0 || p.photoType === "FREE");
      } else if (this.currentSub === "paid") {
        filtered = filtered.filter(p => p.photoType === "PAID" || (p.price && parseFloat(p.price) > 0));
      } else if (this.currentSub === "16:9") {
        filtered = filtered.filter(p => p.aspect === "16:9" || p.ratio === "16:9");
      } else if (this.currentSub === "9:16") {
        filtered = filtered.filter(p => p.aspect === "9:16" || p.ratio === "9:16");
      } else if (this.currentSub === "wallpaper") {
        filtered = filtered.filter(p => (p.category && p.category.toLowerCase().includes("wallpaper")) || p.isWallpaper);
      }
    }

    // থিম ফিল্টারিং
    if (this.currentTheme) {
      filtered = filtered.filter(p =>
        (p.title && p.title.toLowerCase().includes(this.currentTheme.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(this.currentTheme.toLowerCase())) ||
        (p.tags && p.tags.toLowerCase().includes(this.currentTheme.toLowerCase()))
      );
    }

    // সর্টিং প্রয়োগ
    const sortVal = this.currentSort || "newest";
    if (sortVal === "votes") {
      filtered.sort((a, b) => (b.votes || 0) - (a.votes || 0));
    } else if (sortVal === "views") {
      filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (sortVal === "oldest") {
      filtered.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    } else {
      filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center text-gray-500 glass-panel rounded-2xl">
          <svg class="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          <p class="text-base font-semibold text-gray-400">কোনো ছবি পাওয়া যায়নি!</p>
          <p class="text-xs text-gray-500 mt-1">প্রথম ছবিটি আপনিই আপলোড করুন এবং জিতে নিন পুরস্কার।</p>
          <button onclick="window.APP.openUploadModal()" class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg">ছবি জমা দিন</button>
        </div>
      `;
      return;
    }

    let html = "";
    filtered.forEach((photo, index) => {
      // ইন-ফিড অ্যাড ফুটারে স্থানান্তর করা হয়েছে

      // ব্যাজ নির্ণয়
      let badgeHtml = "";
      if ((photo.votes || 0) >= (this.cfg.badgeRedKingVotes || 70)) {
        badgeHtml = `<span class="badge-red-king">👑 Red King</span>`;
      } else if ((photo.votes || 0) >= (this.cfg.badgeBlueKingVotes || 30)) {
        badgeHtml = `<span class="badge-blue-king">⚡ Blue King</span>`;
      }

      // কনটেস্ট চিপ
      let contestChip = "";
      if (photo.contestType === "c24") contestChip = `<span class="bg-rose-500/20 text-rose-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-rose-500/30">🔥 ২৪ ঘণ্টা</span>`;
      else if (photo.contestType === "c7") contestChip = `<span class="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-500/30">👑 ৭ দিন</span>`;
      else if (photo.contestType === "c30") contestChip = `<span class="bg-purple-500/20 text-purple-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-purple-500/30">💎 ৩০ দিন</span>`;

      // ফ্রি বা পেইড ব্যাজ (GalleryBD স্টাইল)
      let priceBadge = "";
      if (photo.photoType === "PAID" || (photo.price && photo.price > 0)) {
        priceBadge = `<span class="badge-paid">💰 PAID ৳${photo.price}</span>`;
      } else {
        priceBadge = `<span class="badge-free">FREE</span>`;
      }

      const creatorPin = photo.authorId || photo.authorPin || photo.authorName || "creator";
      const isFollowing = this.db.isFollowing(creatorPin);

      html += `
        <div class="photo-card glass-panel rounded-2xl overflow-hidden flex flex-col justify-between group">
          <!-- ছবি অংশ (৯:১৬ পোর্ট্রেট রেশিও) -->
          <div class="photo-img-wrap aspect-9-16 relative overflow-hidden cursor-pointer bg-slate-900" style="aspect-ratio: 9/16 !important; width: 100% !important;" onclick="window.APP.openPhotoModal('${photo.id}')">
            <img src="${photo.url}" alt="${photo.title}" ${index < 4 ? (index < 2 ? 'fetchpriority="high"' : '') : 'loading="lazy"'} decoding="async" width="270" height="480" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" style="aspect-ratio: 9/16 !important; object-fit: cover !important; width: 100% !important; height: 100% !important;">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20"></div>
            
            <!-- টপ ব্যাজ -->
            <div class="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
              ${priceBadge}
              ${contestChip}
              ${badgeHtml}
            </div>

            <!-- ভিউ কাউন্ট -->
            <div class="absolute bottom-2.5 right-2.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-[11px] text-gray-300 flex items-center gap-1">
              <svg class="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
              <span>${photo.views || 0}</span>
            </div>
          </div>

          <!-- বিস্তারিত ও ভোট বাটন -->
          <div class="p-4 flex flex-col justify-between gap-3 flex-1">
            <div>
              <span class="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">${photo.category || "প্রকৃতি"}</span>
              <h3 class="font-bold text-slate-900 dark:text-gray-100 text-sm line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mt-0.5">${photo.title}</h3>
              <div class="flex items-center justify-between gap-1.5 mt-1">
                <p class="text-xs text-slate-600 dark:text-gray-400 font-medium flex items-center gap-1.5 truncate">
                  <svg class="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                  <span class="truncate">${photo.authorName || "শিল্পী"}</span>
                </p>
                <button type="button" onclick="window.APP.handleToggleFollow('${creatorPin}', '${photo.authorName || 'শিল্পী'}', event)" class="follow-btn-${creatorPin} text-[10px] px-2 py-0.5 rounded-full font-bold transition-all shrink-0 ${isFollowing ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-gray-300 hover:text-indigo-400 border border-slate-300 dark:border-slate-700'}">
                  ${isFollowing ? '✓ ফলো করছেন' : '+ ফলো'}
                </button>
              </div>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-white/5">
              <div class="flex items-center gap-1.5 text-rose-400 font-bold text-xs">
                <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                <span id="vote-count-${photo.id}">${photo.votes || 0} ভোট</span>
              </div>

              <button onclick="window.APP.handleVote('${photo.id}', event)" class="px-3.5 py-1.5 bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 border border-rose-500/25">
                <span>❤️ ভোট দিন</span>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // ৬. ভোট হ্যান্ডলার (হিউম্যান ভেরিফিকেশন গেট ও ৫ সেকেন্ড কুলডাউন)
  async handleVote(photoId, event) {
    if (event) event.stopPropagation();

    if (this.isVoteCooldown) {
      this.showToast(`দয়া করে ${this.cfg.voteCoolDownSeconds || 2} সেকেন্ড অপেক্ষা করুন!`, "warning");
      return;
    }

    const votedKey = `voted_${photoId}`;
    if (localStorage.getItem(votedKey)) {
      this.showToast("আপনি ইতিমধ্যে এই ছবিতে ভোট দিয়েছেন!", "info");
      return;
    }

    const btn = event ? event.currentTarget : null;

    // প্রতি ৫টি লাইক/ভোটে Adsterra Human Verification গেট
    const verifyEvery = this.cfg.likeVerifyEvery || 5;
    const currentLikes = parseInt(localStorage.getItem("peg_user_likes") || "0");
    const nextVoteNum = currentLikes + 1;
    const milestone = Math.ceil(nextVoteNum / verifyEvery);
    const sessionKey = `peg_hv_passed_${milestone}`;

    if (nextVoteNum > 0 && nextVoteNum % verifyEvery === 0 && !sessionStorage.getItem(sessionKey)) {
      this.showHumanVerifyModal(() => {
        sessionStorage.setItem(sessionKey, "true");
        this.commitVote(photoId, btn);
      });
      return;
    }

    this.commitVote(photoId, btn);
  }

  // ভোট কমিট ও ০ms তাৎক্ষণিক অপটিমিস্টিক UI আপডেট
  async commitVote(photoId, btn) {
    const countEl = document.getElementById(`vote-count-${photoId}`);
    const modalCountEl = document.getElementById(`modal-vote-count-${photoId}`);
    const prevVotes = parseInt((countEl ? countEl.innerText : (modalCountEl ? modalCountEl.innerText : "0")).replace(/[^\d]/g, ""), 10) || 0;
    const optimisticVotes = prevVotes + 1;

    // ০ সেকেন্ডেই স্ক্রিনে ভোট বৃদ্ধি ও অ্যানিমেশন (অপেক্ষা ছাড়াই)
    this.isVoteCooldown = true;
    if (btn) btn.classList.add("heart-active");
    if (countEl) countEl.innerText = `${optimisticVotes} ভোট`;
    if (modalCountEl) modalCountEl.innerText = `❤️ ${optimisticVotes} ভোট`;
    this.showToast("আপনার ভোট সফলভাবে যোগ হয়েছে! ❤️", "success");

    const cdMs = (this.cfg.voteCoolDownSeconds || 2) * 1000;
    setTimeout(() => {
      this.isVoteCooldown = false;
      if (btn) btn.classList.remove("heart-active");
    }, cdMs);

    // ব্যাকগ্রাউন্ডে সার্ভার সিঙ্ক
    const voterPin = this.activeUser ? this.activeUser.pin : null;
    const res = await this.db.votePhoto(photoId, voterPin);

    if (res.success) {
      if (res.votes !== undefined) {
        if (countEl) countEl.innerText = `${res.votes} ভোট`;
        if (modalCountEl) modalCountEl.innerText = `❤️ ${res.votes} ভোট`;
      }
      if (Array.isArray(this.db.lastPhotosList)) {
        const target = this.db.lastPhotosList.find(p => p.id === photoId);
        if (target) {
          target.votes = res.votes !== undefined ? res.votes : optimisticVotes;
          localStorage.setItem("peg_photos", JSON.stringify(this.db.lastPhotosList));
        }
      }
    } else {
      // সার্ভার বাতিল করলে সংখ্যা আগের অবস্থায় ফেরানো
      if (countEl) countEl.innerText = `${prevVotes} ভোট`;
      if (modalCountEl) modalCountEl.innerText = `❤️ ${prevVotes} ভোট`;
      if (btn) btn.classList.remove("heart-active");
      this.showToast(res.message || "ভোট দেওয়া যায়নি!", "info");
    }
  }

  // ক্রিয়েটর ফলো / আনফলো হ্যান্ডলার
  async handleToggleFollow(creatorPin, creatorName, event) {
    if (event) event.stopPropagation();

    if (!this.activeUser) {
      this.showToast("শিল্পীকে ফলো করতে প্রথমে লগইন বা একাউন্ট তৈরি করুন!", "info");
      this.openAuthModal();
      return;
    }

    if (this.activeUser.pin === creatorPin || (this.activeUser.creatorId && this.activeUser.creatorId === creatorPin)) {
      this.showToast("আপনি নিজেকে ফলো করতে পারবেন না!", "warning");
      return;
    }

    const res = await this.db.toggleFollowCreator(creatorPin);
    if (res.success) {
      document.querySelectorAll(`.follow-btn-${creatorPin}`).forEach(btn => {
        if (res.isFollowing) {
          btn.className = `follow-btn-${creatorPin} text-[10px] px-2 py-0.5 rounded-full font-bold transition-all shrink-0 bg-indigo-500/20 text-indigo-400 border border-indigo-500/40`;
          btn.innerText = "✓ ফলো করছেন";
        } else {
          btn.className = `follow-btn-${creatorPin} text-[10px] px-2 py-0.5 rounded-full font-bold transition-all shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-gray-300 hover:text-indigo-400 border border-slate-300 dark:border-slate-700`;
          btn.innerText = "+ ফলো";
        }
      });

      if (res.isFollowing) {
        this.showToast(`🎉 আপনি ${creatorName || 'শিল্পী'}-কে ফলো করছেন! (মোট ফলো: ${res.totalFollowed})`, "success");
      } else {
        this.showToast(`আপনি ${creatorName || 'শিল্পী'}-কে আনফলো করেছেন।`, "info");
      }
    }
  }

  // হিউম্যান ভেরিফিকেশন মডাল প্রদর্শন
  showHumanVerifyModal(onVerified) {
    this.pendingVerifyCallback = onVerified;
    const modal = document.getElementById("human-verify-modal");
    const btn = document.getElementById("btn-human-verify-trigger");
    const icon = document.getElementById("hv-btn-icon");
    const text = document.getElementById("hv-btn-text");

    if (btn) btn.disabled = false;
    if (icon) icon.innerHTML = "🛡️";
    if (text) text.innerText = `Human Verify করুন (${this.cfg.likeWaitSeconds || 5} সেকেন্ড)`;
    if (modal) modal.classList.remove("hidden");
  }

  // হিউম্যান ভেরিফিকেশন এক্সিকিউশন (Adsterra স্মার্টলিংক ওপেন + ৫ সেকেন্ড কাউন্টডাউন)
  executeHumanVerify() {
    const btn = document.getElementById("btn-human-verify-trigger");
    const icon = document.getElementById("hv-btn-icon");
    const text = document.getElementById("hv-btn-text");

    if (btn) btn.disabled = true;

    // ১. Adsterra স্পনসর ডিরেক্ট লিংক নতুন ট্যাবে ওপেন
    const adUrl = (this.cfg.ads && this.cfg.ads.sponsorDirectLink) || "https://araplhn.org/4/7decde193b07302555c7d1b18a2dfcbe";
    try {
      window.open(adUrl, "_blank");
    } catch (e) {}

    // ২. ৫ সেকেন্ডের কাউন্টডাউন
    let remain = this.cfg.likeWaitSeconds || 5;
    if (icon) icon.innerHTML = `<svg class="animate-spin h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>`;
    if (text) text.innerText = `ভেরিফাই হচ্ছে… (${remain} সেকেন্ড)`;

    const timer = setInterval(() => {
      remain--;
      if (remain > 0) {
        if (text) text.innerText = `ভেরিফাই হচ্ছে… (${remain} সেকেন্ড)`;
      } else {
        clearInterval(timer);
        if (icon) icon.innerHTML = "✅";
        if (text) text.innerText = "ভেরিফিকেশন সফল!";

        setTimeout(() => {
          const modal = document.getElementById("human-verify-modal");
          if (modal) modal.classList.add("hidden");
          this.showToast("✅ হিউম্যান ভেরিফিকেশন সফল! আপনার ভোট যোগ করা হয়েছে।", "success");
          if (typeof this.pendingVerifyCallback === "function") {
            const cb = this.pendingVerifyCallback;
            this.pendingVerifyCallback = null;
            cb();
          }
        }, 500);
      }
    }, 1000);
  }

  // আপলোড কোটা সতর্কবার্তা মডাল প্রদর্শন
  showUploadQuotaModal(quota) {
    const modal = document.getElementById("upload-quota-modal");
    if (!modal) return;

    const likesText = document.getElementById("quota-likes-text");
    const likesBar = document.getElementById("quota-likes-bar");
    const likesRemain = document.getElementById("quota-likes-remain");

    const followsText = document.getElementById("quota-follows-text");
    const followsBar = document.getElementById("quota-follows-bar");
    const followsRemain = document.getElementById("quota-follows-remain");

    const lkPct = quota.needLikes > 0 ? Math.min(100, Math.round((quota.likes / quota.needLikes) * 100)) : 100;
    const folPct = quota.needFollows > 0 ? Math.min(100, Math.round((quota.follows / quota.needFollows) * 100)) : 100;

    if (likesText) {
      likesText.innerHTML = `${quota.likes} / ${quota.needLikes} টি ${quota.likes >= quota.needLikes ? '✅ সম্পন্ন' : ''}`;
    }
    if (likesBar) {
      likesBar.style.width = `${lkPct}%`;
    }
    if (likesRemain) {
      likesRemain.innerHTML = quota.likes >= quota.needLikes
        ? '<span class="text-emerald-500 font-bold">✅ লাইক দেওয়ার শর্ত সম্পূর্ণ পূরণ হয়েছে!</span>'
        : `বাকি আছে: আরও <b class="text-rose-500">${quota.needLikes - quota.likes}টি</b> ছবিতে ভোট দিন`;
    }

    if (followsText) {
      followsText.innerHTML = `${quota.follows} / ${quota.needFollows} জন ${quota.follows >= quota.needFollows ? '✅ সম্পন্ন' : ''}`;
    }
    if (followsBar) {
      followsBar.style.width = `${folPct}%`;
    }
    if (followsRemain) {
      followsRemain.innerHTML = quota.follows >= quota.needFollows
        ? '<span class="text-emerald-500 font-bold">✅ শিল্পী ফলো করার শর্ত সম্পূর্ণ পূরণ হয়েছে!</span>'
        : `বাকি আছে: আরও <b class="text-indigo-500">${quota.needFollows - quota.follows} জন</b> শিল্পীকে ফলো করুন`;
    }

    modal.classList.remove("hidden");
  }

  // গ্যালারিতে স্ক্রল করানো
  scrollToGallery() {
    const g = document.getElementById("gallery-container") || document.getElementById("photo-grid");
    if (g) g.scrollIntoView({ behavior: "smooth" });
  }

  // ৭. ফটো ভিউ ও স্পনসর ডাউনলোড মডাল
  async openPhotoModal(photoId) {
    const photos = await this.db.getPhotos();
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;

    // ভিউ কাউন্ট বৃদ্ধি
    await this.db.incrementView(photoId);

    const modal = document.getElementById("photo-details-modal");
    const content = document.getElementById("photo-details-content");
    if (!modal || !content) return;

    const modalCreatorId = photo.authorId || photo.authorPin || photo.authorName || "creator";
    content.innerHTML = `
      <div class="relative rounded-2xl overflow-hidden bg-black/90 max-h-[65vh] flex items-center justify-center">
        <img src="${photo.url}" alt="${photo.title}" class="max-h-[60vh] max-w-full object-contain mx-auto">
        <div class="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs text-gray-200 flex items-center gap-2">
          <span>ছবি সৌজন্যে: <b class="text-indigo-400">${photo.authorName}</b></span>
          <button type="button" onclick="window.APP.handleToggleFollow('${modalCreatorId}', '${photo.authorName || 'শিল্পী'}', event)" class="follow-btn-${modalCreatorId} text-[10px] px-2 py-0.5 rounded-full font-bold transition-all ${this.db.isFollowing(modalCreatorId) ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40' : 'bg-white/20 text-white hover:text-indigo-300 border border-white/30'}">
            ${this.db.isFollowing(modalCreatorId) ? '✓ ফলো করছেন' : '+ ফলো'}
          </button>
        </div>
      </div>

      <div class="mt-4 flex flex-col gap-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <span class="text-xs text-indigo-400 font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">${photo.category}</span>
            <h2 class="text-lg font-bold text-white mt-1">${photo.title}</h2>
            <p class="text-xs text-gray-400 mt-0.5">আপলোড তারিখ: ${new Date(photo.date).toLocaleDateString('bn-BD')}</p>
          </div>
          <div class="text-right flex flex-col items-end">
            <span class="text-sm font-bold text-rose-400" id="modal-vote-count-${photo.id}">❤️ ${photo.votes || 0} ভোট</span>
            <p class="text-xs text-gray-400 mt-0.5">👁️ ${photo.views || 0} ভিউ</p>
            <button onclick="window.APP.handleVote('${photo.id}', event)" class="mt-1 px-3 py-1 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg text-xs font-bold border border-rose-500/30 transition-all flex items-center gap-1 active:scale-95">
              <span>❤️ ভোট দিন</span>
            </button>
          </div>
        </div>

        <!-- অ্যাকশন বক্স: ফ্রি বনাম পেইড (GalleryBD স্টাইল) -->
        ${(photo.photoType === 'PAID' || (photo.price && photo.price > 0)) ? `
          <div class="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-indigo-500/15 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 mt-2">
            <div class="text-left text-xs text-gray-200">
              <span class="inline-block px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px] uppercase mb-1">পেইড ছবি • ৳${photo.price}</span>
              <b class="text-white block mb-0.5">🛒 অরিজিনাল হাই-রেজ্যুলেশন ফাইল কিনুন</b>
              <span class="text-gray-300 text-[11px]">বিকাশ বা নগদে মাত্র ৳${photo.price} দিয়ে ফুল কোয়ালিটি ছবি সংগ্রহ করুন</span>
            </div>
            <button onclick="window.APP.openBuyModal('${photo.id}')" class="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 via-rose-500 to-pink-500 hover:from-amber-600 hover:to-pink-600 text-slate-950 font-black rounded-xl text-xs shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 whitespace-nowrap">
              <span>🛒 কিনুন — ৳${photo.price}</span>
            </button>
          </div>
        ` : `
          <!-- স্পনসর ডাউনলোড বাটন -->
          <div class="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 mt-2">
            <div class="text-left text-xs text-gray-300">
              <b class="text-amber-400 block mb-0.5">📥 হাই-রেজ্যুলেশন HD ডাউনলোড</b>
              <span>অরিজিনাল সাইজের ছবি নামাতে ৫ সেকেন্ড অপেক্ষা করুন</span>
            </div>
            <button id="sponsor-download-btn" onclick="window.APP.handleSponsorDownload('${photo.url}', '${photo.title}', '${photo.authorName}')" class="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              <span>HD ডাউনলোড করুন</span>
            </button>
          </div>
        `}

        <!-- সোশ্যাল শেয়ার বাটন (ভাইরাল ট্রাফিকের জন্য) -->
        <div class="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 mt-2">
          <div class="text-left text-xs text-gray-300">
            <b class="text-white block mb-0.5">📢 বন্ধুদের শেয়ার করে ভোট চান</b>
            <span class="text-gray-400 text-[11px]">হোয়াটসঅ্যাপে শেয়ার করলেই বন্ধুরা সরাসরি আপনার ছবিতে ভোট দিতে পারবে</span>
          </div>
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <button onclick="window.APP.shareToWhatsApp('${photo.id}', '${photo.title}')" class="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 whitespace-nowrap">
              <span>💬 WhatsApp</span>
            </button>
            <button onclick="window.APP.copyShareLink('${photo.id}')" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded-xl text-xs font-bold border border-slate-700 transition-all active:scale-95 flex items-center gap-1" title="লিঙ্ক কপি করুন">
              <span>🔗 লিঙ্ক</span>
            </button>
          </div>
        </div>

        <!-- কনটেস্ট সার্টিফিকেট ডাউনলোড বাটন (GalleryBD স্টাইল) -->
        <button onclick="window.APP.downloadWinnerCertificate('${photo.id}')" class="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold rounded-xl border border-amber-400/20 flex items-center justify-center gap-1.5 transition-all">
          <span>🏆 সাফল্য স্বীকৃতি সার্টিফিকেট ডাউনলোড (PNG)</span>
        </button>
      </div>
    `;

    modal.classList.remove("hidden");
  }

  // ৮. ৫ সেকেন্ড স্পনসর ডিরেক্ট লিংক ডাউনলোড কাউন্টডাউন
  handleSponsorDownload(imgUrl, title, author) {
    const btn = document.getElementById("sponsor-download-btn");
    if (!btn) return;

    let seconds = this.cfg.ads.downloadWaitSeconds || 5;
    btn.disabled = true;
    btn.classList.add("opacity-80");

    const timer = setInterval(() => {
      btn.innerHTML = `<span>অপেক্ষা করুন (${seconds}s)…</span>`;
      seconds--;

      if (seconds < 0) {
        clearInterval(timer);
        btn.disabled = false;
        btn.classList.remove("opacity-80");
        btn.innerHTML = `<span>ডাউনলোড শুরু হচ্ছে…</span>`;

        // স্পনসর ডিরেক্ট লিংক ওপেন (নতুন ট্যাবে আর্নিং লিংক)
        if (this.cfg.ads.sponsorDirectLink) {
          window.open(this.cfg.ads.sponsorDirectLink, "_blank");
        }

        // আসল ইমেজ ডাউনলোড ট্রিগার
        const a = document.createElement("a");
        a.href = imgUrl;
        a.download = `${title.replace(/\s+/g, '_')}_by_${author}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        this.showToast("ছবি ডাউনলোড সম্পন্ন হয়েছে! 🎉", "success");
      }
    }, 1000);
  }

  // ৯. ছবি আপলোড মডাল ওপেন (ডাইনামিক কোটা চেক সহ)
  async openUploadModal() {
    if (!this.activeUser) {
      this.showToast("ছবি জমা দিতে প্রথমে লগইন বা একাউন্ট তৈরি করুন!", "info");
      this.openAuthModal();
      return;
    }

    // ১. ডাইনামিক আপলোড কোটা ও সর্বোচ্চ ছবির লিমিট চেক (অ্যাডমিন সেটিংস ও ডেডলক গার্ড সহ)
    const quota = await this.db.getUploadQuota(this.activeUser.pin);
    if (quota.limitReached) {
      this.showToast(`🚫 ছবি আপলোডের সীমা পূর্ণ হয়েছে! একজন ইউজার সর্বোচ্চ ${quota.maxPhotos}টি ছবি দিতে পারবেন (আপনার ছবি: ${quota.userPhotosCount}টি)।`, "warning");
      return;
    }
    if (!quota.ok) {
      this.showUploadQuotaModal(quota);
      return;
    }

    const modal = document.getElementById("upload-modal");
    if (modal) modal.classList.remove("hidden");

    // ইউজার ইনফো পপুলেট
    const nameInput = document.getElementById("up-author-name");
    const nameBanner = document.getElementById("up-user-name");
    if (nameInput) nameInput.value = this.activeUser.name || "";
    if (nameBanner) nameBanner.innerText = this.activeUser.name || "ইউজার";

    // হিউম্যান ভেরিফাই স্ট্যাটাস চেক
    const verifyBox = document.getElementById("up-verify-box");
    if (this.cfg.ads && this.cfg.ads.uploadHumanVerifyEnabled) {
      if (sessionStorage.getItem("up_human_verified")) {
        if (verifyBox) verifyBox.innerHTML = `<div class="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center text-xs text-emerald-400 font-bold">✅ সিকিউরিটি হিউম্যান ভেরিফিকেশন সম্পন্ন</div>`;
      }
    } else {
      if (verifyBox) verifyBox.classList.add("hidden");
    }
  }

  // লাইভ ইমেজ প্রিভিউ ও সাইজ ডিটেকশন (GalleryBD স্টাইল)
  handleFilePreview(input) {
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const img = new Image();
      img.onload = () => {
        const w = img.width;
        const h = img.height;
        const orient = w >= h ? "ল্যান্ডস্কেপ" : "পোর্ট্রেট";
        
        const previewWrap = document.getElementById("up-preview-wrap");
        const dropContent = document.getElementById("up-drop-content");
        const previewImg = document.getElementById("up-preview-img");
        const badge = document.getElementById("up-preview-badge");

        if (previewImg) previewImg.src = dataUrl;
        if (badge) badge.innerText = `✅ ছবি সিলেক্ট হয়েছে — ${orient} (${w}×${h})`;
        if (dropContent) dropContent.classList.add("hidden");
        if (previewWrap) previewWrap.classList.remove("hidden");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  // ছবি আপলোড সাবমিট
  async handlePhotoUpload(e) {
    e.preventDefault();

    const consent = document.getElementById("up-consent");
    if (consent && !consent.checked) {
      this.showToast("দয়া করে ছবির আসল মালিকানার সম্মতি বক্সে টিক দিন!", "warning");
      return;
    }

    const title = (document.getElementById("up-title") ? document.getElementById("up-title").value.trim() : "") || "শিরোনামহীন ফটোগ্রাফি";
    const desc = document.getElementById("up-desc") ? document.getElementById("up-desc").value.trim() : "";
    const location = document.getElementById("up-location") ? document.getElementById("up-location").value.trim() : "";
    const whatsapp = document.getElementById("up-whatsapp") ? document.getElementById("up-whatsapp").value.trim() : "";
    const telegram = document.getElementById("up-telegram") ? document.getElementById("up-telegram").value.trim() : "";
    const authorName = (document.getElementById("up-author-name") ? document.getElementById("up-author-name").value.trim() : "") || (this.activeUser ? this.activeUser.name : "শিল্পী");

    const category = document.getElementById("up-category").value;
    const contestType = document.getElementById("up-contest").value;
    const photoType = document.getElementById("up-type") ? document.getElementById("up-type").value : "FREE";
    const priceInput = document.getElementById("up-price");
    const price = photoType === "PAID" && priceInput ? (parseInt(priceInput.value, 10) || 10) : 0;
    const fileInput = document.getElementById("up-file");

    if (!fileInput.files[0]) {
      this.showToast("দয়া করে একটি ছবি সিলেক্ট করুন!", "warning");
      return;
    }

    // হিউম্যান ভেরিফিকেশন চেক
    if (this.cfg.ads && this.cfg.ads.uploadHumanVerifyEnabled && !sessionStorage.getItem("up_human_verified")) {
      this.showToast("দয়া করে প্রথমে উপরের 'হিউম্যান ভেরিফাই' বাটনে চাপ দিয়ে ভেরিফিকেশন সম্পন্ন করুন!", "warning");
      return;
    }

    const file = fileInput.files[0];
    const submitBtn = document.getElementById("up-submit-btn");
    submitBtn.disabled = true;
    submitBtn.innerText = "ছবি প্রসেস হচ্ছে…";

    // ক্লায়েন্ট-সাইড ইমেজ অপটিমাইজেশন (Canvas দিয়ে রিসাইজ)
    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const maxWidth = 1200;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const optimizedDataUrl = canvas.toDataURL("image/jpeg", 0.85);

        // অটোমেটিক অ্যাডমিন অনুমোদন স্ট্যাটাস চেক
        const isAuto = await this.db.isAutoApproveEnabled();
        const isApproved = isAuto ? true : false;

        const newPhoto = {
          title,
          desc,
          location,
          whatsapp,
          telegram,
          category,
          contestType,
          photoType,
          price,
          url: optimizedDataUrl,
          authorName,
          authorPin: this.activeUser.pin,
          votes: 0,
          views: 1,
          likes: 0,
          approved: isApproved, // অটো-অ্যাপ্রুভ চালু থাকলে সরাসরি লাইভ, নয়তো পেন্ডিং
          status: isApproved ? "approved" : "pending",
          date: new Date().toISOString()
        };

        const savedPhoto = await this.db.addPhoto(newPhoto);
        if (savedPhoto && savedPhoto.error) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = "<span>📤 ছবিসহ সরাসরি পাঠান</span>";
          this.showToast(savedPhoto.message || "ছবি আপলোড করা যায়নি!", "error");
          return;
        }
        this.activeUser = this.db.getUser(this.activeUser.pin) || this.activeUser;
        const liveApproved = savedPhoto && typeof savedPhoto.approved === "boolean" ? savedPhoto.approved : isApproved;

        // ইউজারের ইনবক্সে তাৎক্ষণিক নোটিফিকেশন দেওয়া
        if (liveApproved) {
          await this.db.sendNotification(this.activeUser.pin, {
            title: "🎉 আপনার ছবি সরাসরি লাইভ হয়েছে!",
            message: `আপনার "${title}" ছবিটি সরাসরি গ্যালারিতে লাইভ হয়েছে। এখনই বন্ধুদের সাথে শেয়ার করে ভোট জোগাড় করুন!`,
            type: "approved",
            date: new Date().toISOString()
          });
        } else {
          await this.db.sendNotification(this.activeUser.pin, {
            title: "ছবি সফলভাবে জমা হয়েছে!",
            message: `আপনার "${title}" ছবিটি অ্যাডমিনের কাছে সফলভাবে জমা হয়েছে। অ্যাডমিন যাচাই করে অনুমোদন দেওয়ার পর পাবলিক ফিডে লাইভ হবে।`,
            type: "pending",
            date: new Date().toISOString()
          });
        }

        // ফর্ম রিসেট
        document.getElementById("upload-form").reset();
        const dropContent = document.getElementById("up-drop-content");
        const previewWrap = document.getElementById("up-preview-wrap");
        if (dropContent) dropContent.classList.remove("hidden");
        if (previewWrap) previewWrap.classList.add("hidden");

        submitBtn.disabled = false;
        submitBtn.innerHTML = "<span>📤 ছবিসহ সরাসরি পাঠান</span>";
        this.closeModals();

        if (isApproved) { this.showToast("🎉 আপনার ছবিটি সরাসরি গ্যালারিতে লাইভ হয়েছে!", "success"); } else { this.showToast("🎉 আপনার ছবিটি জমা হয়েছে! অ্যাডমিনের অনুমোদনের পর সাইটে লাইভ হবে।", "info"); }
        this.updateInboxBadge();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ১০. লগইন ও রেজিস্ট্রেশন মডাল
  openAuthModal() {
    const modal = document.getElementById("auth-modal");
    if (modal) modal.classList.remove("hidden");
  }

  async handleLogin(e) {
    e.preventDefault();
    const pin = document.getElementById("login-pin").value.trim();
    if (!pin) return;

    const res = await this.db.loginUser(pin);
    if (res.success && res.user) {
      this.activeUser = res.user;
      localStorage.setItem("peg_auth_pin", pin);
      this.updateUserNavButton();
      this.closeModals();
      this.showToast(`স্বাগতম, ${res.user.name}! আপনি লগইন করেছেন।`, "success");
    } else {
      this.showToast(res.message || "ভুল পিন! একাউন্ট না থাকলে রেজিস্ট্রেশন করুন।", "error");
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById("reg-name").value.trim();
    const phone = document.getElementById("reg-phone").value.trim();
    const pin = document.getElementById("reg-pin").value.trim();
    const ref = document.getElementById("reg-ref").value.trim();

    if (!name || !phone || !pin) {
      this.showToast("দয়া করে নাম, মোবাইল নম্বর এবং ৪ ডিজিটের পিন দিন!", "warning");
      return;
    }

    if (pin.length < 4) {
      this.showToast("পিন কমপক্ষে ৪ সংখ্যার হতে হবে!", "warning");
      return;
    }

    const res = await this.db.registerUser(pin, name, phone, ref);
    if (res.success && res.user) {
      this.activeUser = res.user;
      localStorage.setItem("peg_auth_pin", pin);
      this.updateUserNavButton();
      this.closeModals();
      this.showToast(`একাউন্ট সফলভাবে তৈরি হয়েছে! বোনাস ২০ পয়েন্ট যোগ হয়েছে। 🎉`, "success");
    } else {
      this.showToast(res.message, "error");
    }
  }

  // ১১. প্রোফাইল ও উইথড্র মডাল (লাইভ ভোট, ভিউ, ফলোয়ার ও ছবি লিমিট স্ট্যাটাস সহ)
  async openProfileModal() {
    if (!this.activeUser) return;
    const modal = document.getElementById("profile-modal");
    const content = document.getElementById("profile-modal-content");
    if (!modal || !content) return;

    // তাৎক্ষণিক ক্যাশড প্রিভিউ রেন্ডার + ব্যাকগ্রাউন্ডে সার্ভার থেকে লাইভ ভোট/ফলোয়ার/ছবি ডাটা আনা
    this.activeUser = this.db.getUser(this.activeUser.pin) || this.activeUser;
    this._renderProfileContent(content, this.activeUser, true);
    modal.classList.remove("hidden");

    const fresh = await this.db.fetchUserStats(this.activeUser.pin);
    if (fresh && !modal.classList.contains("hidden")) {
      this.activeUser = fresh;
      this._renderProfileContent(content, fresh, false);
    }
  }

  _renderProfileContent(content, u, isLoading = false) {
    const pinStr = String(u.pin || "");
    const fallbackPhotos = (this.photos || []).filter(p => String(p.authorPin || "") === pinStr);
    const myPhotos = Array.isArray(u.myPhotos) ? u.myPhotos : fallbackPhotos;
    const photosCount = Math.max(parseInt(u.photosCount ?? 0, 10), myPhotos.length);
    const approvedCount = u.approvedCount !== undefined
      ? parseInt(u.approvedCount, 10)
      : myPhotos.filter(p => !!p.approved || p.status === "approved").length;
    const pendingCount = u.pendingCount !== undefined
      ? parseInt(u.pendingCount, 10)
      : Math.max(0, photosCount - approvedCount);
    const totalVotes = u.totalVotes !== undefined
      ? parseInt(u.totalVotes, 10)
      : myPhotos.reduce((s, p) => s + parseInt(p.votes || 0, 10), 0);
    const totalViews = u.totalViews !== undefined
      ? parseInt(u.totalViews, 10)
      : myPhotos.reduce((s, p) => s + parseInt(p.views || 0, 10), 0);
    const followersCount = parseInt(u.followersCount || 0, 10);
    const referralsCount = parseInt(u.referralsCount || 0, 10);
    const cachedMax = parseInt(localStorage.getItem("peg_max_photos_per_user") || this.cfg.maxPhotosPerUser || "0", 10);
    const maxPhotos = u.max_photos_per_user !== undefined ? Math.max(0, parseInt(u.max_photos_per_user, 10)) : Math.max(0, cachedMax);
    const minWdPhotos = this.cfg.minPhotosForWithdraw || 3;
    const safeName = this.escapeHtml(u.name || "শিল্পী");
    const safePhone = this.escapeHtml(u.phone || "");
    const safeRef = this.escapeHtml(u.refCode || ("REF" + pinStr));

    let limitBanner = "";
    if (maxPhotos > 0) {
      const remaining = Math.max(0, maxPhotos - photosCount);
      limitBanner = remaining === 0
        ? `<div class="mt-3 px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-[11px] font-bold text-rose-600 dark:text-rose-300 text-center">🚫 আপলোড লিমিট পূর্ণ হয়েছে (${photosCount}/${maxPhotos}টি)</div>`
        : `<div class="mt-3 px-3 py-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-[11px] font-bold text-sky-700 dark:text-sky-300 text-center">📸 আপলোড সীমা: ${photosCount}/${maxPhotos}টি (আরও ${remaining}টি ছবি দিতে পারবেন)</div>`;
    } else {
      limitBanner = `<div class="mt-3 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 text-center">♾️ আপলোড সীমা: আনলিমিটেড (আপনি যত খুশি ছবি দিতে পারবেন)</div>`;
    }

    const myPhotosHtml = myPhotos.length > 0
      ? myPhotos.slice(0, 20).map(p => {
          const isApp = !!p.approved || p.status === "approved";
          const pVotes = parseInt(p.votes || 0, 10);
          const pViews = parseInt(p.views || 0, 10);
          const pTitle = this.escapeHtml(p.title || "শিরোনামহীন ছবি");
          return `
            <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-white/5 text-xs">
              <div class="flex items-center gap-2 min-w-0">
                ${p.url ? `<img src="${this.escapeHtml(p.url)}" alt="${pTitle}" class="w-9 h-9 rounded-lg object-cover shrink-0 bg-slate-700">` : `<div class="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">🖼️</div>`}
                <div class="min-w-0">
                  <div class="font-bold text-slate-900 dark:text-white truncate text-[11px]">${pTitle}</div>
                  <div class="text-[10px] ${isApp ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-300'} font-semibold">
                    ${isApp ? '✅ লাইভ' : '⏳ পেন্ডিং'}
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0 text-[11px] font-bold">
                <span class="text-rose-600 dark:text-rose-400">❤️ ${pVotes}</span>
                <span class="text-sky-600 dark:text-sky-400">👁️ ${pViews}</span>
              </div>
            </div>`;
        }).join("")
      : `<div class="text-center py-3 text-[11px] text-gray-500">আপনি এখনো কোনো ছবি আপলোড করেননি।</div>`;

    content.innerHTML = `
      <div class="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-white/10 pr-8">
        <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white text-lg font-bold shadow-md shrink-0">
          ${safeName.charAt(0)}
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="font-bold text-white text-base truncate">${safeName}</h3>
            ${isLoading ? `<span class="text-[10px] text-amber-500 font-semibold animate-pulse">আপডেট হচ্ছে…</span>` : ""}
          </div>
          <p class="text-xs text-gray-400">পিন: ****${pinStr.slice(-2)} · ফোন: ${safePhone}</p>
        </div>
      </div>

      ${limitBanner}

      <!-- ব্যালেন্স ও ৪-কার্ড পারফরম্যান্স স্ট্যাটাস -->
      <div class="grid grid-cols-2 gap-2.5 my-3">
        <div class="p-3 bg-slate-900 rounded-xl border border-indigo-500/20 text-center">
          <span class="text-[11px] text-gray-400">💰 মোট ব্যালেন্স</span>
          <div class="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">৳${parseFloat(u.taka || 0).toFixed(2)}</div>
          <span class="text-[10px] text-gray-500">${u.points || 0} পয়েন্ট</span>
        </div>
        <div class="p-3 bg-slate-900 rounded-xl border border-purple-500/20 text-center">
          <span class="text-[11px] text-gray-400">📸 আপলোডকৃত ছবি</span>
          <div class="text-lg font-extrabold text-purple-600 dark:text-purple-400 mt-0.5">${maxPhotos > 0 ? `${photosCount} / ${maxPhotos}` : `${photosCount} টি`}</div>
          <span class="text-[10px] text-gray-500">${approvedCount} লাইভ · ${pendingCount} পেন্ডিং</span>
        </div>
        <div class="p-3 bg-slate-900 rounded-xl border border-rose-500/20 text-center">
          <span class="text-[11px] text-gray-400">❤️ মোট ভোট / লাইক</span>
          <div class="text-lg font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">${totalVotes} টি</div>
          <span class="text-[10px] text-gray-500">👁️ ${totalViews} বার ভিউ</span>
        </div>
        <div class="p-3 bg-slate-900 rounded-xl border border-sky-500/20 text-center">
          <span class="text-[11px] text-gray-400">👥 মোট ফলোয়ার</span>
          <div class="text-lg font-extrabold text-sky-600 dark:text-sky-400 mt-0.5">${followersCount} জন</div>
          <span class="text-[10px] text-gray-500">🎁 রেফার: ${referralsCount} জন</span>
        </div>
      </div>

      <!-- আমার আপলোড করা ছবির পারফরম্যান্স -->
      <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 mb-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-slate-700 dark:text-gray-200">🖼️ আমার ছবি ও ভোট রিপোর্ট</span>
          <span class="text-[10px] text-gray-500">উইথড্র শর্ত: ${minWdPhotos}টি ছবি</span>
        </div>
        <div class="max-h-36 overflow-y-auto space-y-1.5 pr-1">
          ${myPhotosHtml}
        </div>
      </div>

      <!-- টেলিগ্রাম সাবস্ক্রিপশন ও বোনাস কার্ড -->
      ${!u.telegramBonus ? `
        <div class="p-3 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-500/30 rounded-xl mb-3 flex items-center justify-between gap-2">
          <div>
            <b class="text-indigo-700 dark:text-indigo-300 text-xs block">🎁 টেলিগ্রাম বোনাস ৳১০</b>
            <span class="text-[11px] text-slate-600 dark:text-gray-400">চ্যানেলে জয়েন করে ইনস্ট্যান্ট বোনাস নিন</span>
          </div>
          <button onclick="window.APP.claimTelegramBonus()" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold whitespace-nowrap">
            ক্লেইম করুন
          </button>
        </div>
      ` : `
        <div class="px-3 py-2 bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-white/10 rounded-xl mb-3 flex items-center justify-between gap-2 text-[11px]">
          <span class="font-semibold ${localStorage.getItem('peg_tg_unsubscribed') === 'true' ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-400'}">
            ${localStorage.getItem('peg_tg_unsubscribed') === 'true' ? '✈️ টেলিগ্রাম রিমাইন্ডার চালু আছে' : '✈️ টেলিগ্রাম চ্যানেলে যুক্ত আছেন ✓'}
          </span>
          ${localStorage.getItem('peg_tg_unsubscribed') === 'true'
            ? `<a href="${this.cfg.supportTelegram || 'https://t.me/photoearnOfficial'}" target="_blank" rel="noopener" onclick="window.APP.markTelegramSubscribed(true)" class="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[10px] font-bold whitespace-nowrap">যুক্ত হোন</a>`
            : `<button onclick="window.APP.resetTelegramSubscription()" class="text-[10px] text-slate-500 hover:text-rose-500 underline whitespace-nowrap">আনসাবস্ক্রাইব করেছেন?</button>`
          }
        </div>
      `}

      <!-- রেফারেল লিংক -->
      <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 mb-3">
        <label class="text-xs text-gray-400 block mb-1">আপনার রেফারেল কোড:</label>
        <div class="flex items-center gap-2">
          <input type="text" readonly value="${safeRef}" class="w-full bg-slate-800 text-xs text-amber-300 px-3 py-2 rounded-lg border border-slate-700 outline-none">
          <button onclick="navigator.clipboard.writeText('${window.location.origin}/?ref=${safeRef}'); window.APP.showToast('রেফারেল লিংক কপি হয়েছে!', 'success')" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap">
            কপি
          </button>
        </div>
      </div>

      <!-- উইথড্র ফর্ম -->
      <form id="withdraw-form" onsubmit="window.APP.handleWithdraw(event)" class="space-y-3 pt-2 border-t border-white/10">
        <h4 class="text-xs font-bold text-gray-300 uppercase tracking-wider">টাকা উইথড্র করুন (বিকাশ / নগদ)</h4>
        
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[11px] text-gray-400">পেমেন্ট মেথড</label>
            <select id="wd-method" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none">
              <option value="bkash">bKash (বিকাশ)</option>
              <option value="nagad">Nagad (নগদ)</option>
              <option value="rocket">Rocket (রকেট)</option>
            </select>
          </div>
          <div>
            <label class="text-[11px] text-gray-400">উইথড্র টাকার পরিমাণ</label>
            <input type="number" id="wd-amount" min="50" step="10" placeholder="৳50" required class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none">
          </div>
        </div>

        <div>
          <label class="text-[11px] text-gray-400">বিকাশ/নগদ নম্বর</label>
          <input type="text" id="wd-phone" value="${safePhone}" required placeholder="01XXXXXXXXX" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none">
        </div>

        <button type="submit" class="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-xs font-bold shadow-lg transition-transform active:scale-95">
          টাকা তোলার আবেদন করুন
        </button>
      </form>

      
        <!-- সরাসরি অ্যাডমিন প্যানেল লিংক -->
        <div class="pt-3 border-t border-white/10">
          <a href="/admin.html" class="block w-full py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-xl border border-amber-400/20 text-center transition-all">
            ⚙️ অ্যাডমিন ড্যাশবোর্ডে যান ➔
          </a>
        </div>

      <button onclick="window.APP.handleLogout()" class="w-full mt-3 py-1.5 text-gray-500 hover:text-rose-400 text-xs font-semibold transition-colors">
        লগআউট করুন
      </button>
    `;
  }

  // টেলিগ্রাম বোনাস ক্লেইম
  async claimTelegramBonus() {
    if (!this.activeUser) return;
    // প্রথমে টেলিগ্রাম চ্যানেল ওপেন
    if (this.cfg.supportTelegram) {
      window.open(this.cfg.supportTelegram, "_blank");
    }
    const res = await this.db.claimTelegramBonus(this.activeUser.pin);
    if (res.success) {
      localStorage.setItem("peg_tg_subscribed", "true");
      localStorage.removeItem("peg_tg_unsubscribed");
      this.activeUser = res.user;
      this.updateUserNavButton();
      this.openProfileModal();
      this.showToast(res.message, "success");
    } else {
      this.showToast(res.message, "warning");
    }
  }

  // উইথড্র সাবমিট
  async handleWithdraw(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById("wd-amount").value);
    const phone = document.getElementById("wd-phone").value.trim();
    const method = document.getElementById("wd-method").value;

    const res = await this.db.requestWithdraw(this.activeUser.pin, phone, amount, method);
    if (res.success) {
      this.activeUser = this.db.getUser(this.activeUser.pin);
      this.updateUserNavButton();
      this.closeModals();
      this.showToast(res.message, "success");
    } else {
      this.showToast(res.message, "error");
    }
  }

  handleLogout() {
    localStorage.removeItem("peg_auth_pin");
    this.activeUser = null;
    this.updateUserNavButton();
    this.closeModals();
    this.showToast("সফলভাবে লগআউট হয়েছে!", "info");
  }

  // ১২. লিডারবোর্ড রেন্ডারিং
  async renderLeaderboard() {
    const listEl = document.getElementById("leaderboard-list");
    if (!listEl) return;

    const photos = await this.db.getPhotos();
    // ভোটের ক্রমানুসারে সর্ট
    const sorted = [...photos].sort((a, b) => (b.votes || 0) - (a.votes || 0)).slice(0, 10);

    let html = "";
    sorted.forEach((p, index) => {
      let rankColor = "text-gray-400";
      let rankBadge = `${index + 1}`;
      if (index === 0) {
        rankBadge = "🥇 ১ম";
        rankColor = "text-amber-400 font-extrabold";
      } else if (index === 1) {
        rankBadge = "🥈 ২য়";
        rankColor = "text-slate-300 font-bold";
      } else if (index === 2) {
        rankBadge = "🥉 ৩য়";
        rankColor = "text-amber-600 font-bold";
      }

      html += `
        <div class="glass-panel p-3 rounded-xl flex items-center justify-between gap-3 border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900/60 shadow-sm">
          <div class="flex items-center gap-3">
            <span class="text-sm ${rankColor} w-10 text-center">${rankBadge}</span>
            <img src="${p.url}" alt="${p.title}" class="w-12 h-12 rounded-lg object-cover bg-slate-900">
            <div>
              <h4 class="font-bold text-slate-900 dark:text-white text-xs line-clamp-1">${p.title}</h4>
              <p class="text-[11px] text-slate-600 dark:text-gray-400 font-medium">${p.authorName} · ${p.category}</p>
            </div>
          </div>
          <div class="text-right">
            <span class="text-rose-600 dark:text-rose-400 font-bold text-xs">❤️ ${p.votes || 0} ভোট</span>
            <span class="text-[10px] text-slate-500 dark:text-gray-400 block font-medium">👁️ ${p.views || 0} ভিউ</span>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;
  }

  // ১৩. থিম ভোটিং রেন্ডারিং
  renderThemeVotes() {
    const container = document.getElementById("theme-vote-list");
    if (!container) return;

    const themes = this.cfg.activeThemes || ["গ্রামের দৃশ্য", "শীতের সকাল", "পাখির ছবি", "নদী ও নৌকা"];
    let votes = JSON.parse(localStorage.getItem("peg_theme_votes") || "{}");

    let html = "";
    themes.forEach(theme => {
      const vCount = votes[theme] || Math.floor(Math.random() * 40) + 10;
      html += `
        <div class="glass-panel p-4 rounded-xl flex items-center justify-between gap-3 border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900/60 shadow-sm">
          <div>
            <h4 class="font-bold text-slate-900 dark:text-white text-sm">📷 ${theme}</h4>
            <span class="text-xs text-slate-600 dark:text-gray-400 font-medium">বর্তমান ভোট: <b class="text-indigo-600 dark:text-indigo-400 font-bold">${vCount}</b></span>
          </div>
          <button onclick="window.APP.voteTheme('${theme}')" class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition-all">
            ভোট দিন
          </button>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  voteTheme(theme) {
    let votes = JSON.parse(localStorage.getItem("peg_theme_votes") || "{}");
    votes[theme] = (votes[theme] || 0) + 1;
    localStorage.setItem("peg_theme_votes", JSON.stringify(votes));
    this.showToast(`"${theme}" থিমে আপনার ভোট যোগ হয়েছে!`, "success");
    this.renderThemeVotes();
  }

  // ১৪. রিয়েল-টাইম কনটেস্ট টাইমার
  startContestTimers() {
    const update = () => {
      const now = new Date();
      // ২৪ ঘণ্টার টাইমার (আজ রাত ১২টা পর্যন্ত)
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      const diff24 = Math.max(0, endOfDay - now);
      const h24 = Math.floor(diff24 / 3600000);
      const m24 = Math.floor((diff24 % 3600000) / 60000);
      const s24 = Math.floor((diff24 % 60000) / 1000);

      const timerEl = document.getElementById("timer-24h");
      if (timerEl) {
        timerEl.innerText = `${String(h24).padStart(2, '0')}:${String(m24).padStart(2, '0')}:${String(s24).padStart(2, '0')}`;
      }
      const mobTimerEl = document.getElementById("timer-24h-mob");
      if (mobTimerEl) {
        mobTimerEl.innerText = `${String(h24).padStart(2, '0')}:${String(m24).padStart(2, '0')}:${String(s24).padStart(2, '0')}`;
      }
    };
    setInterval(update, 1000);
    update();
  }

  isPwaInstalled() {
    if (window.__isPwaStandalone && window.__isPwaStandalone()) {
      localStorage.setItem("pwa_installed", "true");
      return true;
    }
    return localStorage.getItem("pwa_installed") === "true";
  }

  isTelegramSubscribed() {
    if (localStorage.getItem("peg_tg_unsubscribed") === "true") return false;
    if (localStorage.getItem("peg_tg_subscribed") === "true") return true;
    return !!(this.activeUser && this.activeUser.telegramBonus);
  }

  markTelegramSubscribed(reopenProfile = false) {
    localStorage.setItem("peg_tg_subscribed", "true");
    localStorage.removeItem("peg_tg_unsubscribed");
    localStorage.removeItem("peg_tg_snooze_until");
    sessionStorage.setItem("tg_popup_shown", "true");
    this.closeModals();
    this.showToast("✈️ টেলিগ্রামে যুক্ত হওয়ার জন্য ধন্যবাদ! আর এই পপআপ দেখাবে না।", "success");
    if (reopenProfile && this.activeUser) {
      this.openProfileModal();
    }
  }

  snoozeTelegramPopup() {
    const dayLater = Date.now() + 24 * 3600 * 1000;
    localStorage.setItem("peg_tg_snooze_until", String(dayLater));
    sessionStorage.setItem("tg_popup_shown", "true");
    this.closeModals();
  }

  resetTelegramSubscription() {
    localStorage.removeItem("peg_tg_subscribed");
    localStorage.removeItem("peg_tg_snooze_until");
    localStorage.setItem("peg_tg_unsubscribed", "true");
    sessionStorage.removeItem("tg_popup_shown");
    this.showToast("🔔 টেলিগ্রাম রিমাইন্ডার পুনরায় চালু হয়েছে। এখন থেকে চ্যানেল নোটিফিকেশন দেখাবে।", "info");
    if (this.activeUser) this.openProfileModal();
  }

  // ১৫. পপআপ (টেলিগ্রাম চ্যানেল ও PWA নোটিস - ইউটিউব বন্ধ)
  setupPopups() {
    // টেলিগ্রাম চ্যানেল পপআপ (সাবস্ক্রাইব করলে আর দেখাবে না; আনসাবস্ক্রাইব টগল করলে আবার দেখাবে)
    const tgSnoozedUntil = parseInt(localStorage.getItem("peg_tg_snooze_until") || "0", 10);
    if (
      this.cfg.telegramPopupEnabled &&
      !this.isTelegramSubscribed() &&
      Date.now() > tgSnoozedUntil &&
      !sessionStorage.getItem("tg_popup_shown")
    ) {
      const delay = (this.cfg.telegramPopupDelaySeconds || 20) * 1000;
      setTimeout(() => {
        if (this.isTelegramSubscribed()) return;
        sessionStorage.setItem("tg_popup_shown", "true");
        const modal = document.getElementById("telegram-join-modal");
        if (modal) modal.classList.remove("hidden");
      }, delay);
    }

    // PWA অ্যাপ ইনস্টল ব্যানার প্রম্পট (ইনস্টল বা স্ট্যান্ডঅ্যালোন অ্যাপ হলে আর দেখাবে না)
    const banner = document.getElementById("pwa-install-banner");
    const topPwaBtn = document.getElementById("pwa-top-btn");
    if (this.isPwaInstalled()) {
      if (banner) banner.classList.add("hidden");
      if (topPwaBtn) topPwaBtn.classList.add("hidden");
      return;
    }

    if (this.cfg.pwa && this.cfg.pwa.enabled && !localStorage.getItem("pwa_dismissed")) {
      const pwaDelay = (this.cfg.pwa.promptDelaySeconds || 35) * 1000;
      setTimeout(async () => {
        if (this.isPwaInstalled() || localStorage.getItem("pwa_dismissed")) return;
        if (navigator.getInstalledRelatedApps) {
          try {
            const apps = await navigator.getInstalledRelatedApps();
            if (Array.isArray(apps) && apps.length > 0) {
              localStorage.setItem("pwa_installed", "true");
              if (banner) banner.classList.add("hidden");
              if (topPwaBtn) topPwaBtn.classList.add("hidden");
              return;
            }
          } catch (e) {}
        }
        if (banner) banner.classList.remove("hidden");
      }, pwaDelay);
    }
  }

  // PWA অ্যাপ ইনস্টল ট্রিগার
  async triggerPwaInstall() {
    if (this.isPwaInstalled()) {
      const banner = document.getElementById("pwa-install-banner");
      if (banner) banner.classList.add("hidden");
      const topPwaBtn = document.getElementById("pwa-top-btn");
      if (topPwaBtn) topPwaBtn.classList.add("hidden");
      return;
    }
    if (window.__deferredPrompt) {
      window.__deferredPrompt.prompt();
      const { outcome } = await window.__deferredPrompt.userChoice;
      if (outcome === "accepted") {
        localStorage.setItem("pwa_installed", "true");
        const topPwaBtn = document.getElementById("pwa-top-btn");
        if (topPwaBtn) topPwaBtn.classList.add("hidden");
        this.showToast("অ্যাপ সফলভাবে ইনস্টল হচ্ছে! হোম স্ক্রিনে চেক করুন। 🎉", "success");
      }
      window.__deferredPrompt = null;
      const banner = document.getElementById("pwa-install-banner");
      if (banner) banner.classList.add("hidden");
    } else {
      this.showToast("আপনার ব্রাউজারের থ্রি-ডট (⋮) অপশনে গিয়ে 'Add to Home screen' বা 'Install app' চাপুন।", "info");
    }
  }

  dismissPwaBanner() {
    localStorage.setItem("pwa_dismissed", "true");
    const banner = document.getElementById("pwa-install-banner");
    if (banner) banner.classList.add("hidden");
  }

  // GalleryBD স্টাইল হিউম্যান ভেরিফাই (Adsterra ডিরেক্ট লিংক ওপেন + ৫ সেকেন্ড অপেক্ষা)
  triggerUploadVerify() {
    const btn = document.getElementById("up-verify-btn");
    const verifyBox = document.getElementById("up-verify-box");
    const submitBtn = document.getElementById("up-submit-btn");

    const adUrl = (this.cfg.ads && this.cfg.ads.sponsorDirectLink) ? this.cfg.ads.sponsorDirectLink : "https://araplhn.org/4/7decde193b07302555c7d1b18a2dfcbe";
    window.open(adUrl, "_blank");

    let count = (this.cfg.ads && this.cfg.ads.uploadWaitSeconds) || 5;
    if (btn) btn.disabled = true;

    const timer = setInterval(() => {
      if (count > 0) {
        if (btn) btn.innerHTML = `<span>⏳ স্পনসর পেজ ভেরিফাই হচ্ছে... ${count} সেকেন্ড</span>`;
        count--;
      } else {
        clearInterval(timer);
        sessionStorage.setItem("up_human_verified", "true");
        if (verifyBox) {
          verifyBox.innerHTML = `
            <div class="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-center text-xs text-emerald-300 font-bold flex items-center justify-center gap-2">
              <span>✅</span>
              <span>হিউম্যান ভেরিফিকেশন সফল হয়েছে! এখন ছবি জমা দিন।</span>
            </div>
          `;
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove("opacity-50", "cursor-not-allowed");
        }
        this.showToast("ভেরিফিকেশন সফল! এখন ফর্ম পূরণ করে ছবি জমা দিন।", "success");
      }
    }, 1000);
  }

  // লাইভ পাবলিক চ্যাট ইঞ্জিন (GalleryBD স্টাইল - Firebase Powered)
  initLiveChat() {
    this.chatOpen = false;
    const chatBtn = document.getElementById("lc-btn");
    const chatBox = document.getElementById("lc-box");
    const chatClose = document.getElementById("lc-close");
    const chatForm = document.getElementById("lc-form");

    if (chatBtn) chatBtn.addEventListener("click", () => this.toggleLiveChat());
    if (chatClose) chatClose.addEventListener("click", () => this.toggleLiveChat(false));
    if (chatForm) chatForm.addEventListener("submit", (e) => this.handleSendChatMessage(e));

    // প্রতি ৩.৫ সেকেন্ডে চ্যাট আপডেট
    if (this.cfg.chat && this.cfg.chat.enabled) {
      this.pollChatMessages();
      setInterval(() => {
        if (this.chatOpen) {
          this.pollChatMessages();
        }
      }, this.cfg.chat.pollIntervalMs || 3500);
    }
  }

  toggleLiveChat(forceState) {
    const box = document.getElementById("lc-box");
    if (!box) return;
    this.chatOpen = forceState !== undefined ? forceState : !this.chatOpen;
    if (this.chatOpen) {
      box.classList.remove("hidden");
      box.classList.add("flex");
      this.pollChatMessages(true);
      const badge = document.getElementById("lc-badge");
      if (badge) badge.classList.add("hidden");

      const nameRow = document.getElementById("lc-name-row");
      if (nameRow) {
        if (this.activeUser) {
          nameRow.classList.add("hidden");
        } else {
          nameRow.classList.remove("hidden");
        }
      }

      setTimeout(() => {
        const input = document.getElementById("lc-input");
        if (input) input.focus();
      }, 100);
    } else {
      box.classList.add("hidden");
      box.classList.remove("flex");
    }
  }

  async pollChatMessages(scrollToEnd = false) {
    const messages = await this.db.getChatMessages();
    this.renderChatMessages(messages, scrollToEnd);
  }

  renderChatMessages(messages, scrollToEnd) {
    const container = document.getElementById("lc-messages");
    if (!container) return;

    if (!messages || messages.length === 0) {
      container.innerHTML = `<div class="text-center py-8 text-gray-500 text-xs">এখনও কোনো বার্তা নেই। প্রথম বার্তাটি আপনি পাঠান! 😊</div>`;
      return;
    }

    const currentPin = this.activeUser ? this.activeUser.pin : "";
    const currentSenderId = this.activeUser ? (this.activeUser.creatorId || `u_${this.activeUser.pin}`) : (localStorage.getItem("peg_guest_chat_id") || "");
    let html = "";
    messages.forEach(msg => {
      const isMe = (currentSenderId && msg.senderId === currentSenderId) || (currentPin && msg.pin === currentPin);
      const isAdmin = !!msg.isAdmin;
      const timeStr = msg.time ? new Date(msg.time).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" }) : "";

      if (isMe) {
        html += `
          <div class="flex flex-col items-end mb-2.5">
            <div class="bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-medium px-3.5 py-2 rounded-2xl rounded-tr-none text-xs shadow max-w-[85%] break-words">
              ${this.escapeHtml(msg.text)}
            </div>
            <span class="text-[9px] text-gray-400 mt-0.5">${timeStr} • আপনি</span>
          </div>
        `;
      } else {
        html += `
          <div class="flex flex-col items-start mb-2.5">
            <div class="flex items-center gap-1.5 mb-0.5">
              <span class="text-[10px] font-bold ${isAdmin ? 'text-amber-400' : 'text-indigo-300'}">${this.escapeHtml(msg.name || 'অতিথি')}</span>
              ${isAdmin ? '<span class="bg-amber-500 text-slate-950 px-1 py-0.2 rounded text-[8px] font-black uppercase">ADMIN</span>' : ''}
              <span class="text-[9px] text-gray-500">${timeStr}</span>
            </div>
            <div class="bg-slate-800 text-gray-200 border border-slate-700/60 px-3.5 py-2 rounded-2xl rounded-tl-none text-xs shadow max-w-[85%] break-words">
              ${this.escapeHtml(msg.text)}
            </div>
          </div>
        `;
      }
    });

    container.innerHTML = html;
    if (scrollToEnd) {
      container.scrollTop = container.scrollHeight;
    }
  }

  async handleSendChatMessage(e) {
    e.preventDefault();
    const input = document.getElementById("lc-input");
    const nameInput = document.getElementById("lc-name-input");
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    let authorName = this.activeUser ? this.activeUser.name : (nameInput ? nameInput.value.trim() : "");
    if (!authorName) {
      authorName = "ভিজিটর_" + Math.floor(Math.random() * 900 + 100);
      if (nameInput) nameInput.value = authorName;
    }

    const authorPin = this.activeUser ? this.activeUser.pin : "";
    input.value = "";

    await this.db.sendChatMessage(text, authorName, authorPin);
    await this.pollChatMessages(true);
  }

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ১৬. ইউআরএল প্যারামিটার চেকিং (রেফারেল ইত্যাদি)
  checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      localStorage.setItem("peg_pending_ref", ref);
      this.showToast(`রেফারেল আমন্ত্রণ পেয়েছেন! একাউন্ট খুলে ২০ পয়েন্ট নিন।`, "info");
    }
    const view = params.get("view");
    if (view) {
      this.switchTab(view);
    }
    // সরাসরি ছবির লিঙ্কে ঢুকলে অটোমেটিক সেই ছবির মডাল ওপেন হবে (ভাইরাল ট্রাফিকের জন্য)
    const photoId = params.get("p") || params.get("photo");
    if (photoId) {
      setTimeout(() => this.openPhotoModal(photoId), 600);
    }
  }

  // সোশ্যাল মিডিয়া ভাইরাল শেয়ার হ্যান্ডলার (ডাইনামিক OG প্রিভিউ সহ)
  shareToWhatsApp(photoId, photoTitle) {
    const siteUrl = (this.cfg.siteUrl || window.location.origin).replace(/\/$/, "");
    const shareUrl = `${siteUrl}/share.php?p=${photoId}`;
    const text = `🔥 "${photoTitle || 'আমার তোলা চমৎকার ছবি'}"-এ ভোট দিন এবং প্রতিদিন জিতে নিন নগদ বিকাশ পুরস্কার!\n\n👉 ভোট দিতে এখানে ক্লিক করুন: ${shareUrl}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
    this.showToast("WhatsApp শেয়ার উইন্ডো ওপেন হয়েছে!", "success");
  }

  shareToFacebook(photoId) {
    const siteUrl = (this.cfg.siteUrl || window.location.origin).replace(/\/$/, "");
    const shareUrl = `${siteUrl}/share.php?p=${photoId}`;
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(fbUrl, "_blank");
    this.showToast("Facebook শেয়ার উইন্ডো ওপেন হয়েছে!", "success");
  }

  copyShareLink(photoId) {
    const siteUrl = (this.cfg.siteUrl || window.location.origin).replace(/\/$/, "");
    const shareUrl = `${siteUrl}/share.php?p=${photoId}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        this.showToast("🔗 ছবির ভোট দেওয়ার লিঙ্ক কপি হয়েছে!", "success");
      }).catch(() => {
        prompt("ছবির লিঙ্কটি কপি করুন:", shareUrl);
      });
    } else {
      prompt("ছবির লিঙ্কটি কপি করুন:", shareUrl);
    }
  }

  // মডাল ক্লোজ
  closeModals() {
    document.querySelectorAll(".app-modal").forEach(m => m.classList.add("hidden"));
  }

  // টোস্ট নোটিফিকেশন
  showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "toast";

    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    if (type === "warning") icon = "⚠️";
    if (type === "error") icon = "❌";

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ========================================================
  // 💰 পেইড ছবি, ইনবক্স ও সার্টিফিকেট মেথডস (GalleryBD স্টাইল)
  // ========================================================

  togglePriceInput(type) {
    const wrap = document.getElementById("up-price-wrap");
    const input = document.getElementById("up-price");
    if (!wrap || !input) return;
    if (type === "PAID") {
      wrap.classList.remove("hidden");
      input.required = true;
      input.focus();
    } else {
      wrap.classList.add("hidden");
      input.required = false;
      input.value = "";
    }
  }

  // পেইড ছবি কেনার পপআপ (Buy Modal)
  async openBuyModal(photoId) {
    const photos = await this.db.getPhotos();
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;

    const modal = document.getElementById("buy-modal");
    const content = document.getElementById("buy-modal-content");
    if (!modal || !content) return;

    const bkash = this.cfg.bkashNumber || "01771136809";
    const nagad = this.cfg.nagadNumber || "01771136809";
    const rocket = this.cfg.rocketNumber || "01771136809";
    const price = photo.price || 10;

    const waMsg = encodeURIComponent(`🛒 ছবি কিনতে চাই!\nছবি: ${photo.title}\nPhoto ID: ${photo.id}\nমূল্য: ৳${price}\nশিল্পী: ${photo.authorName}\nআমার নাম: ${this.activeUser ? this.activeUser.name : ''}\nআমার TrxID: `);
    const waUrl = `https://wa.me/8801771136809?text=${waMsg}`;

    content.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-white/10">
          <img src="${photo.url}" alt="${photo.title}" class="w-16 h-16 rounded-xl object-cover flex-shrink-0">
          <div class="overflow-hidden">
            <span class="inline-block px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px] uppercase mb-1">পেইড ছবি • ৳${price}</span>
            <h4 class="text-sm font-bold text-gray-900 dark:text-white truncate">${photo.title}</h4>
            <p class="text-xs text-gray-600 dark:text-gray-400">ফটোগ্রাফার: <b class="text-indigo-600 dark:text-indigo-400">${photo.authorName}</b></p>
          </div>
        </div>

        <div class="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
          নিচের যেকোনো নম্বরে <b>৳${price}</b> সেন্ড মানি (Send Money) করুন, তারপর ট্রানজেকশন আইডি (TrxID) দিয়ে সাবমিট করুন বা সরাসরি WhatsApp এ মেসেজ দিন।
        </div>

        <div class="space-y-2 text-xs">
          <div class="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-white/5">
            <span class="font-bold text-pink-600 dark:text-pink-400 flex items-center gap-1.5"><span>📱</span> বিকাশ (Personal):</span>
            <div class="flex items-center gap-2">
              <span class="font-mono text-gray-900 dark:text-white font-bold">${bkash}</span>
              <button onclick="navigator.clipboard.writeText('${bkash}'); window.APP.showToast('বিকাশ নম্বর কপি হয়েছে!', 'success')" class="px-2 py-0.5 bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white rounded text-[10px] font-semibold">কপি</button>
            </div>
          </div>
          <div class="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-white/5">
            <span class="font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1.5"><span>📱</span> নগদ (Personal):</span>
            <div class="flex items-center gap-2">
              <span class="font-mono text-gray-900 dark:text-white font-bold">${nagad}</span>
              <button onclick="navigator.clipboard.writeText('${nagad}'); window.APP.showToast('নগদ নম্বর কপি হয়েছে!', 'success')" class="px-2 py-0.5 bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white rounded text-[10px] font-semibold">কপি</button>
            </div>
          </div>
          <div class="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-white/5">
            <span class="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5"><span>📱</span> রকেট (Personal):</span>
            <div class="flex items-center gap-2">
              <span class="font-mono text-gray-900 dark:text-white font-bold">${rocket}</span>
              <button onclick="navigator.clipboard.writeText('${rocket}'); window.APP.showToast('রকেট নম্বর কপি হয়েছে!', 'success')" class="px-2 py-0.5 bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white rounded text-[10px] font-semibold">কপি</button>
            </div>
          </div>
        </div>

        <form onsubmit="window.APP.handleBuySubmit(event, '${photo.id}', ${price})" class="space-y-3 pt-2">
          <div>
            <label class="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-1">পেমেন্ট মেথড ও ট্রানজেকশন আইডি (TrxID) *</label>
            <input type="text" id="buy-trx-id" placeholder="যেমন: BKASH - 9K8L2M3X" required class="w-full bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-500 outline-none focus:border-indigo-500 font-medium">
          </div>
          <div>
            <label class="text-xs font-bold text-gray-800 dark:text-gray-200 block mb-1">আপনার হোয়াটসঅ্যাপ বা মোবাইল নম্বর *</label>
            <input type="tel" id="buy-phone" placeholder="01XXXXXXXXX" value="${this.activeUser ? this.activeUser.phone || '' : ''}" required class="w-full bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-500 outline-none focus:border-indigo-500 font-medium">
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button type="submit" class="py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl text-xs shadow-lg flex items-center justify-center gap-1.5 transition-transform active:scale-95">
              <span>✓ TrxID জমা দিন</span>
            </button>
            <a href="${waUrl}" target="_blank" rel="noopener" class="py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl text-xs shadow-lg flex items-center justify-center gap-1.5 transition-transform active:scale-95 text-center">
              <span>💬 WhatsApp এ জানান</span>
            </a>
          </div>
        </form>
      </div>
    `;

    modal.classList.remove("hidden");
  }

  async handleBuySubmit(event, photoId, price) {
    event.preventDefault();
    const trx = document.getElementById("buy-trx-id").value.trim();
    const phone = document.getElementById("buy-phone").value.trim();
    if (!trx || !phone) return;

    if (this.activeUser) {
      await this.db.sendNotification(this.activeUser.pin, {
        title: "ক্রয় রিকোয়েস্ট গৃহীত হয়েছে",
        message: `আপনার ফটো পারচেজ রিকোয়েস্ট (TrxID: ${trx}) গৃহীত হয়েছে। অ্যাডমিন পেমেন্ট ভেরিফাই করে আপনার নম্বরে অরিজিনাল ফাইল লিংক পাঠাবেন।`,
        type: "info",
        ts: Date.now()
      });
      this.updateInboxBadge();
    }

    this.closeModals();
    this.showToast("🎉 আপনার পেমেন্ট তথ্য সফলভাবে জমা হয়েছে! শীঘ্রই অরিজিনাল ছবি পাঠানো হবে।", "success");
  }

  // '📬 আমার খবর' ইনবক্স পপআপ
  async openInboxModal() {
    const modal = document.getElementById("inbox-modal");
    const content = document.getElementById("inbox-modal-content");
    if (!modal || !content) return;

    modal.classList.remove("hidden");
    content.innerHTML = `<div class="py-12 text-center text-gray-400 text-xs">⏳ খবর লোড হচ্ছে…</div>`;

    const pin = this.activeUser ? this.activeUser.pin : null;
    const notifs = await this.db.getNotifications(pin);

    // মার্ক রিড
    localStorage.setItem("peg_inb_last_seen", Date.now().toString());
    const badge = document.getElementById("inb-badge");
    if (badge) badge.classList.add("hidden");

    if (!notifs || notifs.length === 0) {
      content.innerHTML = `
        <div class="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs text-center leading-relaxed">
          <span class="text-3xl block mb-2">📬</span>
          <b>এখনও কোনো খবর নেই।</b>
          <p class="text-amber-200/80 mt-1">আপনার ছবি অনুমোদন, উইথড্র আবেদন বা ভেরিফিকেশন নিয়ে অ্যাডমিন সিদ্ধান্ত নিলে এখানে জানানো হবে।</p>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div class="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
        ${notifs.map(n => {
          let cardClasses = "border-gray-200 dark:border-white/10 bg-gray-50/90 dark:bg-slate-900/60";
          let titleColor = "text-gray-900 dark:text-white";
          let timeColor = "text-gray-500 dark:text-gray-400";
          let msgColor = "text-gray-800 dark:text-gray-200";
          let icon = "📬";

          if (n.type === "ok") {
            cardClasses = "border-emerald-500/40 bg-emerald-50/90 dark:bg-emerald-500/10 shadow-sm";
            titleColor = "text-emerald-800 dark:text-emerald-300";
            timeColor = "text-emerald-700/80 dark:text-emerald-400/80";
            msgColor = "text-gray-900 dark:text-emerald-100";
            icon = "🎉";
          } else if (n.type === "bad") {
            cardClasses = "border-rose-500/40 bg-rose-50/90 dark:bg-rose-500/10 shadow-sm";
            titleColor = "text-rose-800 dark:text-rose-300";
            timeColor = "text-rose-700/80 dark:text-rose-400/80";
            msgColor = "text-gray-900 dark:text-rose-100";
            icon = "⚠️";
          } else if (n.type === "broadcast") {
            cardClasses = "border-indigo-500/40 bg-indigo-50/90 dark:bg-indigo-500/10 shadow-sm";
            titleColor = "text-indigo-800 dark:text-indigo-300";
            timeColor = "text-indigo-700/80 dark:text-indigo-400/80";
            msgColor = "text-gray-900 dark:text-indigo-100";
            icon = "📢";
          }

          const timeStr = new Date(n.ts || Date.now()).toLocaleString("bn-BD", {
            dateStyle: "medium",
            timeStyle: "short"
          });

          return `
            <div class="p-3.5 rounded-2xl border ${cardClasses} transition-all">
              <div class="flex items-center justify-between gap-2 mb-1.5">
                <h4 class="text-xs font-bold ${titleColor} flex items-center gap-1.5">
                  <span>${icon}</span>
                  <span>${n.title || 'নোটিফিকেশন'}</span>
                </h4>
                <span class="text-[10px] ${timeColor} font-semibold whitespace-nowrap">${timeStr}</span>
              </div>
              <p class="text-xs ${msgColor} font-medium leading-relaxed">${n.message || ''}</p>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  // ইনবক্স আনরিড ব্যাজ আপডেট
  async updateInboxBadge() {
    const badge = document.getElementById("inb-badge");
    if (!badge) return;

    const pin = this.activeUser ? this.activeUser.pin : null;
    const notifs = await this.db.getNotifications(pin);
    const lastSeen = parseInt(localStorage.getItem("peg_inb_last_seen") || "0", 10);

    const unread = notifs.filter(n => (n.ts || 0) > lastSeen);
    if (unread.length > 0) {
      badge.innerText = unread.length > 9 ? "9+" : unread.length;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  // কনটেস্ট বিজয়ী সার্টিফিকেট জেনারেটর (GalleryBD drawCert স্টাইল Canvas)
  async downloadWinnerCertificate(photoId) {
    const photos = await this.db.getPhotos();
    const photo = photos.find(p => p.id === photoId) || {
      id: photoId,
      title: "কনটেস্ট সেরা ফটোগ্রাফি",
      authorName: this.activeUser ? this.activeUser.name : "বিজয়ী শিল্পী",
      contestType: "c24"
    };

    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1130;
    const ctx = canvas.getContext("2d");

    // ব্যাকগ্রাউন্ড গ্রেডিয়েন্ট
    const bgGrad = ctx.createLinearGradient(0, 0, 1600, 1130);
    bgGrad.addColorStop(0, "#fffdf5");
    bgGrad.addColorStop(1, "#fff1d0");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1600, 1130);

    // গোল্ডেন রাজকীয় বর্ডার
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 14;
    ctx.strokeRect(30, 30, 1540, 1070);

    ctx.strokeStyle = "#b8860b";
    ctx.lineWidth = 3;
    ctx.strokeRect(45, 45, 1510, 1040);

    // হেডার লোগো ও টাইটেল
    ctx.textAlign = "center";
    ctx.font = "bold 32px 'Hind Siliguri', Georgia, serif";
    ctx.fillStyle = "#8b6508";
    ctx.fillText("PHOTO EARN • OFFICIAL CONTEST AWARD", 800, 140);

    ctx.font = "900 64px 'Hind Siliguri', Georgia, serif";
    ctx.fillStyle = "#1e293b";
    ctx.fillText("সাফল্য স্বীকৃতিপত্র", 800, 230);

    ctx.font = "italic 26px 'Hind Siliguri', Georgia, serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("CERTIFICATE OF EXCELLENCE & ACHIEVEMENT", 800, 280);

    // মূল বক্তব্য
    ctx.font = "28px 'Hind Siliguri', sans-serif";
    ctx.fillStyle = "#334155";
    ctx.fillText("অত্যন্ত আনন্দের সাথে প্রত্যয়ন করা যাচ্ছে যে,", 800, 370);

    // বিজয়ীর নাম
    ctx.font = "bold 58px 'Hind Siliguri', Georgia, serif";
    ctx.fillStyle = "#0f172a";
    ctx.fillText(photo.authorName || "সম্মানিত বিজয়ী শিল্পী", 800, 460);

    // আন্ডারলাইন
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(400, 485);
    ctx.lineTo(1200, 485);
    ctx.stroke();

    // কনটেস্ট বিবরণ
    const roundName = photo.contestType === "c30" ? "৩০ দিনের মেগা কনটেস্ট" : photo.contestType === "c7" ? "৭ দিনের গোল্ডেন কনটেস্ট" : "২৪ ঘণ্টার ডেইলি কনটেস্ট";
    ctx.font = "30px 'Hind Siliguri', sans-serif";
    ctx.fillStyle = "#334155";
    ctx.fillText(`তাঁর অসাধারণ ফটোগ্রাফি "${photo.title}"-এর জন্য`, 800, 560);
    ctx.fillText(`Photo Earn-এর ${roundName}-এ বিজয়ী স্থান অধিকার করেছেন।`, 800, 615);

    // গোল্ড মেডেল সিল
    ctx.fillStyle = "#d4af37";
    ctx.beginPath();
    ctx.arc(800, 750, 70, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px sans-serif";
    ctx.fillText("🏆", 800, 765);

    // তারিখ ও আইডি
    ctx.textAlign = "left";
    ctx.font = "22px 'Hind Siliguri', monospace";
    ctx.fillStyle = "#64748b";
    ctx.fillText(`তারিখ: ${new Date().toLocaleDateString('bn-BD')}`, 120, 980);
    ctx.fillText(`সার্টিফিকেট আইডি: PEG-${photo.id.toUpperCase()}`, 120, 1020);

    // বিচারক স্বাক্ষর
    ctx.textAlign = "right";
    ctx.font = "italic bold 28px 'Hind Siliguri', cursive";
    ctx.fillStyle = "#1e293b";
    ctx.fillText("Chief Curator & Jury", 1480, 970);
    ctx.font = "20px 'Hind Siliguri', sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Photo Earn Bangladesh Panel", 1480, 1005);

    // ডাউনলোড ট্রিগার
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `PhotoEarn-Certificate-${photo.id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    this.showToast("🎉 আপনার গোল্ডেন সার্টিফিকেট ডাউনলোড সম্পন্ন হয়েছে!", "success");
  }

}
