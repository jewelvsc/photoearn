/**
 * ========================================================
 * 🗄️ Database & Storage Layer (db.js)
 * PHP Server API (Real Shared Database) + LocalStorage Fallback
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

  // ডিফল্ট ডেমো ডাটা ইনিশিয়ালাইজেশন (লোকাল মোডের জন্য)
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

  // ১. সাইটের লাইভ ভিজিটর সংখ্যা
  async getVisitorStats() {
    if (this.isServer) {
      try {
        const res = await fetch(`${this.apiBase}?action=stats`);
        const data = await res.json();
        if (data && data.stats) return data.stats;
      } catch (e) {
        console.warn("Server stats fallback:", e);
      }
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

  // ২. সব ছবি লোড করা (Firebase + Server API)
  async getPhotos() {
    if (this.hasFirebase) {
      try {
        const res = await fetch(`${this.fbUrl}/photos.json`);
        const data = await res.json();
        if (data) {
          const list = Array.isArray(data) ? data : Object.keys(data).map(k => ({ ...data[k], fbKey: k }));
          const validList = list.filter(p => p && p.title);
          localStorage.setItem("peg_photos", JSON.stringify(validList));
          return validList;
        }
      } catch (e) {
        console.warn("Firebase fetch photos error:", e);
      }
    }

    if (this.isServer) {
      try {
        const res = await fetch(`${this.apiBase}?action=get_photos`);
        const data = await res.json();
        if (data && data.photos) {
          localStorage.setItem("peg_photos", JSON.stringify(data.photos));
          return data.photos;
        }
      } catch (e) {
        console.warn("Server fetch photos error, fallback to local:", e);
      }
    }
    const local = localStorage.getItem("peg_photos");
    return local ? JSON.parse(local) : [];
  }

  // ৩. নতুন ছবি আপলোড
  async addPhoto(photoData) {
    if (this.isServer) {
      try {
        const res = await fetch(`${this.apiBase}?action=upload_photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: photoData.title,
            category: photoData.category,
            contestType: photoData.contestType,
            authorName: photoData.authorName,
            authorPin: photoData.authorPin,
            image: photoData.url
          })
        });
        const data = await res.json();
        if (data.success && data.photo) {
          return data.photo;
        }
      } catch (e) {
        console.warn("Server upload error, fallback to local:", e);
      }
    }

    // লোকাল মোড
    photoData.id = "photo_" + Date.now();
    photoData.views = 0;
    photoData.votes = 0;
    photoData.date = new Date().toISOString();
    photoData.approved = true;

    const photos = await this.getPhotos();
    photos.unshift(photoData);
    localStorage.setItem("peg_photos", JSON.stringify(photos));

    if (this.hasFirebase) {
      try {
        await fetch(`${this.fbUrl}/photos.json`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(photoData)
        });
      } catch (e) {
        console.warn("Firebase photo post error:", e);
      }
    }

    if (photoData.authorPin) {
      const user = this.getUser(photoData.authorPin);
      if (user) {
        user.photosCount = (user.photosCount || 0) + 1;
        this.saveUser(user);
      }
    }
    return photoData;
  }

  // ৪. ছবিতে ভোট দেওয়া
  async votePhoto(photoId) {
    const votedKey = `voted_${photoId}`;
    if (localStorage.getItem(votedKey)) {
      return { success: false, message: "আপনি ইতিমধ্যে এই ছবিতে ভোট দিয়েছেন!" };
    }

    if (this.isServer) {
      try {
        const res = await fetch(`${this.apiBase}?action=vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoId })
        });
        const data = await res.json();
        if (data.success) {
          localStorage.setItem(votedKey, "true");
          return { success: true, votes: data.votes };
        }
      } catch (e) {
        console.warn("Server vote error, fallback to local:", e);
      }
    }

    // লোকাল মোড
    const photos = await this.getPhotos();
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return { success: false, message: "ছবিটি খুঁজে পাওয়া যায়নি!" };

    photo.votes = (photo.votes || 0) + 1;
    localStorage.setItem("peg_photos", JSON.stringify(photos));
    localStorage.setItem(votedKey, "true");

    if (this.hasFirebase && photo.fbKey) {
      try {
        await fetch(`${this.fbUrl}/photos/${photo.fbKey}/votes.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(photo.votes)
        });
      } catch (e) {}
    }

    if (photo.authorPin) {
      const artist = this.getUser(photo.authorPin);
      if (artist) {
        artist.points = (artist.points || 0) + 2;
        artist.taka = (artist.points * 0.1).toFixed(2);
        this.saveUser(artist);
      }
    }

    return { success: true, votes: photo.votes };
  }

  // ৫. ছবির ভিউ কাউন্ট
  async incrementView(photoId) {
    const viewedKey = `viewed_${photoId}`;
    if (sessionStorage.getItem(viewedKey)) return;
    sessionStorage.setItem(viewedKey, "true");

    if (this.isServer) {
      try {
        await fetch(`${this.apiBase}?action=view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoId })
        });
      } catch (e) {}
    }

    const photos = await this.getPhotos();
    const photo = photos.find(p => p.id === photoId);
    if (photo) {
      photo.views = (photo.views || 0) + 1;
      localStorage.setItem("peg_photos", JSON.stringify(photos));
    }
  }

  // ৬. ইউজার লগইন
  async loginUser(pin) {
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
        } else {
          return { success: false, message: data.message || "ভুল পিন!" };
        }
      } catch (e) {
        console.warn("Server login fallback:", e);
      }
    }
    const user = this.getUser(pin);
    if (user) return { success: true, user };
    return { success: false, message: "ভুল পিন! একাউন্ট না থাকলে রেজিস্ট্রেশন করুন।" };
  }

  // ৭. ইউজার রেজিস্ট্রেশন
  async registerUser(pin, name, phone, refCode) {
    if (this.isServer) {
      try {
        const res = await fetch(`${this.apiBase}?action=register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin, name, phone, ref: refCode })
        });
        const data = await res.json();
        if (data.success && data.user) {
          this.saveUser(data.user);
          return { success: true, user: data.user };
        } else {
          return { success: false, message: data.message || "রেজিস্ট্রেশন ব্যর্থ হয়েছে!" };
        }
      } catch (e) {
        console.warn("Server register fallback:", e);
      }
    }

    const existing = this.getUser(pin);
    if (existing) {
      return { success: false, message: "এই পিন দিয়ে ইতিমধ্যে একাউন্ট রয়েছে!" };
    }

    const newUser = {
      pin: pin,
      name: name,
      phone: phone,
      points: 20,
      taka: "2.00",
      photosCount: 0,
      verified: false,
      telegramBonus: false,
      refCode: "REF" + pin,
      created: new Date().toISOString()
    };

    this.saveUser(newUser);
    return { success: true, user: newUser };
  }

  // ৮. টেলিগ্রাম বোনাস
  async claimTelegramBonus(pin) {
    if (this.isServer) {
      try {
        const res = await fetch(`${this.apiBase}?action=claim_telegram`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin })
        });
        const data = await res.json();
        if (data.success) {
          this.saveUser(data.user);
          return { success: true, message: data.message, user: data.user };
        } else {
          return { success: false, message: data.message };
        }
      } catch (e) {}
    }

    const user = this.getUser(pin);
    if (!user) return { success: false, message: "প্রথমে একাউন্টে লগইন করুন!" };
    if (user.telegramBonus) return { success: false, message: "আপনি ইতিমধ্যে টেলিগ্রাম বোনাস পেয়েছেন!" };

    user.telegramBonus = true;
    user.taka = (parseFloat(user.taka || 0) + 10.0).toFixed(2);
    user.points = Math.round(parseFloat(user.taka) / 0.1);
    this.saveUser(user);
    return { success: true, message: "অভিনন্দন! ৳১০ আপনার একাউন্টে যোগ হয়েছে!", user };
  }

  // ৯. উইথড্র রিকোয়েস্ট
  async requestWithdraw(pin, phone, amountTaka, method) {
    if (this.isServer) {
      try {
        const res = await fetch(`${this.apiBase}?action=withdraw`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin, phone, amount: amountTaka, method })
        });
        const data = await res.json();
        if (data.success) {
          // লোকাল ক্যাশ রিফ্রেশ
          const user = this.getUser(pin);
          if (user) {
            user.taka = (parseFloat(user.taka) - amountTaka).toFixed(2);
            user.points = Math.round(parseFloat(user.taka) / 0.1);
            this.saveUser(user);
          }
          return { success: true, message: data.message };
        } else {
          return { success: false, message: data.message };
        }
      } catch (e) {}
    }

    const user = this.getUser(pin);
    if (!user) return { success: false, message: "ইউজার পাওয়া যায়নি!" };
    if (parseFloat(user.taka) < amountTaka) return { success: false, message: "পর্যাপ্ত ব্যালেন্স নেই!" };

    user.taka = (parseFloat(user.taka) - amountTaka).toFixed(2);
    user.points = Math.round(parseFloat(user.taka) / 0.1);
    this.saveUser(user);

    const withdraws = JSON.parse(localStorage.getItem("peg_withdraws") || "[]");
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
    withdraws.unshift(newReq);
    localStorage.setItem("peg_withdraws", JSON.stringify(withdraws));
    return { success: true, message: "উইথড্র রিকোয়েস্ট সফল হয়েছে! অ্যাডমিন যাচাই করে পেমেন্ট পাঠিয়ে দেবে।" };
  }

  // ১০. অ্যাডমিন: উইথড্র হিস্ট্রি
  async getWithdraws() {
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
    if (this.isServer) {
      try {
        await fetch(`${this.apiBase}?action=update_withdraw`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status: newStatus })
        });
      } catch (e) {}
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
    if (this.isServer) {
      try {
        await fetch(`${this.apiBase}?action=delete_photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id })
        });
      } catch (e) {}
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
}

window.DB = new AppDB();
