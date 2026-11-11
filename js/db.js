/**
 * ========================================================
 * 🗄️ Database & Security Layer (db.js)
 * Authoritative Hostinger PHP API (api.php) + Local Offline Fallback
 * ========================================================
 */

class AppDB {
  constructor() {
    this.cfg = window.APP_CONFIG || {};
    this.isServer = window.location.protocol.startsWith("http");
    this.apiBase = "api.php";
    this.initDefaultLocalData();
  }

  // শেয়ার্ড PHP API কল হেল্পার (সেম-অরিজিন কুকিসহ JSON যাচাই)
  async apiCall(action, payload = null, query = "") {
    if (!this.isServer) return null;
    try {
      const method = payload === null ? "GET" : "POST";
      const url = `${this.apiBase}?action=${encodeURIComponent(action)}${query ? "&" + query : ""}`;
      const opts = {
        method,
        credentials: "same-origin",
        headers: payload === null ? {} : { "Content-Type": "application/json" }
      };
      if (payload !== null) opts.body = JSON.stringify(payload);

      const res = await fetch(url, opts);
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (!ct.includes("application/json")) return null; // লোকাল Python ডেভ সার্ভার হলে অফলাইন ফলব্যাক

      const data = await res.json();
      return { status: res.status, ok: res.ok, data };
    } catch (e) {
      return null;
    }
  }

  // ডিফল্ট ডেমো ডাটা (অফলাইন/লোকাল টেস্টের জন্য)
  initDefaultLocalData() {
    if (!localStorage.getItem("peg_photos")) {
      const defaultPhotos = [
        {
          id: "photo_1",
          title: "গ্রামের শান্ত বিকেল ও সূর্যাস্ত",
          category: "গ্রামের দৃশ্য",
          authorName: "তানভীর হাসান",
          authorId: "demo_tanvir",
          views: 342,
          votes: 68,
          likes: 25,
          contestType: "c24",
          approved: true,
          url: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=80",
          date: new Date(Date.now() - 3600000 * 4).toISOString()
        },
        {
          id: "photo_2",
          title: "নদীর বুকে পালতোলা নৌকা",
          category: "নদী ও নৌকা",
          authorName: "রাকিবুল ইসলাম",
          authorId: "demo_rakib",
          views: 654,
          votes: 112,
          likes: 40,
          contestType: "c7",
          approved: true,
          url: "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=800&auto=format&fit=crop&q=80",
          date: new Date(Date.now() - 3600000 * 20).toISOString()
        }
      ];
      localStorage.setItem("peg_photos", JSON.stringify(defaultPhotos));
    }

    if (!localStorage.getItem("peg_users")) {
      localStorage.setItem("peg_users", JSON.stringify({}));
    }

    if (!localStorage.getItem("peg_withdraws")) {
      localStorage.setItem("peg_withdraws", JSON.stringify([]));
    }
  }

