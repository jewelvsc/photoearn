/**
 * ========================================================
 * ⚙️ Photo Earn - Configuration File (config.js)
 * সমস্ত সেটিংস, পেমেন্ট নম্বর, ফায়ারবেস ও বিজ্ঞাপন কনফিগারেশন
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

    // টপ ব্যানার অ্যাড (সরাসরি ক্লিক করলেই Adsterra ডিরেক্ট লিংকে চলে যাবে)
    topBannerSlot: `
      <a href="https://asiafilm.org/4/7dba13cd99d01214b30af2e53cea4c8a" target="_blank" rel="noopener" class="block w-full py-2.5 px-4 bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-indigo-500/15 border border-amber-500/30 hover:border-amber-400 rounded-2xl text-center shadow-lg transition-all group">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="bg-amber-500 text-slate-950 px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-wider">Sponsored</span>
            <span class="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">🔥 আজকের সেরা অনলাইন রিওয়ার্ড ও স্পনসর অফার দেখুন</span>
          </div>
          <span class="text-[11px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1 rounded-xl shadow whitespace-nowrap">ভিজিট করুন ➔</span>
        </div>
      </a>
    `,

    // ইন-ফিড নেটিভ বিজ্ঞাপন কার্ড
    inFeedNativeSlot: `
      <a href="https://asiafilm.org/4/7dba13cd99d01214b30af2e53cea4c8a" target="_blank" rel="noopener" class="block w-full p-4 bg-gradient-to-r from-indigo-950/80 via-purple-950/70 to-slate-900 border border-indigo-500/30 hover:border-pink-500/50 rounded-2xl shadow-xl transition-all text-center group">
        <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase mb-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-pink-500 animate-ping"></span>
          <span>Sponsored Promotion</span>
        </div>
        <h4 class="text-sm font-black text-white group-hover:text-pink-400 transition-colors">🎁 প্রতিদিন ৫০০ থেকে ১,০০০ টাকা আয়ের বিশেষ সুযোগ!</h4>
        <p class="text-xs text-gray-400 mt-0.5">নিচের লিংকে ক্লিক করে সরাসরি স্পনসর অফারটি দেখুন ও জিতে নিন উপহার</p>
        <div class="mt-3">
          <span class="inline-block px-5 py-1.5 bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white font-bold rounded-xl text-xs shadow-md">এখনই অফারটি দেখুন ➔</span>
        </div>
      </a>
    `,

    // স্টিকি বটম মোবাইল ব্যানার
    stickyBottomSlot: `
      <a href="https://asiafilm.org/4/7dba13cd99d01214b30af2e53cea4c8a" target="_blank" rel="noopener" class="block w-full py-2 px-3 bg-slate-950/95 border-t border-amber-500/30 text-center shadow-2xl transition-colors hover:bg-slate-900">
        <div class="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 truncate">
            <span class="bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded text-[9px] uppercase font-black">AD</span>
            <span class="text-xs font-bold text-amber-300 truncate">🔥 বিশেষ স্পনসর অফার দেখতে এখানে ট্যাপ করুন</span>
          </div>
          <span class="text-[11px] bg-amber-500 text-slate-950 font-black px-2.5 py-0.5 rounded-lg whitespace-nowrap">Open ➔</span>
        </div>
      </a>
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
