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

  // ২. অফিসিয়াল পেমেন্ট ও সাপোর্ট নম্বর
  bkashNumber: "01771136809",
  nagadNumber: "01771136809",
  supportWhatsApp: "https://wa.me/8801771136809",
  supportTelegram: "https://t.me/photoearnOfficial",
  telegramPopupDelaySeconds: 20,
  telegramPopupEnabled: true,
  judges: ["Md. Ziaur Rahman", "PhotoEarn Team"],

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

  // ৪. ভাইরাল লাইক ও ফলো আপলোড শর্ত (GalleryBD ভাইরাল সিস্টেম)
  uploadNeedLikes: 30,          // প্রতিটি ছবির জন্য ১৫ লাইক (১ম ছবি ১৫, ২য় ছবি ৩০ ...)
  uploadNeedFollows: 20,        // ছবি আপলোডের জন্য কমপক্ষে ২০ জনকে ফলো করা থাকতে হবে
  likeVerifyEvery: 5,           // প্রতি ৫টি লাইকে Adsterra স্পনসর ভেরিফিকেশন (ইনকাম বাড়াতে)
  likeWaitSeconds: 5,           // লাইক ভেরিফাই অপেক্ষা ৫ সেকেন্ড

  // ৫. ভোট দেওয়ার শর্ত ও ২-ধাপের Adsterra গেট (ডাবল ইনকাম)
  voteWaitSeconds: 5,
  voteCoolDownSeconds: 5,
  verifyAd1: "https://araplhn.org/4/7decde193b07302555c7d1b18a2dfcbe",
  verifyAd2: "https://araplhn.org/4/7decde193b07302555c7d1b18a2dfcbe",

  // ৬. পেমেন্ট, উইথড্র ও সিকিউরিটি
  minWithdrawPoints: 500,       // ৫০০ পয়েন্ট = ৫০ টাকা
  minWithdrawTaka: 50,
  takaPerPoint: 0.10,
  minPhotosForWithdraw: 3,
  banHours: 24,                 // ভুল পিন দিলে ২৪ ঘণ্টা সাময়িক ব্যান
  strikesToPermanent: 2,        // ২ বার ভুল করলে পার্মানেন্ট ব্যান
  telegramJoinBonusTaka: 10,
  referralPointsPerUser: 10,

  // ৭. কনটেস্ট ও ক্যাশ প্রাইজ
  contestPrizes: {
    c24: [50],                  // ২৪ ঘণ্টা: ১ম স্থান ৳৫০
    c7: [150, 50],              // ৭ দিন: ১ম স্থান ৳১৫০, ২য় স্থান ৳৫০
    c30: [500, 200, 100]        // ৩০ দিন: ১ম ৳৫০০, ২য় ৳২০০, ৩য় ৳১০০
  },

  // চলমান থিম তালিকা
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

  // ৮. ব্যাজ ও লেভেল
  badgeBlueKingVotes: 30,
  badgeRedKingVotes: 70,
  levels: [
    { name: "ব্রোঞ্জ", icon: "🥉", photos: 3, views: 500 },
    { name: "সিলভার", icon: "🥈", photos: 10, views: 5000 },
    { name: "গোল্ড", icon: "🥇", photos: 25, views: 25000 }
  ],

  // ৯. বিজ্ঞাপন (Adsterra / Monetag / Direct Link) সেটিংস
  ads: {
    enabled: true,
    downloadWaitSeconds: 5,
    sponsorDirectLink: "https://araplhn.org/4/7decde193b07302555c7d1b18a2dfcbe",
    uploadHumanVerifyEnabled: true,
    uploadWaitSeconds: 5,

    topBannerSlot: `
      <a href="https://araplhn.org/4/7decde193b07302555c7d1b18a2dfcbe" target="_blank" rel="noopener" class="block w-full py-2.5 px-4 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 border border-amber-500/30 hover:border-amber-400 rounded-2xl text-center shadow transition-all group">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="bg-amber-500 text-slate-950 px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-wider">Sponsored</span>
            <span class="text-xs font-bold text-gray-800 dark:text-white group-hover:text-amber-500 transition-colors">🔥 আজকের সেরা অনলাইন রিওয়ার্ড ও স্পনসর অফার দেখুন</span>
          </div>
          <span class="text-[11px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1 rounded-xl shadow whitespace-nowrap">ভিজিট করুন ➔</span>
        </div>
      </a>
    `,

    inFeedNativeSlot: `
      <div class="p-3 bg-gradient-to-r from-indigo-50/60 dark:from-slate-900/90 to-purple-50/60 dark:to-slate-900/90 rounded-2xl border border-indigo-500/20 shadow-md my-2">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">Sponsored Partner</span>
          <a href="https://araplhn.org/4/7decde193b07302555c7d1b18a2dfcbe" target="_blank" rel="noopener" class="text-[11px] text-indigo-500 dark:text-indigo-400 font-bold hover:underline">অফার দেখুন ➔</a>
        </div>
        <div id="container-8c6bfb10b7e61f9bc4ea4d93fc41e5f6" class="min-h-[100px] flex items-center justify-center"></div>
      </div>
    `,

    stickyBottomSlot: `
      <a href="https://araplhn.org/4/7decde193b07302555c7d1b18a2dfcbe" target="_blank" rel="noopener" class="block w-full py-2 px-3 bg-white/95 dark:bg-slate-950/95 border-t border-amber-500/30 text-center shadow-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-900">
        <div class="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 truncate">
            <span class="bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded text-[9px] uppercase font-black">AD</span>
            <span class="text-xs font-bold text-amber-600 dark:text-amber-300 truncate">🔥 বিশেষ স্পনসর অফার দেখতে এখানে ট্যাপ করুন</span>
          </div>
          <span class="text-[11px] bg-amber-500 text-slate-950 font-black px-2.5 py-0.5 rounded-lg whitespace-nowrap">Open ➔</span>
        </div>
      </a>
    `
  },

  // ১০. লাইভ চ্যাট ও PWA
  chat: {
    enabled: true,
    pollIntervalMs: 3500
  },
  pwa: {
    enabled: true,
    promptDelaySeconds: 40
  },

  // ১১. Firebase Realtime Database
  firebase: {
    databaseURL: "https://photo-earn-official-default-rtdb.firebaseio.com"
  },

  // ১২. সিকিউরিটি ও অ্যাডমিন পিন
  adminPin: "1802"
};
