/**
 * Photo Earn Gallery - Official Payment Receipt & Certificate Generator
 * Canvas-based Ultra High-Res Money Receipt / Payment Voucher Slip
 */
(function() {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

  const PaymentReceipt = {
    toBnNum(num) {
      return String(num).replace(/[0-9]/g, d => bnDigits[d]);
    },

    numToBnWords(amount) {
      const n = Math.floor(parseFloat(amount) || 0);
      if (n === 50) return "পঞ্চাশ টাকা মাত্র";
      if (n === 100) return "একশত টাকা মাত্র";
      if (n === 150) return "একশত পঞ্চাশ টাকা মাত্র";
      if (n === 200) return "দুইশত টাকা মাত্র";
      if (n === 300) return "তিনশত টাকা মাত্র";
      if (n === 500) return "পাঁচশত টাকা মাত্র";
      if (n === 1000) return "এক হাজার টাকা মাত্র";
      return `${this.toBnNum(n)} টাকা মাত্র`;
    },

    /**
     * Create high-res 1200x760 Canvas for the official payment receipt
     */
    async createReceiptCanvas(data) {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 760;
      const ctx = canvas.getContext("2d");

      const recipientName = data.name || "সম্মানিত গ্রাহক";
      const rawPhone = String(data.phone || "");
      const maskedPhone = rawPhone.length >= 8 ? (rawPhone.slice(0, 3) + "****" + rawPhone.slice(-4)) : "017****6809";
      const amountVal = parseFloat(data.amount || 100).toFixed(2);
      const amountBn = this.toBnNum(amountVal);
      const methodStr = String(data.method || "bkash").toUpperCase();
      const trxId = data.trxId || ("TRX" + Math.random().toString(36).substring(2, 10).toUpperCase());
      const issueDate = data.paidAt ? new Date(data.paidAt) : (data.date ? new Date(data.date) : new Date());
      const dateFormattedBn = issueDate.toLocaleDateString('bn-BD', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const siteUrl = data.siteUrl || window.location.origin;
      const refCode = data.refCode || "180202";
      const joinUrl = `${siteUrl}/?ref=${refCode}`;

      // 1. ব্যাকগ্রাউন্ড ক্লিন আইভরি গ্রেডিয়েন্ট
      const bgGrad = ctx.createLinearGradient(0, 0, 1200, 760);
      bgGrad.addColorStop(0, "#ffffff");
      bgGrad.addColorStop(0.5, "#fafaf9");
      bgGrad.addColorStop(1, "#f5f5f4");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1200, 760);

      // সূক্ষ্ম ওয়াটারমার্ক টেক্সচার
      ctx.save();
      ctx.fillStyle = "rgba(16, 185, 129, 0.035)";
      for (let i = 40; i < 1160; i += 50) {
        for (let j = 40; j < 720; j += 50) {
          ctx.beginPath();
          ctx.arc(i, j, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 2. রাজকীয় সিকিউরিটি ডাবল বর্ডার
      ctx.strokeStyle = "#059669";
      ctx.lineWidth = 12;
      ctx.strokeRect(20, 20, 1160, 720);

      ctx.strokeStyle = "#d4af37";
      ctx.lineWidth = 3;
      ctx.strokeRect(34, 34, 1132, 692);

      // কর্নার অলঙ্করণ
      const drawCorner = (x, y) => {
        ctx.fillStyle = "#d4af37";
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      };
      drawCorner(34, 34);
      drawCorner(1166, 34);
      drawCorner(34, 726);
      drawCorner(1166, 726);

      // 3. টপ হেডার — লোগো ও টাইটেল
      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous";
      logoImg.src = "images/logo-icon.png?v=6";
      await new Promise(resolve => {
        if (logoImg.complete && logoImg.naturalWidth > 0) return resolve(true);
        logoImg.onload = () => resolve(true);
        logoImg.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 500);
      });

      if (logoImg.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(95, 95, 38, 0, Math.PI * 2);
        ctx.fillStyle = "#ecfdf5";
        ctx.fill();
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.drawImage(logoImg, 63, 63, 64, 64);
        ctx.restore();
      }

      ctx.textAlign = "left";
      ctx.fillStyle = "#0f172a";
      ctx.font = "900 30px 'Outfit', 'Hind Siliguri', sans-serif";
      ctx.fillText("PHOTO EARN", 155, 82);

      ctx.fillStyle = "#059669";
      ctx.font = "bold 15px 'Hind Siliguri', sans-serif";
      ctx.fillText("অফিসিয়াল ক্যাশ মেমো ও পেমেন্ট রসিদ • OFFICIAL PAYMENT VOUCHER", 155, 108);

      ctx.fillStyle = "#64748b";
      ctx.font = "500 13px 'Hind Siliguri', sans-serif";
      ctx.fillText("ডিজিটাল ফটোগ্রাফি কনটেস্ট ও কনটেন্ট মনিটাইজেশন প্ল্যাটফর্ম", 155, 130);

      // রসিদ নং ব্যাজ
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(830, 58, 310, 76, 12);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = "right";
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 13px 'Outfit', monospace";
      ctx.fillText(`RECEIPT NO: PEG-${trxId.slice(0, 10)}`, 1120, 85);

      ctx.fillStyle = "#059669";
      ctx.font = "bold 13px 'Hind Siliguri', sans-serif";
      ctx.fillText("স্ট্যাটাস: ১০০% সফলভাবে পরিশোধিত ✓", 1120, 114);

      // হেডার ডিভাইডার লাইন
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(55, 155);
      ctx.lineTo(1145, 155);
      ctx.stroke();

      // 4. বড় পেমেন্ট কার্ড (হিরো সেকশন)
      const cardGrad = ctx.createLinearGradient(55, 175, 1145, 290);
      cardGrad.addColorStop(0, "#f0fdf4");
      cardGrad.addColorStop(1, "#ecfdf5");
      ctx.fillStyle = cardGrad;
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(55, 175, 1090, 120, 16);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.fillStyle = "#047857";
      ctx.font = "bold 14px 'Hind Siliguri', sans-serif";
      ctx.fillText("পরিশোধিত অর্থের পরিমাণ (TOTAL PAID AMOUNT):", 85, 215);

      ctx.font = "900 52px 'Hind Siliguri', 'Outfit', sans-serif";
      ctx.fillStyle = "#065f46";
      ctx.fillText(`৳${amountBn}`, 85, 272);

      ctx.font = "bold 16px 'Hind Siliguri', sans-serif";
      ctx.fillStyle = "#059669";
      const wordsBn = this.numToBnWords(data.amount);
      ctx.fillText(`(কথায়: ${wordsBn})`, 330, 266);

      // মেথড ব্যাজ
      ctx.fillStyle = methodStr === "BKASH" ? "#e2136e" : (methodStr === "NAGAD" ? "#f7941d" : "#4f46e5");
      ctx.beginPath();
      ctx.roundRect(880, 205, 235, 60, 12);
      ctx.fill();

      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 20px 'Outfit', sans-serif";
      ctx.fillText(methodStr, 997, 238);
      ctx.font = "bold 12px 'Hind Siliguri', sans-serif";
      ctx.fillText("সেন্ড মানি সম্পন্ন ✓", 997, 256);

      // 5. রসিদের বিস্তারিত টেবিল (ডিজিটাল স্লিপ গ্রিড)
      const tableTop = 320;
      const tableHeight = 270;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(55, tableTop, 760, tableHeight, 14);
      ctx.fill();
      ctx.stroke();

      const rows = [
        { label: "প্রাপকের নাম (Recipient)", val: recipientName, isBold: true },
        { label: "মোবাইল নম্বর (Phone)", val: maskedPhone, isMono: true },
        { label: "ট্রানজেকশন আইডি (TrxID)", val: trxId, isTrx: true },
        { label: "পরিশোধের তারিখ ও সময়", val: dateFormattedBn },
        { label: "আয়ের উৎস (Source)", val: "ফটো কনটেস্ট প্রাইজ ও রেফারাল বোনাস ক্যাশআউট" },
        { label: "পেমেন্ট স্ট্যাটাস", val: "100% Genuine Verified Cash Payout ✓", isGreen: true }
      ];

      const rowHeight = tableHeight / rows.length;
      rows.forEach((r, idx) => {
        const y = tableTop + (idx * rowHeight);

        if (idx > 0) {
          ctx.strokeStyle = "#f1f5f9";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(55, y);
          ctx.lineTo(815, y);
          ctx.stroke();
        }

        ctx.textAlign = "left";
        ctx.fillStyle = "#64748b";
        ctx.font = "600 14px 'Hind Siliguri', sans-serif";
        ctx.fillText(r.label + ":", 80, y + 28);

        if (r.isTrx) {
          ctx.fillStyle = "#0f172a";
          ctx.beginPath();
          ctx.roundRect(330, y + 8, 280, 30, 6);
          ctx.fill();

          ctx.fillStyle = "#38bdf8";
          ctx.font = "bold 16px 'Outfit', monospace";
          ctx.fillText(r.val, 345, y + 29);
        } else if (r.isGreen) {
          ctx.fillStyle = "#059669";
          ctx.font = "bold 14px 'Hind Siliguri', sans-serif";
          ctx.fillText(r.val, 330, y + 28);
        } else {
          ctx.fillStyle = "#0f172a";
          ctx.font = r.isBold ? "bold 16px 'Hind Siliguri', sans-serif" : "600 14px 'Hind Siliguri', sans-serif";
          ctx.fillText(r.val, 330, y + 28);
        }
      });

      // 6. গোল্ডেন ও এমারেল্ড সিকিউরিটি সিল
      const sealX = 985;
      const sealY = 445;

      ctx.save();
      ctx.strokeStyle = "#d4af37";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(sealX, sealY, 95, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(sealX, sealY, 86, 0, Math.PI * 2);
      ctx.fillStyle = "#059669";
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = "center";
      ctx.fillStyle = "#fef08a";
      ctx.font = "bold 13px 'Hind Siliguri', sans-serif";
      ctx.fillText("★ PHOTO EARN ★", sealX, sealY - 45);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 24px 'Hind Siliguri', sans-serif";
      ctx.fillText("পরিশোধিত", sealX, sealY - 12);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 22px 'Outfit', sans-serif";
      ctx.fillText("PAID", sealX, sealY + 14);

      ctx.fillStyle = "#fef08a";
      ctx.font = "bold 11px 'Hind Siliguri', sans-serif";
      ctx.fillText("১০০% ভেরিফাইড পেমেন্ট", sealX, sealY + 38);
      ctx.fillText("OFFICIAL SEAL", sealX, sealY + 54);
      ctx.restore();

      // ডিজিটাল স্বাক্ষর
      ctx.textAlign = "center";
      ctx.font = "italic bold 17px 'Hind Siliguri', cursive";
      ctx.fillStyle = "#0f172a";
      ctx.fillText("Accounts & Disbursement Wing", sealX, 580);
      ctx.font = "12px 'Hind Siliguri', sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("Photo Earn Bangladesh Panel", sealX, 600);

      // 7. বটম ফুটার বার (জয়েন লিংক ও ভাইরাল রেফার)
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.roundRect(55, 620, 1090, 85, 14);
      ctx.fill();

      ctx.textAlign = "left";
      ctx.fillStyle = "#fde047";
      ctx.font = "bold 16px 'Hind Siliguri', sans-serif";
      ctx.fillText("👉 আপনার তোলা সুন্দর ছবি আপলোড করে ও বন্ধুদের ভোটে জিতে নিন প্রতিদিন নগদ টাকা!", 85, 652);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "14px 'Hind Siliguri', sans-serif";
      ctx.fillText("ফ্রি রেজিস্ট্রেশন লিংক:", 85, 682);

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 15px 'Outfit', monospace";
      ctx.fillText(joinUrl, 230, 682);

      ctx.textAlign = "right";
      ctx.fillStyle = "#a7f3d0";
      ctx.font = "bold 14px 'Hind Siliguri', sans-serif";
      ctx.fillText("রেফার কোড: REF" + refCode, 1115, 668);

      return canvas;
    },

    /**
     * রসিদ ছবি ডাউনলোড
     */
    async downloadReceipt(data, customFilename) {
      const canvas = await this.createReceiptCanvas(data);
      const filename = customFilename || `PhotoEarn-Receipt-${data.trxId || Date.now()}.png`;
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    },

    /**
     * রসিদ ছবি সরাসরি ক্লিপবোর্ডে কপি করা (Ctrl+V দিয়ে চ্যাটে/ফেসবুকে পেস্ট করতে)
     */
    async copyReceiptImage(data) {
      const canvas = await this.createReceiptCanvas(data);
      return new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            await this.downloadReceipt(data);
            return resolve("downloaded");
          }
          try {
            if (navigator.clipboard && window.ClipboardItem) {
              await navigator.clipboard.write([
                new ClipboardItem({ "image/png": blob })
              ]);
              resolve("copied");
            } else {
              await this.downloadReceipt(data);
              resolve("downloaded");
            }
          } catch (err) {
            console.warn("Clipboard write failed, downloading instead:", err);
            await this.downloadReceipt(data);
            resolve("downloaded");
          }
        }, "image/png");
      });
    }
  };

  window.PaymentReceipt = PaymentReceipt;
})();

