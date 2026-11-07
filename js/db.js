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
    photoData.approved = true;

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

    // ৪. ইউজারের আপলোড সংখ্যা বৃদ্ধি
    if (photoData.authorPin) {
      const user = this.getUser(photoData.authorPin);
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
  async votePhoto(photoId) {
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

    // ৩. আর্টিস্টের ব্যালেন্স বৃদ্ধি (প্রতি ভোটে ২ পয়েন্ট)
    if (photo.authorPin) {
      const artist = this.getUser(photo.authorPin);
      if (artist) {
        artist.points = (artist.points || 0) + 2;
        artist.taka = (artist.points * (this.cfg.takaPerPoint || 0.1)).toFixed(2);
        this.saveUser(artist);
        if (this.hasFirebase) {
          fetch(`${this.fbUrl}/users/${artist.pin}.json`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(artist)
          }).catch(() => {});
        }
      }
    }

    return { success: true, votes: photo.votes };
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
    const newUser = {
      pin: pin,
      name: name,
      phone: phone,
      points: 20, // ওয়েলকাম বোনাস
      taka: "2.00",
      photosCount: 0,
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
    return { success: true, user: newUser };
  }

  // ৮. টেলিগ্রাম বোনাস ক্লেইম
  async claimTelegramBonus(pin) {
    let user = this.getUser(pin);
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
    const user = this.getUser(pin);
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
      isAdmin: authorPin === (this.cfg.adminPin || "8800"),
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
}

window.DB = new AppDB();
