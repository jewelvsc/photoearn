/**
 * ========================================================
 * 🚀 PicPrize BD - Core Application Engine (app.js)
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
    this.checkAuth();
    this.renderHeader();
    this.setupEventListeners();
    this.startContestTimers();
    this.setupPopups();
    await this.renderGallery();
    this.checkUrlParams();
  }

  // ১. ইউজার অথেনটিকেশন চেক
  checkAuth() {
    const savedPin = localStorage.getItem("peg_auth_pin");
    if (savedPin) {
      const user = this.db.getUser(savedPin);
      if (user) {
        this.activeUser = user;
      } else {
        localStorage.removeItem("peg_auth_pin");
      }
    }
  }

  // ২. হেডার ও সাইট ব্র্যান্ডিং রেন্ডারিং
  async renderHeader() {
    // লোগো ও নাম
    const logoEl = document.getElementById("brand-logo-text");
    if (logoEl) {
      logoEl.innerHTML = `<b>${this.cfg.logoTextPrimary || "Photo"}</b> <em class="text-pink-500 not-italic font-extrabold">${this.cfg.logoTextSecondary || "Earn"}</em>`;
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
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
        <span class="max-w-[100px] truncate">${this.activeUser.name}</span>
        <span class="bg-indigo-500/30 text-indigo-300 text-xs px-2 py-0.5 rounded-full font-bold">৳${parseFloat(this.activeUser.taka || 0).toFixed(1)}</span>
      `;
      userBtn.classList.remove("border-gray-700");
      userBtn.classList.add("border-indigo-500/50");
    } else {
      userBtn.innerHTML = `
        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
        <span>লগইন / একাউন্ট</span>
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

    // কনটেস্ট ন্যাভ ট্যাব ক্লিক
    document.querySelectorAll(".nav-chip").forEach(chip => {
      chip.addEventListener("click", (e) => {
        e.preventDefault();
        const tab = chip.getAttribute("data-tab");
        this.switchTab(tab);
      });
    });

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
  }

  // ৪. ট্যাব পরিবর্তন লজিক
  switchTab(tabName) {
    this.currentTab = tabName;
    document.querySelectorAll(".nav-chip").forEach(c => {
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

    // সব সেকশন ডিফল্ট হাইড
    if (leaderboardSection) leaderboardSection.classList.add("hidden");
    if (rulesSection) rulesSection.classList.add("hidden");
    if (themeVoteSection) themeVoteSection.classList.add("hidden");
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
    } else {
      this.renderGallery();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ৫. গ্যালারি রেন্ডারিং
  async renderGallery() {
    const container = document.getElementById("photo-grid");
    if (!container) return;

    container.innerHTML = `
      <div class="col-span-full py-16 text-center text-gray-400">
        <svg class="animate-spin h-8 w-8 mx-auto mb-3 text-indigo-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
        <span>ছবি লোড হচ্ছে…</span>
      </div>
    `;

    const allPhotos = await this.db.getPhotos();
    let filtered = allPhotos;

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
      // প্রতি ৪টি ছবির পর ১টি নেটিভ ইন-ফিড অ্যাড
      if (index > 0 && index % 4 === 0 && this.cfg.ads && this.cfg.ads.enabled) {
        html += `<div class="col-span-full my-3">${this.cfg.ads.inFeedNativeSlot}</div>`;
      }

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

      html += `
        <div class="photo-card glass-panel rounded-2xl overflow-hidden flex flex-col justify-between group">
          <!-- ছবি অংশ -->
          <div class="relative overflow-hidden cursor-pointer aspect-4/3 bg-slate-900" onclick="window.APP.openPhotoModal('${photo.id}')">
            <img src="${photo.url}" alt="${photo.title}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20"></div>
            
            <!-- টপ ব্যাজ -->
            <div class="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
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
              <span class="text-[11px] text-indigo-400 font-medium">${photo.category || "প্রকৃতি"}</span>
              <h3 class="font-bold text-gray-100 text-sm line-clamp-1 group-hover:text-indigo-400 transition-colors mt-0.5">${photo.title}</h3>
              <p class="text-xs text-gray-400 flex items-center gap-1.5 mt-1">
                <svg class="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                <span>${photo.authorName || "শিল্পী"}</span>
              </p>
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

  // ৬. ভোট হ্যান্ডলার (৫ সেকেন্ডের কুলডাউন ও এনিমেশন)
  async handleVote(photoId, event) {
    if (event) event.stopPropagation();

    if (this.isVoteCooldown) {
      this.showToast(`দয়া করে ${this.cfg.voteCoolDownSeconds || 5} সেকেন্ড অপেক্ষা করুন!`, "warning");
      return;
    }

    const btn = event.currentTarget;
    const res = await this.db.votePhoto(photoId);

    if (res.success) {
      this.isVoteCooldown = true;
      btn.classList.add("heart-active");
      const countEl = document.getElementById(`vote-count-${photoId}`);
      if (countEl) countEl.innerText = `${res.votes} ভোট`;

      this.showToast("আপনার ভোট সফলভাবে যোগ হয়েছে! ❤️", "success");

      // ৫ সেকেন্ডের কুলডাউন
      setTimeout(() => {
        this.isVoteCooldown = false;
        btn.classList.remove("heart-active");
      }, (this.cfg.voteCoolDownSeconds || 5) * 1000);
    } else {
      this.showToast(res.message, "info");
    }
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

    content.innerHTML = `
      <div class="relative rounded-2xl overflow-hidden bg-black/90 max-h-[65vh] flex items-center justify-center">
        <img src="${photo.url}" alt="${photo.title}" class="max-h-[60vh] max-w-full object-contain mx-auto">
        <div class="absolute bottom-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-lg text-xs text-gray-200">
          ছবি সৌজন্যে: <b class="text-indigo-400">${photo.authorName}</b>
        </div>
      </div>

      <div class="mt-4 flex flex-col gap-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <span class="text-xs text-indigo-400 font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">${photo.category}</span>
            <h2 class="text-lg font-bold text-white mt-1">${photo.title}</h2>
            <p class="text-xs text-gray-400 mt-0.5">আপলোড তারিখ: ${new Date(photo.date).toLocaleDateString('bn-BD')}</p>
          </div>
          <div class="text-right">
            <span class="text-sm font-bold text-rose-400">❤️ ${photo.votes || 0} ভোট</span>
            <p class="text-xs text-gray-400 mt-0.5">👁️ ${photo.views || 0} ভিউ</p>
          </div>
        </div>

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

  // ৯. ছবি আপলোড মডাল ওপেন
  openUploadModal() {
    if (!this.activeUser) {
      this.showToast("ছবি জমা দিতে প্রথমে লগইন বা একাউন্ট তৈরি করুন!", "info");
      this.openAuthModal();
      return;
    }

    const modal = document.getElementById("upload-modal");
    if (modal) modal.classList.remove("hidden");
  }

  // ছবি আপলোড সাবমিট হ্যান্ডলার
  async handlePhotoUpload(e) {
    e.preventDefault();
    const title = document.getElementById("up-title").value.trim();
    const category = document.getElementById("up-category").value;
    const contestType = document.getElementById("up-contest").value;
    const fileInput = document.getElementById("up-file");

    if (!title || !fileInput.files[0]) {
      this.showToast("দয়া করে ছবির শিরোনাম ও ফাইল সিলেক্ট করুন!", "warning");
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

        // কম্প্রেসড ইমেজ ডাটা URL
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

        const newPhoto = {
          title: title,
          category: category,
          contestType: contestType,
          authorName: this.activeUser.name,
          authorPin: this.activeUser.pin,
          url: dataUrl
        };

        await this.db.addPhoto(newPhoto);

        this.closeModals();
        submitBtn.disabled = false;
        submitBtn.innerText = "ছবি আপলোড সম্পন্ন করুন";
        document.getElementById("upload-form").reset();

        this.showToast("ছবি সফলভাবে আপলোড হয়েছে এবং কনটেস্টে যুক্ত হয়েছে! 🎉", "success");
        this.renderGallery();
        this.updateUserNavButton();
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

  // ১১. প্রোফাইল ও উইথড্র মডাল
  openProfileModal() {
    if (!this.activeUser) return;
    const modal = document.getElementById("profile-modal");
    const content = document.getElementById("profile-modal-content");
    if (!modal || !content) return;

    // রিফ্রেশ ইউজার ডাটা
    this.activeUser = this.db.getUser(this.activeUser.pin);

    content.innerHTML = `
      <div class="flex items-center gap-3 pb-4 border-b border-white/10">
        <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white text-lg font-bold shadow-md">
          ${this.activeUser.name.charAt(0)}
        </div>
        <div>
          <h3 class="font-bold text-white text-base">${this.activeUser.name}</h3>
          <p class="text-xs text-gray-400">পিন: ****${this.activeUser.pin.slice(-2)} · ফোন: ${this.activeUser.phone}</p>
        </div>
      </div>

      <!-- ব্যালেন্স ও স্ট্যাটাস কার্ড -->
      <div class="grid grid-cols-2 gap-3 my-4">
        <div class="p-3 bg-slate-900 rounded-xl border border-indigo-500/20 text-center">
          <span class="text-xs text-gray-400">মোট ব্যালেন্স</span>
          <p class="text-xl font-bold text-emerald-400 mt-0.5">৳${parseFloat(this.activeUser.taka || 0).toFixed(2)}</p>
          <span class="text-[10px] text-gray-500">${this.activeUser.points || 0} পয়েন্ট</span>
        </div>
        <div class="p-3 bg-slate-900 rounded-xl border border-purple-500/20 text-center">
          <span class="text-xs text-gray-400">আপলোড করা ছবি</span>
          <p class="text-xl font-bold text-purple-400 mt-0.5">${this.activeUser.photosCount || 0} টি</p>
          <span class="text-[10px] text-gray-500">উইথড্র রিকোয়ারমেন্ট: ৩টি</span>
        </div>
      </div>

      <!-- টেলিগ্রাম বোনাস কার্ড -->
      ${!this.activeUser.telegramBonus ? `
        <div class="p-3 bg-indigo-950/60 border border-indigo-500/30 rounded-xl mb-4 flex items-center justify-between gap-2">
          <div>
            <b class="text-indigo-300 text-xs block">🎁 টেলিগ্রাম বোনাস ৳১০</b>
            <span class="text-[11px] text-gray-400">চ্যানেলে জয়েন করে ইনস্ট্যান্ট বোনাস নিন</span>
          </div>
          <button onclick="window.APP.claimTelegramBonus()" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold whitespace-nowrap">
            ক্লেইম করুন
          </button>
        </div>
      ` : ''}

      <!-- রেফারেল লিংক -->
      <div class="p-3 bg-slate-900 rounded-xl border border-slate-800 mb-4">
        <label class="text-xs text-gray-400 block mb-1">আপনার রেফারেল কোড:</label>
        <div class="flex items-center gap-2">
          <input type="text" readonly value="${this.activeUser.refCode || 'REF' + this.activeUser.pin}" class="w-full bg-slate-800 text-xs text-amber-300 px-3 py-2 rounded-lg border border-slate-700 outline-none">
          <button onclick="navigator.clipboard.writeText('${window.location.origin}/?ref=${this.activeUser.refCode}'); window.APP.showToast('রেফারেল লিংক কপি হয়েছে!', 'success')" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap">
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
          <input type="text" id="wd-phone" value="${this.activeUser.phone || ''}" required placeholder="01XXXXXXXXX" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none">
        </div>

        <button type="submit" class="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-xs font-bold shadow-lg transition-transform active:scale-95">
          টাকা তোলার আবেদন করুন
        </button>
      </form>

      <button onclick="window.APP.handleLogout()" class="w-full mt-3 py-1.5 text-gray-500 hover:text-rose-400 text-xs font-semibold transition-colors">
        লগআউট করুন
      </button>
    `;

    modal.classList.remove("hidden");
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
        <div class="glass-panel p-3 rounded-xl flex items-center justify-between gap-3 border border-white/5">
          <div class="flex items-center gap-3">
            <span class="text-sm ${rankColor} w-10 text-center">${rankBadge}</span>
            <img src="${p.url}" alt="${p.title}" class="w-12 h-12 rounded-lg object-cover bg-slate-900">
            <div>
              <h4 class="font-bold text-white text-xs line-clamp-1">${p.title}</h4>
              <p class="text-[11px] text-gray-400">${p.authorName} · ${p.category}</p>
            </div>
          </div>
          <div class="text-right">
            <span class="text-rose-400 font-bold text-xs">❤️ ${p.votes || 0} ভোট</span>
            <span class="text-[10px] text-gray-500 block">👁️ ${p.views || 0} ভিউ</span>
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
        <div class="glass-panel p-4 rounded-xl flex items-center justify-between gap-3 border border-white/5">
          <div>
            <h4 class="font-bold text-white text-sm">📷 ${theme}</h4>
            <span class="text-xs text-gray-400">বর্তমান ভোট: <b class="text-indigo-400">${vCount}</b></span>
          </div>
          <button onclick="window.APP.voteTheme('${theme}')" class="px-4 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-xl text-xs font-semibold transition-all">
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
    };
    setInterval(update, 1000);
    update();
  }

  // ১৫. পপআপ (ইউটিউব সাবস্ক্রাইব ইত্যাদি)
  setupPopups() {
    const delay = (this.cfg.youtubePopupDelaySeconds || 30) * 1000;
    if (!sessionStorage.getItem("yt_popup_shown")) {
      setTimeout(() => {
        sessionStorage.setItem("yt_popup_shown", "true");
        const modal = document.getElementById("yt-subscribe-modal");
        if (modal) modal.classList.remove("hidden");
      }, delay);
    }
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
}

