/**
 * ========================================================
 * 🗄️ Database & Storage Layer (db.js)
 * Firebase Cloud Realtime Database + Server API + LocalStorage
 * ========================================================
 */

class AppDB {
  constructor() {
    this.cfg = window.APP_CONFIG || {};
    this.isServer = window.location.protocol.startsWith("http");
    this.apiBase = "api.php";
    this.hasFirebase = !!(this.cfg.firebase && this.cfg.firebase.databaseURL && this.cfg.firebase.databaseURL.trim().length > 0);
    this.fbUrl = this.hasFirebase ? this.cfg.firebase.databaseURL.replace(/\/$/, "") : "";
    this.initDefaultLocalData();
  }

  // ডিফল্ট ডেমো ডাটা ইনিশিয়ালাইজেশন
  initDefaultLocalData() {
    if (!localStorage.getItem("peg_photos")) {
      const defaultPhotos = [
        {
          id: "photo_1",
          title: "গ্রামের শান্ত বিকেল ও সূর্যাস্ত",
          category: "গ্রামের দৃশ্য",
          authorName: "তানভীর হাসান",
          authorPin: "1234",
          url: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=80",
          views: 342,
          votes: 68,
          contestType: "c24",
          approved: true,
          date: new Date(Date.now() - 3600000 * 4).toISOString()
        },
        {
          id: "photo_2",
          title: "নদীর বুকে পালতোলা নৌকা",
          category: "নদী ও নৌকা",
          authorName: "রাকিবুল ইসলাম",
          authorPin: "2345",
          url: "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=800&auto=format&fit=crop&q=80",
          views: 654,
          votes: 112,
          contestType: "c7",
          approved: true,
          date: new Date(Date.now() - 3600000 * 20).toISOString()
        },
        {
          id: "photo_3",
          title: "কুয়াশা ঘেরা শীতের সকালের মাঠ",
          category: "শীতের সকাল",
          authorName: "আরিফ চৌধুরী",
          authorPin: "3456",
          url: "https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?w=800&auto=format&fit=crop&q=80",
          views: 890,
          votes: 145,
          contestType: "c30",
          approved: true,
          date: new Date(Date.now() - 3600000 * 48).toISOString()
        },
        {
          id: "photo_4",
          title: "গাছের ডালে রঙিন মাছরাঙা পাখি",
          category: "পাখির ছবি",
          authorName: "মেহেদী হাসান",
          authorPin: "4567",
          url: "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=800&auto=format&fit=crop&q=80",
          views: 240,
          votes: 45,
          contestType: "c24",
          approved: true,
          date: new Date(Date.now() - 3600000 * 2).toISOString()
        }
      ];
      localStorage.setItem("peg_photos", JSON.stringify(defaultPhotos));
    }

    if (!localStorage.getItem("peg_users")) {
      const defaultUsers = {
        "1234": { pin: "1234", name: "তানভীর হাসান", phone: "01711111111", points: 240, taka: "24.00", photosCount: 2, verified: false, telegramBonus: false },
        "2345": { pin: "2345", name: "রাকিবুল ইসলাম", phone: "01822222222", points: 620, taka: "62.00", photosCount: 4, verified: true, telegramBonus: true }
      };
      localStorage.setItem("peg_users", JSON.stringify(defaultUsers));
    }

    if (!localStorage.getItem("peg_withdraws")) {
      localStorage.setItem("peg_withdraws", JSON.stringify([]));
    }
  }

  // ১. সাইটের লাইভ ভিজিটর সংখ্যা (Firebase + Server)
  async getVisitorStats() {
    if (this.hasFirebase) {
      try {
        const res = await fetch(`${this.fbUrl}/stats.json`);
        const stats = await res.json();
        if (stats && stats.total) {
          const todayStr = new Date().toISOString().slice(0, 10);
          if (stats.lastDate !== todayStr) {
            stats.lastDate = todayStr;
            stats.today = 1;
          } else {
            stats.today = (stats.today || 0) + 1;
          }
          stats.total = (stats.total || 12450) + 1;
          // ব্যাকগ্রাউন্ডে ফায়ারবেসে পুশ
          fetch(`${this.fbUrl}/stats.json`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(stats)
          }).catch(() => {});
          return stats;
        }
      } catch (e) {}
    }

    if (this.isServer) {
      try {
        const res = await fetch(`${this.apiBase}?action=stats`);
        const data = await res.json();
        if (data && data.stats) return data.stats;
      } catch (e) {}
    }

