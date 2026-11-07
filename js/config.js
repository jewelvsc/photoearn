/**
 * ========================================================
 * ⚙️ Photo Earn - Configuration File (config.js)
 * সমস্ত সেটিংস, পেমেন্ট নম্বর ও কন্ট্রোল এখান থেকেই আপডেট করা হয়েছে
 * ========================================================
 */

window.APP_CONFIG = {
  // ১. সাইটের প্রাথমিক তথ্য ও ব্র্যান্ডিং
  siteName: "Photo Earn",
  logoTextPrimary: "Photo",
  logoTextSecondary: "Earn",
  tagline: "ছবি আপলোড করুন, ভোট পান আর জিতে নিন প্রতিদিনের নগদ পুরস্কার",
  currencySymbol: "৳",
  siteUrl: "https://photoearn.chasherdokan.com",

  // ২. আপনার অফিসিয়াল পেমেন্ট ও সাপোর্ট নম্বর (আপডেটেড)
  bkashNumber: "01771136809",
  nagadNumber: "01771136809",
  supportWhatsApp: "https://wa.me/8801771136809", // হোয়াটসঅ্যাপ সাপোর্ট
  supportTelegram: "https://t.me/photoearnOfficial", // আপনার অফিসিয়াল টেলিগ্রাম চ্যানেল
  youtubeChannel: "https://youtube.com/@channel",   // ইউটিউব চ্যানেল
  youtubePopupDelaySeconds: 30, // সাইটে প্রবেশের ৩০ সেকেন্ড পর পপআপ আসবে

  // ৩. বাংলা কিউআর (BANGLA QR) পেমেন্ট তথ্য
  banglaQr: {
    enabled: true,
    image: "images/bangla-qr.png",
    name: "Md. Ziaur Rahman",
    number: "01349538109",
    tid: "T4230691",
    bank: "ইসলামী ব্যাংক বাংলাদেশ পিএলসি (Bangla QR)",
    supportedApps: "bKash, CellFin, mCash, Upay, VISA, MasterCard, NPSB"
  },

  // ৪. পেমেন্ট ও উইথড্র নিয়ম
  minWithdrawPoints: 500,     // সর্বনিম্ন উইথড্র পয়েন্ট (৫০০ পয়েন্ট = ৫০ টাকা)
  minWithdrawTaka: 50,
  takaPerPoint: 0.10,         // ১ পয়েন্ট = ০.১০ টাকা (১০ পয়েন্ট = ১ টাকা)
  minPhotosForWithdraw: 3,    // টাকা তুলতে কমপক্ষে ৩টি ছবি আপলোড থাকতে হবে (স্প্যাম রোধে)
  telegramJoinBonusTaka: 10,  // টেলিগ্রামে যুক্ত হলে তাৎক্ষণিক ৳১০ বোনাস
  referralPointsPerUser: 10,  // প্রতি সফল রেফারে ১০ পয়েন্ট

  // ৫. কনটেস্ট ও ক্যাশ প্রাইজ (টাকা হিসেবে)
  contestPrizes: {
    c24: [50],                  // ২৪ ঘণ্টা কনটেস্ট: ১ম স্থান ৳৫০
    c7: [150, 50],              // ৭ দিন কনটেস্ট: ১ম স্থান ৳১৫০, ২য় স্থান ৳৫০
    c30: [500, 200, 100]        // ৩০ দিন কনটেস্ট: ১ম ৳৫০০, ২য় ৳২০০, ৩য় ৳১০০
  },

  // কনটেস্টের চলমান ক্যাটাগরি ও থিম
  activeThemes: [
    "গ্রামের দৃশ্য",
    "শীতের সকাল",
    "পাখির ছবি",
    "নদী ও নৌকা",
    "প্রকৃতি ও ফুল",
    "রাতের আকাশ",
    "রাস্তার ফটোগ্রাফি",
    "সৃষ্টি ও কারুকাজ"
  ],

  // ৬. ব্যাজ রিকোয়ারমেন্ট
  badgeBlueKingVotes: 30,  // ৩০+ ভোট পেলে Blue King ব্যাজ
  badgeRedKingVotes: 70,   // ৭০+ ভোট পেলে Red King ব্যাজ

  // ৭. বিজ্ঞাপন (Adsterra / Monetag / Direct Link) সেটিংস
  ads: {
    enabled: true,
    downloadWaitSeconds: 5, // ৫ সেকেন্ড অপেক্ষা করিয়ে ডাউনলোড আনলক
    sponsorDirectLink: "https://asiafilm.org/4/7dba13cd99d01214b30af2e53cea4c8a", // আপনার Adsterra Direct Link

    topBannerSlot: `
      <div class="ad-placeholder w-full py-2 bg-slate-900/80 border border-dashed border-amber-500/30 rounded-xl text-center text-xs text-amber-300 flex items-center justify-center gap-2">
        <span class="bg-amber-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-amber-400">Sponsored Ad</span>
        <span>Adsterra Banner Slot (728x90 / 320x50)</span>
      </div>
    `,
    inFeedNativeSlot: `
      <div class="ad-placeholder w-full py-4 bg-slate-900/80 border border-dashed border-indigo-500/30 rounded-2xl text-center text-xs text-indigo-300 flex flex-col items-center justify-center gap-1">
        <span class="bg-indigo-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-indigo-400">Sponsored</span>
        <span>In-Feed Native Adsterra Banner Slot</span>
      </div>
    `,
    stickyBottomSlot: `
      <div class="ad-placeholder w-full py-1.5 bg-slate-950/95 border-t border-slate-800 text-center text-[11px] text-gray-400 flex items-center justify-center gap-2 shadow-2xl">
        <span class="bg-emerald-500/20 px-1.5 py-0.2 rounded text-[9px] uppercase font-bold text-emerald-400">Ad</span>
        <span>Sticky Bottom Banner Ad (320x50)</span>
      </div>
    `
  },

  // ৮. Firebase Realtime Database
  firebase: {
    databaseURL: "https://photo-earn-official-default-rtdb.firebaseio.com"
  },

  // ৯. সিকিউরিটি ও অ্যাডমিন পিন
  adminPin: "8800",
  voteCoolDownSeconds: 5
};