  // ১. সাইটের লাইভ ভিজিটর সংখ্যা
  async getVisitorStats() {
    const res = await this.apiCall("stats");
    if (res && res.data && res.data.stats) return res.data.stats;

    const todayStr = new Date().toISOString().slice(0, 10);
    const stats = JSON.parse(localStorage.getItem("peg_stats") || "{}");
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

  // ২. সব ছবি লোড করা (অ্যাডমিন হলে পেন্ডিং সহ)
  async getPhotos(includeAllForAdmin = false) {
    const res = await this.apiCall("get_photos", null, includeAllForAdmin ? "all=1" : "");
    if (res && res.data && Array.isArray(res.data.photos)) {
      const list = [...res.data.photos].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      if (!includeAllForAdmin) localStorage.setItem("peg_photos", JSON.stringify(list));
      return list;
    }
    const local = localStorage.getItem("peg_photos");
    return local ? JSON.parse(local) : [];
  }

  // ৩. নতুন ছবি আপলোড
  async addPhoto(photoData) {
    const payload = {
      title: photoData.title,
      category: photoData.category,
      contestType: photoData.contestType,
      authorName: photoData.authorName,
      authorPin: photoData.authorPin,
      photoType: photoData.photoType || "FREE",
      price: photoData.price || 0,
      image: photoData.url
    };

    const res = await this.apiCall("upload_photo", payload);
    if (res && res.data) {
      if (!res.data.success) {
        return { error: true, message: res.data.message || "ছবি আপলোড ব্যর্থ হয়েছে!" };
      }
      const savedPhoto = res.data.photo;
      const user = this.getUser(photoData.authorPin);
      if (user) {
        user.photosCount = (user.photosCount || 0) + 1;
        this.saveUser(user);
      }
      return savedPhoto;
    }

    // অফলাইন লোকাল ফলব্যাক
    const isAuto = await this.isAutoApproveEnabled();
    photoData.id = "photo_" + Date.now();
    photoData.views = 0;
    photoData.votes = 0;
    photoData.likes = 0;
    photoData.approved = isAuto;
    photoData.status = isAuto ? "approved" : "pending";
    photoData.date = new Date().toISOString();
    photoData.authorId = photoData.authorPin ? `u_${photoData.authorPin}` : "guest";
    const photos = await this.getPhotos();
    photos.unshift(photoData);
    localStorage.setItem("peg_photos", JSON.stringify(photos));
    return photoData;
  }

  // ৪. ছবিতে ভোট দেওয়া (সার্ভার-ভেরিফাইড + লোকাল ডুপ্লিকেট গার্ড)
  async votePhoto(photoId, voterPin) {
    const votedKey = `voted_${photoId}`;
    if (localStorage.getItem(votedKey)) {
      return { success: false, message: "আপনি ইতিমধ্যে এই ছবিতে ভোট দিয়েছেন!" };
    }

    const res = await this.apiCall("vote", { photoId, voterPin: voterPin || "" });
    if (res && res.data) {
      if (!res.data.success) {
        return { success: false, message: res.data.message || "ভোট দেওয়া যায়নি!" };
      }
      localStorage.setItem(votedKey, "true");
      const totalLikes = this._bumpLocalLikes(voterPin);
      return { success: true, votes: res.data.votes, totalGivenLikes: totalLikes };
    }

    // অফলাইন লোকাল ফলব্যাক
    const photos = await this.getPhotos();
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return { success: false, message: "ছবিটি খুঁজে পাওয়া যায়নি!" };
    photo.votes = (photo.votes || 0) + 1;
    localStorage.setItem("peg_photos", JSON.stringify(photos));
    localStorage.setItem(votedKey, "true");
    const totalLikes = this._bumpLocalLikes(voterPin);
    if (photo.authorPin) await this.creditUserPoints(photo.authorPin, 2);
    return { success: true, votes: photo.votes, totalGivenLikes: totalLikes };
  }

  _bumpLocalLikes(voterPin) {
    const totalLikes = parseInt(localStorage.getItem("peg_user_likes") || "0", 10) + 1;
    localStorage.setItem("peg_user_likes", totalLikes.toString());
    if (voterPin) localStorage.setItem(`peg_user_likes_${voterPin}`, totalLikes.toString());
    return totalLikes;
  }

  // ৫. ছবির ভিউ কাউন্ট বৃদ্ধি
  async incrementView(photoId) {
    const viewedKey = `viewed_${photoId}`;
    if (sessionStorage.getItem(viewedKey)) return;
    sessionStorage.setItem(viewedKey, "true");

    const res = await this.apiCall("view", { photoId });
    if (res) return;

    const photos = await this.getPhotos();
    const photo = photos.find(p => p.id === photoId);
    if (photo) {
      photo.views = (photo.views || 0) + 1;
      localStorage.setItem("peg_photos", JSON.stringify(photos));
    }
  }

  // ৬. ইউজার লগইন
  async loginUser(pin) {
    const res = await this.apiCall("login", { pin });
    if (res && res.data) {
      if (res.data.success && res.data.user) {
        this.saveUser(res.data.user);
        return { success: true, user: res.data.user };
      }
      return { success: false, message: res.data.message || "ভুল পিন! একাউন্ট না থাকলে রেজিস্ট্রেশন করুন।" };
    }

    const localUser = this.getUser(pin);
    if (localUser) return { success: true, user: localUser };
    return { success: false, message: "ভুল পিন! একাউন্ট না থাকলে রেজিস্ট্রেশন করুন।" };
  }

  // ৭. ইউজার রেজিস্ট্রেশন
  async registerUser(pin, name, phone, refCode) {
    const res = await this.apiCall("register", { pin, name, phone, ref: refCode || "" });
    if (res && res.data) {
      if (res.data.success && res.data.user) {
        this.saveUser(res.data.user);
        return { success: true, user: res.data.user };
      }
      return { success: false, message: res.data.message || "রেজিস্ট্রেশন সম্পন্ন হয়নি!" };
    }

    // অফলাইন লোকাল ফলব্যাক
    const existing = this.getUser(pin);
    if (existing && existing.pin) {
      return { success: false, message: "এই পিন নম্বরটি ইতিমধ্যে ব্যবহৃত হয়েছে! অন্য পিন দিন বা লগইন করুন।" };
    }
    const newUser = {
      pin,
      creatorId: `u_${pin}`,
      name,
      phone,
      points: 20,
      taka: "2.00",
      photosCount: 0,
      referralsCount: 0,
      verified: false,
      telegramBonus: false,
      refCode: "REF" + pin,
      referredBy: refCode || "",
      created: new Date().toISOString()
    };
    this.saveUser(newUser);
    const cleanRef = (refCode || "").trim().toUpperCase();
    const refPin = cleanRef.startsWith("REF") ? cleanRef.slice(3) : cleanRef;
    if (refPin && refPin !== pin) {
      await this.creditUserPoints(refPin, this.cfg.referralPointsPerUser || 10, { isReferral: true });
    }
    return { success: true, user: newUser };
  }

  // ৮. টেলিগ্রাম বোনাস ক্লেইম
  async claimTelegramBonus(pin) {
    const res = await this.apiCall("claim_telegram", { pin });
    if (res && res.data) {
      if (res.data.success && res.data.user) this.saveUser(res.data.user);
      return res.data;
    }

    const user = this.getUser(pin);
    if (!user) return { success: false, message: "প্রথমে একাউন্টে লগইন করুন!" };
    if (user.telegramBonus) return { success: false, message: "আপনি ইতিমধ্যে বোনাস পেয়েছেন!" };
    user.telegramBonus = true;
    user.taka = (parseFloat(user.taka || 0) + (this.cfg.telegramJoinBonusTaka || 10.0)).toFixed(2);
    user.points = Math.round(parseFloat(user.taka) / (this.cfg.takaPerPoint || 0.1));
    this.saveUser(user);
    return { success: true, message: `অভিনন্দন! ৳${this.cfg.telegramJoinBonusTaka || 10} বোনাস একাউন্টে যোগ হয়েছে!`, user };
  }

  // ৯. উইথড্র রিকোয়েস্ট
  async requestWithdraw(pin, phone, amountTaka, method) {
    const res = await this.apiCall("withdraw", { pin, phone, amount: amountTaka, method });
    if (res && res.data) {
      if (res.data.success) await this.fetchFirebaseUser(pin);
      return res.data;
    }

    const user = this.getUser(pin);
    if (!user) return { success: false, message: "ইউজার পাওয়া যায়নি!" };
    const minTaka = this.cfg.minWithdrawTaka || 50;
    const minPhotos = this.cfg.minPhotosForWithdraw || 3;
    if (parseFloat(user.taka) < amountTaka) return { success: false, message: "আপনার একাউন্টে পর্যাপ্ত ব্যালেন্স নেই!" };
    if (amountTaka < minTaka) return { success: false, message: `সর্বনিম্ন উইথড্র ৳${minTaka} হতে হবে!` };
    if ((user.photosCount || 0) < minPhotos) return { success: false, message: `টাকা তুলতে আপনার কমপক্ষে ${minPhotos}টি ছবি আপলোড থাকতে হবে!` };

    user.taka = (parseFloat(user.taka) - amountTaka).toFixed(2);
    user.points = Math.round(parseFloat(user.taka) / (this.cfg.takaPerPoint || 0.1));
    this.saveUser(user);
    const withdraws = JSON.parse(localStorage.getItem("peg_withdraws") || "[]");
    withdraws.unshift({ id: "wd_" + Date.now(), pin, name: user.name, phone, amount: amountTaka, method, status: "pending", date: new Date().toISOString() });
    localStorage.setItem("peg_withdraws", JSON.stringify(withdraws));
    return { success: true, message: "উইথড্র আবেদন সফল হয়েছে!" };
  }

  // ===== ১০. অ্যাডমিন সেশন ও সিকিউরিটি API =====
  async adminCheck() {
    const res = await this.apiCall("admin_check");
    if (res && res.data) return res.data;
    return { success: true, loggedIn: sessionStorage.getItem("peg_admin_auth") === "true", isDefaultPin: false, offline: true };
  }

  async adminLogin(pin) {
    const res = await this.apiCall("admin_login", { pin });
    if (res && res.data) return res.data;
    return { success: false, message: "সার্ভার কানেকশন পাওয়া যায়নি (PHP সার্ভার প্রয়োজন)!" };
  }

  async adminLogout() {
    sessionStorage.removeItem("peg_admin_auth");
    await this.apiCall("admin_logout", {});
  }

  async changeAdminPin(currentPin, newPin) {
    const res = await this.apiCall("change_admin_pin", { currentPin, newPin });
    if (res && res.data) return res.data;
    return { success: false, message: "সার্ভার কানেকশন পাওয়া যায়নি!" };
  }

  async importFromFirebase(firebaseUrl) {
    const res = await this.apiCall("import_firebase", { firebaseUrl });
    if (res && res.data) return res.data;
    return { success: false, message: "সার্ভার কানেকশন পাওয়া যায়নি!" };
  }

  async getWithdraws() {
    const res = await this.apiCall("get_withdraws");
    if (res && res.data) return res.data.withdraws || [];
    return JSON.parse(localStorage.getItem("peg_withdraws") || "[]");
  }

  async updateWithdrawStatus(id, newStatus) {
    const res = await this.apiCall("update_withdraw", { id, status: newStatus });
    if (res && res.data) return !!res.data.success;

    const withdraws = JSON.parse(localStorage.getItem("peg_withdraws") || "[]");
    const req = withdraws.find(w => w.id === id);
    if (req) {
      req.status = newStatus;
      localStorage.setItem("peg_withdraws", JSON.stringify(withdraws));
    }
    return true;
  }

  async deletePhoto(id) {
    const res = await this.apiCall("delete_photo", { id });
    if (res && res.data) return !!res.data.success;

    const photos = await this.getPhotos();
    localStorage.setItem("peg_photos", JSON.stringify(photos.filter(p => p.id !== id)));
    return true;
  }

  getUser(pin) {
    if (!pin) return null;
    const users = JSON.parse(localStorage.getItem("peg_users") || "{}");
    return users[pin] || null;
  }

  saveUser(userData) {
    if (!userData || !userData.pin) return;
    const users = JSON.parse(localStorage.getItem("peg_users") || "{}");
    users[userData.pin] = userData;
    localStorage.setItem("peg_users", JSON.stringify(users));
  }

  async fetchFirebaseUser(pin) {
    if (!pin) return null;
    const res = await this.apiCall("login", { pin });
    if (res && res.data && res.data.success && res.data.user) {
      this.saveUser(res.data.user);
      return res.data.user;
    }
    return this.getUser(pin);
  }

  async creditUserPoints(pin, addPoints, opts = {}) {
    const user = this.getUser(pin);
    if (!user) return null;
    const takaPerPoint = this.cfg.takaPerPoint || 0.1;
    const basePoints = user.points !== undefined ? (parseInt(user.points, 10) || 0) : Math.round(parseFloat(user.taka || 0) / takaPerPoint);
    user.points = Math.max(0, basePoints + (parseInt(addPoints, 10) || 0));
    user.taka = (user.points * takaPerPoint).toFixed(2);
    if (opts.isReferral) user.referralsCount = (user.referralsCount || 0) + 1;
    this.saveUser(user);
    return user;
  }

  async getAllUsers() {
    const res = await this.apiCall("get_all_users");
    if (res && res.data) return res.data.users || [];

    const localMap = JSON.parse(localStorage.getItem("peg_users") || "{}");
    return Object.values(localMap).filter(u => u && u.name).sort((a, b) => parseFloat(b.taka || 0) - parseFloat(a.taka || 0));
  }

  async adjustUserBalance(pin, deltaTaka, note = "") {
    const res = await this.apiCall("adjust_user_balance", { pin, deltaTaka, note });
    if (res && res.data) return res.data;

    const takaPerPoint = this.cfg.takaPerPoint || 0.1;
    const addPoints = Math.round((parseFloat(deltaTaka) || 0) / takaPerPoint);
    const updated = await this.creditUserPoints(pin, addPoints);
    if (!updated) return { success: false, message: "ইউজার পাওয়া যায়নি!" };
    return { success: true, user: updated };
  }

  // ১১. লাইভ পাবলিক চ্যাট
  async getChatMessages() {
    const res = await this.apiCall("get_chat");
    if (res && res.data && Array.isArray(res.data.messages)) return res.data.messages;
    return JSON.parse(localStorage.getItem("peg_chat") || "[]");
  }

  async sendChatMessage(text, authorName, authorPin, asAdmin = false) {
    const guestId = localStorage.getItem("peg_guest_chat_id") || ("g_" + Math.random().toString(36).slice(2, 10));
    localStorage.setItem("peg_guest_chat_id", guestId);

    const res = await this.apiCall("send_chat", {
      text: text.trim(),
      name: authorName || "অতিথি",
      pin: authorPin || "",
      guestId,
      asAdmin: !!asAdmin
    });
    if (res && res.data && res.data.message) return res.data.message;

    const newMsg = {
      id: "msg_" + Date.now(),
      text: text.trim(),
      name: asAdmin ? "অ্যাডমিন (Admin)" : (authorName || "অতিথি"),
      senderId: asAdmin ? "admin" : (authorPin ? `u_${authorPin}` : guestId),
      isAdmin: !!asAdmin,
      time: new Date().toISOString()
    };
    const local = JSON.parse(localStorage.getItem("peg_chat") || "[]");
    local.push(newMsg);
    if (local.length > 60) local.shift();
    localStorage.setItem("peg_chat", JSON.stringify(local));
    return newMsg;
  }

  async deleteChatMessage(msgId) {
    const res = await this.apiCall("delete_chat", { id: msgId });
    if (res && res.data) return res.data;
    const local = JSON.parse(localStorage.getItem("peg_chat") || "[]").filter(m => m.id !== msgId);
    localStorage.setItem("peg_chat", JSON.stringify(local));
    return { success: true };
  }

  async clearAllChat() {
    const res = await this.apiCall("clear_chat", {});
    if (res && res.data) return res.data;
    localStorage.removeItem("peg_chat");
    return { success: true };
  }

  // ১২. ফটো লাইক ও ফলো সিস্টেম
  async likePhoto(photoId) {
    const likedKey = `liked_${photoId}`;
    if (localStorage.getItem(likedKey)) {
      return { success: false, message: "আপনি ইতিমধ্যে এই ছবিতে লাইক দিয়েছেন!" };
    }

    const res = await this.apiCall("like_photo", { photoId });
    let likesCount = 0;
    if (res && res.data) {
      if (!res.data.success) return res.data;
      likesCount = res.data.likes;
    } else {
      const photos = await this.getPhotos();
      const photo = photos.find(p => p.id === photoId);
      if (!photo) return { success: false, message: "ছবি পাওয়া যায়নি!" };
      photo.likes = (photo.likes || 0) + 1;
      likesCount = photo.likes;
      localStorage.setItem("peg_photos", JSON.stringify(photos));
    }

    localStorage.setItem(likedKey, "true");
    const totalLikes = this._bumpLocalLikes(localStorage.getItem("peg_auth_pin") || "");
    const verifyEvery = this.cfg.likeVerifyEvery || 5;
    return {
      success: true,
      likes: likesCount,
      totalGivenLikes: totalLikes,
      needVerify: (totalLikes % verifyEvery === 0)
    };
  }

  async toggleFollowCreator(creatorId) {
    if (!creatorId) return { success: false, message: "ক্রিয়েটর তথ্য নেই" };
    const follows = JSON.parse(localStorage.getItem("peg_follows") || "[]");
    const idx = follows.indexOf(creatorId);
    let isFollowing = false;
    if (idx !== -1) {
      follows.splice(idx, 1);
    } else {
      follows.push(creatorId);
      isFollowing = true;
    }
    localStorage.setItem("peg_follows", JSON.stringify(follows));
    this.apiCall("follow_creator", { creatorId, delta: isFollowing ? 1 : -1 }).catch(() => {});
    return { success: true, isFollowing, totalFollowed: follows.length };
  }

  isFollowing(creatorId) {
    if (!creatorId) return false;
    const follows = JSON.parse(localStorage.getItem("peg_follows") || "[]");
    return follows.includes(creatorId);
  }

  getUploadQuota(pin) {
    const user = pin ? this.getUser(pin) : null;
    const needL = this.cfg.uploadNeedLikes || 30;
    const needF = this.cfg.uploadNeedFollows || 20;
    const pinLikes = pin ? parseInt(localStorage.getItem(`peg_user_likes_${pin}`) || "0", 10) : 0;
    const globalLikes = parseInt(localStorage.getItem("peg_user_likes") || "0", 10);
    const currentLikes = Math.max(pinLikes, globalLikes, (user && user.likesGiven) || 0);
    const follows = JSON.parse(localStorage.getItem("peg_follows") || "[]");
    return {
      ok: currentLikes >= needL && follows.length >= needF,
      likes: currentLikes,
      needLikes: needL,
      follows: follows.length,
      needFollows: needF
    };
  }

  getWithdrawBan() {
    try { return JSON.parse(localStorage.getItem("peg_wd_ban") || "{}"); } catch (e) { return {}; }
  }

  recordWrongWithdrawPin() {
    const ban = this.getWithdrawBan();
    ban.strikes = (ban.strikes || 0) + 1;
    if (ban.strikes >= (this.cfg.strikesToPermanent || 2)) ban.perm = true;
    else ban.until = Date.now() + (this.cfg.banHours || 24) * 3600 * 1000;
    localStorage.setItem("peg_wd_ban", JSON.stringify(ban));
    return ban;
  }

  // ১৩. অটো-অ্যাপ্রুভ সেটিংস ও নোটিফিকেশন
  async isAutoApproveEnabled() {
    const res = await this.apiCall("get_settings");
    if (res && res.data && typeof res.data.auto_approve === "boolean") {
      localStorage.setItem("peg_auto_approve", res.data.auto_approve ? "true" : "false");
      return res.data.auto_approve;
    }
    return localStorage.getItem("peg_auto_approve") === "true";
  }

  async setAutoApprove(enabled) {
    localStorage.setItem("peg_auto_approve", enabled ? "true" : "false");
    await this.apiCall("set_auto_approve", { enabled: !!enabled });
    return !!enabled;
  }

  async approvePhoto(photoId) {
    const res = await this.apiCall("approve_photo", { id: photoId });
    if (res && res.data) return res.data;

    const photos = await this.getPhotos();
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return { success: false, message: "ছবি পাওয়া যায়নি" };
    photo.approved = true;
    photo.status = "approved";
    localStorage.setItem("peg_photos", JSON.stringify(photos));
    return { success: true, photo };
  }

  async rejectPhoto(photoId, reason = "নীতিমালা পরিপন্থী বা অস্পষ্ট ছবি") {
    const res = await this.apiCall("reject_photo", { id: photoId, reason });
    if (res && res.data) return res.data;

    const photos = await this.getPhotos();
    localStorage.setItem("peg_photos", JSON.stringify(photos.filter(p => p.id !== photoId)));
    return { success: true };
  }

  async sendNotification(pin, notif) {
    if (!pin) return;
    const notifObj = {
      id: "nt_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      title: notif.title || "নতুন নোটিফিকেশন",
      message: notif.message || "",
      type: notif.type || "info",
      ts: notif.ts || Date.now()
    };
    const key = `peg_notifs_${pin}`;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) {}
    list.unshift(notifObj);
    localStorage.setItem(key, JSON.stringify(list.slice(0, 30)));
    return notifObj;
  }

  async sendBroadcastNotice(title, message) {
    const res = await this.apiCall("send_broadcast", { title, message });
    if (res && res.data) return res.data.notice || res.data;

    const notifObj = { id: "bc_" + Date.now(), title: title || "📢 সাইট নোটিশ", message, type: "broadcast", ts: Date.now() };
    let list = [];
    try { list = JSON.parse(localStorage.getItem("peg_notifs_broadcast") || "[]"); } catch (e) {}
    list.unshift(notifObj);
    localStorage.setItem("peg_notifs_broadcast", JSON.stringify(list.slice(0, 30)));
    return notifObj;
  }

  async getNotifications(pin) {
    const res = await this.apiCall("get_notifications", { pin: pin || "" });
    if (res && res.data && Array.isArray(res.data.notifications)) return res.data.notifications;

    let personalList = [], broadcastList = [];
    if (pin) {
      try { personalList = JSON.parse(localStorage.getItem(`peg_notifs_${pin}`) || "[]"); } catch (e) {}
    }
    try { broadcastList = JSON.parse(localStorage.getItem("peg_notifs_broadcast") || "[]"); } catch (e) {}
    return [...personalList, ...broadcastList].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 35);
  }
}

window.DB = new AppDB();