    // লোকাল ফলব্যাক
    const todayStr = new Date().toISOString().slice(0, 10);
    let stats = JSON.parse(localStorage.getItem("peg_stats") || "{}");
    if (!stats.total) stats.total = 12450;
    if (stats.lastDate !== todayStr) {
      stats.lastDate = todayStr;
      stats.today = 0;
    }
    stats.total += 1;
    stats.today = (stats.today || 0) + 1;
    localStorage.setItem("peg_stats", JSON.stringify(stats));
    return stats;
  }

  // ২. সব ছবি লোড করা (Firebase First -> Server -> Local)
  async getPhotos() {
    if (this.hasFirebase) {
      try {
        const res = await fetch(`${this.fbUrl}/photos.json`);
        const data = await res.json();
        if (data) {
          let list = [];
          if (Array.isArray(data)) {
            list = data.filter(p => p && p.title);
          } else if (typeof data === "object") {
            list = Object.keys(data).map(k => ({ ...data[k], id: data[k].id || k })).filter(p => p && p.title);
          }
          // নতুন ছবি সবার উপরে সর্ট করা (Newest First)
          list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
          localStorage.setItem("peg_photos", JSON.stringify(list));
          return list;
        }
      } catch (e) {
        console.warn("Firebase fetch photos error:", e);
      }
    }

    if (this.isServer) {
      try {
        const res = await fetch(`${this.apiBase}?action=get_photos`);
        const data = await res.json();
        if (data && data.photos && data.photos.length > 0) {
          localStorage.setItem("peg_photos", JSON.stringify(data.photos));
          return data.photos;
        }
      } catch (e) {}
    }

    const local = localStorage.getItem("peg_photos");
    return local ? JSON.parse(local) : [];
  }

  // ৩. নতুন ছবি আপলোড (সার্ভার + ফায়ারবেস দুটিতেই একসাথে সেভ হবে)
  async addPhoto(photoData) {
    photoData.id = "photo_" + Date.now();
    photoData.views = 0;
    photoData.votes = 0;
    photoData.date = new Date().toISOString();
    photoData.approved = photoData.approved !== undefined ? photoData.approved : false; // পেন্ডিং অনুমোদন
    photoData.status = photoData.approved ? "approved" : "pending";
    photoData.photoType = photoData.photoType || "FREE";
    photoData.price = photoData.photoType === "PAID" ? (parseInt(photoData.price, 10) || 10) : 0;

    // ১. হোস্টিং সার্ভারে ইমেজ ফাইল সেভ করা (api.php) যাতে ক্লিন ইমেজ URL পাওয়া যায়
    if (this.isServer) {
      try {
        const res = await fetch(`${this.apiBase}?action=upload_photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: photoData.id,
            title: photoData.title,
            category: photoData.category,
            contestType: photoData.contestType,
            authorName: photoData.authorName,
            authorPin: photoData.authorPin,
            image: photoData.url
          })
        });
        const data = await res.json();
        if (data.success && data.photo && data.photo.url) {
          photoData.url = data.photo.url; // হোস্টিংয়ের আপলোড ফোল্ডারের ফাইল পাথ
        }
      } catch (e) {
        console.warn("Server upload fallback:", e);
      }
    }

    // ২. ফায়ারবেসে সরাসরি পোস্ট (যাতে সারা বিশ্বের সবাই সাথে সাথে দেখতে পায়!)
    if (this.hasFirebase) {
      try {
        await fetch(`${this.fbUrl}/photos/${photoData.id}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(photoData)
        });
      } catch (e) {
        console.warn("Firebase photo save error:", e);
      }
    }

    // ৩. লোকাল স্টোরেজ আপডেট
    const photos = await this.getPhotos();
    photos.unshift(photoData);
    localStorage.setItem("peg_photos", JSON.stringify(photos));

    // ৪. ইউজারের আপলোড সংখ্যা বৃদ্ধি (Firebase থেকে সর্বশেষ ডাটা নিয়ে আপডেট)
    if (photoData.authorPin) {
      const user = await this.fetchFirebaseUser(photoData.authorPin);
      if (user) {
        user.photosCount = (user.photosCount || 0) + 1;
        this.saveUser(user);
        if (this.hasFirebase) {
          fetch(`${this.fbUrl}/users/${user.pin}.json`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(user)
          }).catch(() => {});
        }
      }
    }

    return photoData;
  }

  // ৪. ছবিতে ভোট দেওয়া (Firebase + Server + Local)
  async votePhoto(photoId, voterPin) {
    const votedKey = `voted_${photoId}`;
    if (localStorage.getItem(votedKey)) {
      return { success: false, message: "আপনি ইতিমধ্যে এই ছবিতে ভোট দিয়েছেন!" };
    }

    const photos = await this.getPhotos();
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return { success: false, message: "ছবিটি খুঁজে পাওয়া যায়নি!" };

    photo.votes = (photo.votes || 0) + 1;
    localStorage.setItem("peg_photos", JSON.stringify(photos));
    localStorage.setItem(votedKey, "true");

    // ইউজারের মোট দেওয়া লাইক/ভোট সংখ্যা বৃদ্ধি
    const totalLikes = parseInt(localStorage.getItem("peg_user_likes") || "0") + 1;
    localStorage.setItem("peg_user_likes", totalLikes.toString());
    if (voterPin) {
      localStorage.setItem(`peg_user_likes_${voterPin}`, totalLikes.toString());
      if (this.hasFirebase) {
        fetch(`${this.fbUrl}/users/${voterPin}/likes_given.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(totalLikes)
        }).catch(() => {});
      }
    }

    // ১. ফায়ারবেস আপডেট
    if (this.hasFirebase) {
      fetch(`${this.fbUrl}/photos/${photoId}/votes.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(photo.votes)
      }).catch(() => {});
    }

    // ২. সার্ভার আপডেট
    if (this.isServer) {
      fetch(`${this.apiBase}?action=vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId })
      }).catch(() => {});
    }

    // ৩. আর্টিস্টের ব্যালেন্স বৃদ্ধি (প্রতি ভোটে ২ পয়েন্ট — সরাসরি Firebase + Local সিঙ্ক)
    if (photo.authorPin) {
      this.creditUserPoints(photo.authorPin, 2).catch(() => {});
    }

    return { success: true, votes: photo.votes, totalGivenLikes: totalLikes };
  }

  // ৫. ছবির ভিউ কাউন্ট বৃদ্ধি
  async incrementView(photoId) {
    const viewedKey = `viewed_${photoId}`;
    if (sessionStorage.getItem(viewedKey)) return;
    sessionStorage.setItem(viewedKey, "true");

    const photos = await this.getPhotos();
    const photo = photos.find(p => p.id === photoId);
    if (photo) {
      photo.views = (photo.views || 0) + 1;
      localStorage.setItem("peg_photos", JSON.stringify(photos));

      if (this.hasFirebase) {
        fetch(`${this.fbUrl}/photos/${photoId}/views.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(photo.views)
        }).catch(() => {});
      }
      if (this.isServer) {
        fetch(`${this.apiBase}?action=view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoId })
        }).catch(() => {});
      }
    }
  }

  // ৬. ইউজার লগইন (Firebase -> Server -> Local)
  async loginUser(pin) {
    // ফায়ারবেসে চেক
    if (this.hasFirebase) {
      try {
        const res = await fetch(`${this.fbUrl}/users/${pin}.json`);
        const user = await res.json();
        if (user && user.pin) {
          this.saveUser(user);
          return { success: true, user };
        }
      } catch (e) {}
    }

    // সার্ভারে চেক
    if (this.isServer) {
      try {
        const res = await fetch(`${this.apiBase}?action=login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin })
        });
        const data = await res.json();
        if (data.success && data.user) {
          this.saveUser(data.user);
          return { success: true, user: data.user };
        }
      } catch (e) {}
    }

    const localUser = this.getUser(pin);
    if (localUser) return { success: true, user: localUser };

    return { success: false, message: "ভুল পিন! একাউন্ট না থাকলে রেজিস্ট্রেশন করুন।" };
  }

  // ৭. ইউজার রেজিস্ট্রেশন (Firebase + Server + Local)
  async registerUser(pin, name, phone, refCode) {
    const existing = await this.fetchFirebaseUser(pin);
    if (existing && existing.pin) {
      return { success: false, message: "এই পিন নম্বরটি ইতিমধ্যে ব্যবহৃত হয়েছে! অন্য পিন দিন বা লগইন করুন।" };
    }

    const newUser = {
      pin: pin,
      name: name,
      phone: phone,
      points: 20, // ওয়েলকাম বোনাস
      taka: "2.00",
      photosCount: 0,
      referralsCount: 0,
      verified: false,
      telegramBonus: false,
      refCode: "REF" + pin,
      referredBy: refCode || "",
      created: new Date().toISOString()
    };

    // ফায়ারবেসে সেভ
    if (this.hasFirebase) {
      try {
        await fetch(`${this.fbUrl}/users/${pin}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newUser)
        });
      } catch (e) {}
    }

    // সার্ভারে সেভ
    if (this.isServer) {
      fetch(`${this.apiBase}?action=register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, name, phone, ref: refCode })
      }).catch(() => {});
    }

    this.saveUser(newUser);

    // সফল রেফারেল বোনাস প্রদান (যদি রেফার কোড দিয়ে একাউন্ট খোলা হয়)
    const cleanRef = (refCode || "").trim().toUpperCase();
    const referrerPin = cleanRef.startsWith("REF") ? cleanRef.slice(3) : cleanRef;
    if (referrerPin && referrerPin !== pin) {
      const refPoints = this.cfg.referralPointsPerUser || 10;
      const updatedRef = await this.creditUserPoints(referrerPin, refPoints, { isReferral: true });
      if (updatedRef) {
        const refTaka = (refPoints * (this.cfg.takaPerPoint || 0.1)).toFixed(2);
        this.sendNotification(referrerPin, {
          title: "🎁 নতুন রেফারেল বোনাস!",
          message: `আপনার রেফার লিংকে "${name}" যোগ দিয়েছেন! আপনার ব্যালেন্সে +৳${refTaka} (${refPoints} পয়েন্ট) যোগ হয়েছে।`,
          type: "ok",
          ts: Date.now()
        }).catch(() => {});
      }
    }

    return { success: true, user: newUser };
  }

  // ৮. টেলিগ্রাম বোনাস ক্লেইম
  async claimTelegramBonus(pin) {
    let user = await this.fetchFirebaseUser(pin);
    if (!user) return { success: false, message: "প্রথমে একাউন্টে লগইন করুন!" };
    if (user.telegramBonus) return { success: false, message: "আপনি ইতিমধ্যে বোনাস পেয়েছেন!" };

    user.telegramBonus = true;
    user.taka = (parseFloat(user.taka || 0) + (this.cfg.telegramJoinBonusTaka || 10.0)).toFixed(2);
    user.points = Math.round(parseFloat(user.taka) / (this.cfg.takaPerPoint || 0.1));
    this.saveUser(user);

    if (this.hasFirebase) {
      fetch(`${this.fbUrl}/users/${pin}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user)
      }).catch(() => {});
    }

    if (this.isServer) {
      fetch(`${this.apiBase}?action=claim_telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
      }).catch(() => {});
    }

    return { success: true, message: `অভিনন্দন! ৳${this.cfg.telegramJoinBonusTaka || 10} বোনাস একাউন্টে যোগ হয়েছে!`, user };
  }

  // ৯. উইথড্র রিকোয়েস্ট (Firebase + Server + Local)
  async requestWithdraw(pin, phone, amountTaka, method) {
    const user = await this.fetchFirebaseUser(pin);
    if (!user) return { success: false, message: "ইউজার পাওয়া যায়নি!" };

    const minTaka = this.cfg.minWithdrawTaka || 50;
    const minPhotos = this.cfg.minPhotosForWithdraw || 3;

    if (parseFloat(user.taka) < amountTaka) {
      return { success: false, message: "আপনার একাউন্টে পর্যাপ্ত ব্যালেন্স নেই!" };
    }
    if (amountTaka < minTaka) {
      return { success: false, message: `সর্বনিম্ন উইথড্র ৳${minTaka} হতে হবে!` };
    }
    if ((user.photosCount || 0) < minPhotos) {
      return { success: false, message: `টাকা তুলতে আপনার কমপক্ষে ${minPhotos}টি ছবি আপলোড থাকতে হবে! বর্তমানে আছে ${user.photosCount || 0}টি।` };
    }

    // ব্যালেন্স কাটা
    user.taka = (parseFloat(user.taka) - amountTaka).toFixed(2);
    user.points = Math.round(parseFloat(user.taka) / (this.cfg.takaPerPoint || 0.1));
    this.saveUser(user);

    const newReq = {
      id: "wd_" + Date.now(),
      pin: pin,
      name: user.name,
      phone: phone,
      amount: amountTaka,
      method: method,
      status: "pending",
      date: new Date().toISOString()
    };

    // ফায়ারবেসে সেভ
    if (this.hasFirebase) {
      fetch(`${this.fbUrl}/withdraws/${newReq.id}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newReq)
      }).catch(() => {});

      fetch(`${this.fbUrl}/users/${pin}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user)
      }).catch(() => {});
    }

    // সার্ভারে সেভ
    if (this.isServer) {
      fetch(`${this.apiBase}?action=withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, phone, amount: amountTaka, method })
      }).catch(() => {});
    }

    const withdraws = JSON.parse(localStorage.getItem("peg_withdraws") || "[]");
    withdraws.unshift(newReq);
    localStorage.setItem("peg_withdraws", JSON.stringify(withdraws));

    return { success: true, message: "উইথড্র আবেদন সফল হয়েছে! অ্যাডমিন যাচাই করে বিকাশ/নগদে টাকা পাঠাবে।" };
  }

  // ১০. অ্যাডমিন: উইথড্র তালিকা
  async getWithdraws() {
    if (this.hasFirebase) {
      try {
        const res = await fetch(`${this.fbUrl}/withdraws.json`);
        const data = await res.json();
        if (data) {
          return Object.keys(data).map(k => ({ ...data[k], id: data[k].id || k }));
        }
      } catch (e) {}
    }
    if (this.isServer) {
      try {
        const res = await fetch(`${this.apiBase}?action=get_withdraws`);
        const data = await res.json();
        if (data.success && data.withdraws) return data.withdraws;
      } catch (e) {}
    }
    return JSON.parse(localStorage.getItem("peg_withdraws") || "[]");
  }

  // ১১. অ্যাডমিন: উইথড্র আপডেট
  async updateWithdrawStatus(id, newStatus) {
    if (this.hasFirebase) {
      fetch(`${this.fbUrl}/withdraws/${id}/status.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStatus)
      }).catch(() => {});
    }
    if (this.isServer) {
      fetch(`${this.apiBase}?action=update_withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus })
      }).catch(() => {});
    }
    const withdraws = JSON.parse(localStorage.getItem("peg_withdraws") || "[]");
    const req = withdraws.find(w => w.id === id);
    if (req) {
      req.status = newStatus;
      localStorage.setItem("peg_withdraws", JSON.stringify(withdraws));
    }
    return true;
  }

  // ১২. অ্যাডমিন: ছবি মুছে ফেলা
  async deletePhoto(id) {
    if (this.hasFirebase) {
      fetch(`${this.fbUrl}/photos/${id}.json`, {
        method: "DELETE"
      }).catch(() => {});
    }
    if (this.isServer) {
      fetch(`${this.apiBase}?action=delete_photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      }).catch(() => {});
    }
    const photos = await this.getPhotos();
    const updated = photos.filter(p => p.id !== id);
    localStorage.setItem("peg_photos", JSON.stringify(updated));
    return true;
  }

  getUser(pin) {
    const users = JSON.parse(localStorage.getItem("peg_users") || "{}");
    return users[pin] || null;
  }

  saveUser(userData) {
    const users = JSON.parse(localStorage.getItem("peg_users") || "{}");
    users[userData.pin] = userData;
    localStorage.setItem("peg_users", JSON.stringify(users));
  }

  // Firebase থেকে নির্দিষ্ট ইউজারের লেটেস্ট তথ্য আনা (অফলাইনে লোকাল ফলব্যাক)
  async fetchFirebaseUser(pin) {
    if (!pin) return null;
    if (this.hasFirebase) {
      try {
        const res = await fetch(`${this.fbUrl}/users/${pin}.json`);
        const fbUser = await res.json();
        if (fbUser && fbUser.pin) {
          this.saveUser(fbUser);
          return fbUser;
        }
      } catch (e) {}
    }
    return this.getUser(pin);
  }

  // ইউজারের পয়েন্ট ও টাকা সিঙ্ক করে আপডেট করা (ভোট, রেফারেল ও অ্যাডমিন রিওয়ার্ড)
  async creditUserPoints(pin, addPoints, opts = {}) {
    const user = await this.fetchFirebaseUser(pin);
    if (!user) return null;

    const takaPerPoint = this.cfg.takaPerPoint || 0.1;
    const basePoints = (user.points !== undefined && user.points !== null)
      ? (parseInt(user.points, 10) || 0)
      : Math.round(parseFloat(user.taka || 0) / takaPerPoint);

    user.points = Math.max(0, basePoints + (parseInt(addPoints, 10) || 0));
    user.taka = (user.points * takaPerPoint).toFixed(2);
    if (opts.isReferral) {
      user.referralsCount = (user.referralsCount || 0) + 1;
    }

    this.saveUser(user);
    if (this.hasFirebase) {
      try {
        await fetch(`${this.fbUrl}/users/${pin}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user)
        });
      } catch (e) {}
    }
    return user;
  }

  // অ্যাডমিন: সকল রেজিস্টার্ড ইউজার ও তাদের আয়ের তালিকা আনা
  async getAllUsers() {
    let list = [];
    if (this.hasFirebase) {
      try {
        const res = await fetch(`${this.fbUrl}/users.json`);
        const data = await res.json();
        if (data && typeof data === "object") {
          list = Object.keys(data)
            .map(k => ({ ...data[k], pin: (data[k] && data[k].pin) || k }))
            .filter(u => u && u.name);
        }
      } catch (e) {}
    }

    if (list.length === 0) {
      try {
        const localMap = JSON.parse(localStorage.getItem("peg_users") || "{}");
        list = Object.values(localMap).filter(u => u && u.name);
      } catch (e) {}
    }

    list.sort((a, b) => parseFloat(b.taka || 0) - parseFloat(a.taka || 0));
    return list;
  }

  // অ্যাডমিন: ইউজারের ব্যালেন্সে পুরস্কার/টাকা যোগ বা সমন্বয় করা
  async adjustUserBalance(pin, deltaTaka, note = "") {
    const takaPerPoint = this.cfg.takaPerPoint || 0.1;
    const addPoints = Math.round((parseFloat(deltaTaka) || 0) / takaPerPoint);
    if (!pin || addPoints === 0) return { success: false, message: "সঠিক পরিমাণ দিন!" };

    const updated = await this.creditUserPoints(pin, addPoints);
    if (!updated) return { success: false, message: "ইউজার পাওয়া যায়নি!" };

    const amtText = Math.abs(parseFloat(deltaTaka)).toFixed(2);
    const isPositive = parseFloat(deltaTaka) >= 0;
    await this.sendNotification(pin, {
      title: isPositive ? "🏆 অ্যাডমিন রিওয়ার্ড প্রাপ্তি!" : "💳 ব্যালেন্স সমন্বয়",
      message: isPositive
        ? `অভিনন্দন! অ্যাডমিন আপনার অ্যাকাউন্টে +৳${amtText} যোগ করেছেন।${note ? " (" + note + ")" : ""}`
        : `অ্যাডমিন আপনার ব্যালেন্স থেকে ৳${amtText} সমন্বয় করেছেন।${note ? " (" + note + ")" : ""}`,
      type: isPositive ? "ok" : "info",
      ts: Date.now()
    });

    return { success: true, user: updated };
  }

  // ১৩. লাইভ পাবলিক চ্যাট মেসেজ আনা (Firebase + Local)
  async getChatMessages() {
    if (this.hasFirebase) {
      try {
        const res = await fetch(`${this.fbUrl}/chat.json`);
        const data = await res.json();
        if (data) {
          const list = Object.keys(data).map(k => ({ ...data[k], id: data[k].id || k }));
          list.sort((a, b) => new Date(a.time || 0) - new Date(b.time || 0));
          return list.slice(-60); // শেষের ৬০টি মেসেজ
        }
      } catch (e) {}
    }
    const local = JSON.parse(localStorage.getItem("peg_chat") || "[]");
    return local;
  }

  // ১৪. লাইভ পাবলিক চ্যাট মেসেজ পাঠানো (Firebase + Local)
  async sendChatMessage(text, authorName, authorPin) {
    const msgId = "msg_" + Date.now();
    const newMsg = {
      id: msgId,
      text: text.trim(),
      name: authorName || "অতিথি",
      pin: authorPin || "",
      isAdmin: authorPin === (this.cfg.adminPin || "1802"),
      time: new Date().toISOString()
    };

    if (this.hasFirebase) {
      try {
        await fetch(`${this.fbUrl}/chat/${msgId}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newMsg)
        });
      } catch (e) {}
    }

    const local = JSON.parse(localStorage.getItem("peg_chat") || "[]");
    local.push(newMsg);
    if (local.length > 60) local.shift();
    localStorage.setItem("peg_chat", JSON.stringify(local));

    return newMsg;
  }

  async deleteChatMessage(msgId) {
    if (this.hasFirebase) {
      try {
        await fetch(`${this.fbUrl}/chat/${msgId}.json`, { method: "DELETE" });
      } catch (e) {}
    }
    let local = JSON.parse(localStorage.getItem("peg_chat") || "[]");
    local = local.filter(m => m.id !== msgId);
    localStorage.setItem("peg_chat", JSON.stringify(local));
    return { success: true };
  }

  async clearAllChat() {
    if (this.hasFirebase) {
      try {
        await fetch(`${this.fbUrl}/chat.json`, { method: "DELETE" });
      } catch (e) {}
    }
    localStorage.removeItem("peg_chat");
    return { success: true };
  }


  // ১৫. ফটো লাইক সিস্টেম (GalleryBD স্টাইল)
  async likePhoto(photoId) {
    const likedKey = `liked_${photoId}`;
    if (localStorage.getItem(likedKey)) {
      return { success: false, message: "আপনি ইতিমধ্যে এই ছবিতে লাইক দিয়েছেন!" };
    }

    const photos = await this.getPhotos();
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return { success: false, message: "ছবি পাওয়া যায়নি!" };

    photo.likes = (photo.likes || 0) + 1;
    localStorage.setItem("peg_photos", JSON.stringify(photos));
    localStorage.setItem(likedKey, "true");

    // ইউজারের মোট দেওয়া লাইক সংখ্যা বৃদ্ধি
    const totalLikes = parseInt(localStorage.getItem("peg_user_likes") || "0") + 1;
    localStorage.setItem("peg_user_likes", totalLikes.toString());

    // ফায়ারবেসে সেভ
    if (this.hasFirebase) {
      fetch(`${this.fbUrl}/photos/${photoId}/likes.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(photo.likes)
      }).catch(() => {});
    }

    // প্রতি ৫ লাইকে ভেরিফাই লাগলে ফ্ল্যাগ
    const verifyEvery = this.cfg.likeVerifyEvery || 5;
    const needVerify = (totalLikes % verifyEvery === 0);

    return {
      success: true,
      likes: photo.likes,
      totalGivenLikes: totalLikes,
      needVerify: needVerify
    };
  }

  // ১৬. ক্রিয়েটর ফলো সিস্টেম (GalleryBD স্টাইল)
  async toggleFollowCreator(creatorPin) {
    if (!creatorPin) return { success: false, message: "ক্রিয়েটর তথ্য নেই" };
    let follows = JSON.parse(localStorage.getItem("peg_follows") || "[]");
    const idx = follows.indexOf(creatorPin);
    let isFollowing = false;

    if (idx !== -1) {
      follows.splice(idx, 1);
      isFollowing = false;
    } else {
      follows.push(creatorPin);
      isFollowing = true;
    }

    localStorage.setItem("peg_follows", JSON.stringify(follows));

    // ক্রিয়েটরের ফলোয়ার সংখ্যা আপডেট
    if (this.hasFirebase) {
      try {
        const res = await fetch(`${this.fbUrl}/users/${creatorPin}/followers.json`);
        let count = (await res.json()) || 0;
        count = isFollowing ? count + 1 : Math.max(0, count - 1);
        fetch(`${this.fbUrl}/users/${creatorPin}/followers.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(count)
        }).catch(() => {});
      } catch (e) {}
    }

    return { success: true, isFollowing, totalFollowed: follows.length };
  }

  isFollowing(creatorPin) {
    if (!creatorPin) return false;
    const follows = JSON.parse(localStorage.getItem("peg_follows") || "[]");
    return follows.includes(creatorPin);
  }

  // ১৭. আপলোড কোটা ক্যালকুলেশন (১৫ লাইক ও ২০ ফলোর শর্ত)
  getUploadQuota(pin) {
    const user = pin ? this.getUser(pin) : null;
    const needL = this.cfg.uploadNeedLikes || 30;
    const needF = this.cfg.uploadNeedFollows || 20;

    const pinLikes = pin ? parseInt(localStorage.getItem(`peg_user_likes_${pin}`) || "0") : 0;
    const globalLikes = parseInt(localStorage.getItem("peg_user_likes") || "0");
    const currentLikes = Math.max(pinLikes, globalLikes, (user && user.likesGiven) || 0);

    const follows = JSON.parse(localStorage.getItem("peg_follows") || "[]");
    const currentFollows = follows.length;

    return {
      ok: currentLikes >= needL && currentFollows >= needF,
      likes: currentLikes,
      needLikes: needL,
      follows: currentFollows,
      needFollows: needF
    };
  }

  // ১৮. উইথড্র সিকিউরিটি: ব্যান চেক
  getWithdrawBan() {
    try {
      return JSON.parse(localStorage.getItem("peg_wd_ban") || "{}");
    } catch (e) {
      return {};
    }
  }

  recordWrongWithdrawPin() {
    const ban = this.getWithdrawBan();
    ban.strikes = (ban.strikes || 0) + 1;
    const maxStrikes = this.cfg.strikesToPermanent || 2;
    if (ban.strikes >= maxStrikes) {
      ban.perm = true;
    } else {
      ban.until = Date.now() + (this.cfg.banHours || 24) * 3600 * 1000;
    }
    localStorage.setItem("peg_wd_ban", JSON.stringify(ban));
    return ban;
  }

  // ১৯. অটোমেটিক ছবি অনুমোদন সেটিংস (Admin Auto-Approve Toggle)
  async isAutoApproveEnabled() {
    let local = localStorage.getItem("peg_auto_approve") === "true";
    if (this.hasFirebase) {
      try {
        const res = await fetch(`${this.fbUrl}/settings/auto_approve.json`);
        const val = await res.json();
        if (val !== null) {
          local = !!val;
          localStorage.setItem("peg_auto_approve", local ? "true" : "false");
        }
      } catch (e) {}
    }
    return local;
  }

  async setAutoApprove(enabled) {
    localStorage.setItem("peg_auto_approve", enabled ? "true" : "false");
    if (this.hasFirebase) {
      fetch(`${this.fbUrl}/settings/auto_approve.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enabled)
      }).catch(() => {});
    }
    if (this.isServer) {
      fetch(`${this.apiBase}?action=set_auto_approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled })
      }).catch(() => {});
    }
    return enabled;
  }

  // ========================================================
  // 🔔 নোটিফিকেশন ও অ্যাডমিন অনুমোদন সিস্টেম (GalleryBD স্টাইল)
  // ========================================================

  // ছবি অনুমোদন করা (Approve Photo)
  async approvePhoto(photoId) {
    const photos = await this.getPhotos();
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return { success: false, message: "ছবি পাওয়া যায়নি" };

    photo.approved = true;
    photo.status = "approved";
    localStorage.setItem("peg_photos", JSON.stringify(photos));

    // ফায়ারবেস আপডেট
    if (this.hasFirebase) {
      try {
        await fetch(`${this.fbUrl}/photos/${photoId}/approved.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(true)
        });
        await fetch(`${this.fbUrl}/photos/${photoId}/status.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify("approved")
        });
      } catch (e) {
        console.warn("Firebase approve error:", e);
      }
    }

    // সার্ভার আপডেট
    if (this.isServer) {
      try {
        await fetch(`${this.apiBase}?action=approve_photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: photoId })
        });
      } catch (e) {}
    }

    // ইউজারের ইনবক্সে নোটিফিকেশন পাঠানো
    if (photo.authorPin) {
      await this.sendNotification(photo.authorPin, {
        title: "ছবি অনুমোদিত হয়েছে! 🎉",
        message: `অভিনন্দন! আপনার ছবি "${photo.title}" অ্যাডমিন কর্তৃক অনুমোদিত হয়েছে এবং পাবলিক ফিডে লাইভ হয়েছে।`,
        type: "ok",
        ts: Date.now()
      });
    }

    return { success: true, photo };
  }

  // ছবি বাতিল করা (Reject Photo)
  async rejectPhoto(photoId, reason = "নীতিমালা পরিপন্থী বা অস্পষ্ট ছবি") {
    const photos = await this.getPhotos();
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return { success: false, message: "ছবি পাওয়া যায়নি" };

    // ডিলিট অথবা রিজেক্টেড মার্ক করা
    const filtered = photos.filter(p => p.id !== photoId);
    localStorage.setItem("peg_photos", JSON.stringify(filtered));

    if (this.hasFirebase) {
      try {
        await fetch(`${this.fbUrl}/photos/${photoId}.json`, { method: "DELETE" });
      } catch (e) {}
    }

    if (this.isServer) {
      try {
        await fetch(`${this.apiBase}?action=delete_photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: photoId })
        });
      } catch (e) {}
    }

    // ইউজারের ইনবক্সে বাতিলের কারণ জানানো
    if (photo.authorPin) {
      await this.sendNotification(photo.authorPin, {
        title: "ছবি অনুমোদন হয়নি",
        message: `দুঃখিত! আপনার ছবি "${photo.title}" বাতিল করা হয়েছে। কারণ: ${reason}`,
        type: "bad",
        ts: Date.now()
      });
    }

    return { success: true };
  }

  // ব্যক্তিগত নোটিফিকেশন পাঠানো
  async sendNotification(pin, notif) {
    if (!pin) return;
    const notifObj = {
      id: "nt_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      title: notif.title || "নতুন নোটিফিকেশন",
      message: notif.message || "",
      type: notif.type || "info", // ok, bad, info
      ts: notif.ts || Date.now()
    };

    // লোকালস্টোরেজ
    const key = `peg_notifs_${pin}`;
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem(key) || "[]");
    } catch (e) {}
    list.unshift(notifObj);
    localStorage.setItem(key, JSON.stringify(list.slice(0, 30)));

    // ফায়ারবেস
    if (this.hasFirebase) {
      try {
        await fetch(`${this.fbUrl}/notif/${pin}/${notifObj.id}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(notifObj)
        });
      } catch (e) {}
    }

    return notifObj;
  }

  // সাইটব্যাপী ব্রডকাস্ট নোটিশ পাঠানো
  async sendBroadcastNotice(title, message) {
    const notifObj = {
      id: "bc_" + Date.now(),
      title: title || "📢 সাইট নোটিশ",
      message: message,
      type: "broadcast",
      ts: Date.now()
    };

    let list = [];
    try {
      list = JSON.parse(localStorage.getItem("peg_notifs_broadcast") || "[]");
    } catch (e) {}
    list.unshift(notifObj);
    localStorage.setItem("peg_notifs_broadcast", JSON.stringify(list.slice(0, 30)));

    if (this.hasFirebase) {
      try {
        await fetch(`${this.fbUrl}/notif/_all/${notifObj.id}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(notifObj)
        });
      } catch (e) {}
    }

    return notifObj;
  }

  // ইউজারের সমস্ত নোটিফিকেশন ও সাইট নোটিশ পাওয়া
  async getNotifications(pin) {
    let personalList = [];
    let broadcastList = [];

    // ১. লোকালস্টোরেজ থেকে
    if (pin) {
      try {
        personalList = JSON.parse(localStorage.getItem(`peg_notifs_${pin}`) || "[]");
      } catch (e) {}
    }
    try {
      broadcastList = JSON.parse(localStorage.getItem("peg_notifs_broadcast") || "[]");
    } catch (e) {}

    // ২. ফায়ারবেস থেকে সিঙ্ক
    if (this.hasFirebase) {
      try {
        if (pin) {
          const r1 = await fetch(`${this.fbUrl}/notif/${pin}.json`);
          const d1 = await r1.json();
          if (d1 && typeof d1 === "object") {
            personalList = Object.values(d1);
          }
        }
        const r2 = await fetch(`${this.fbUrl}/notif/_all.json`);
        const d2 = await r2.json();
        if (d2 && typeof d2 === "object") {
          broadcastList = Object.values(d2);
        }
      } catch (e) {}
    }

    // মার্জ ও তারিখ অনুযায়ী সাজানো (নতুন সবার আগে)
    const all = [...personalList, ...broadcastList];
    all.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return all.slice(0, 35);
  }

}

window.DB = new AppDB();