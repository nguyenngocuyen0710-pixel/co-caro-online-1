/**
 * =========================================================
 * 🎀 CỜ CARO - MAIN APPLICATION (ĐIỀU PHỐI GIAO DIỆN & SỰ KIỆN) 🎀
 * =========================================================
 */

class MainApp {
  constructor() {
    this.toastTimer = null;
    this.confettiAnimationId = null;

    this.initFloatingPetals();
    this.bindEvents();
  }

  /**
   * Tạo các họa tiết hoa đào và trái tim lơ lửng nền
   */
  initFloatingPetals() {
    const container = document.getElementById("floating-petals");
    if (!container) return;

    const icons = ["🌸", "🎀", "💕", "✨", "♡", "🌸", "🌷"];
    const totalPetals = 20;

    for (let i = 0; i < totalPetals; i++) {
      const petal = document.createElement("div");
      petal.className = "petal";
      petal.textContent = icons[Math.floor(Math.random() * icons.length)];
      petal.style.left = `${Math.random() * 98}%`;
      petal.style.animationDuration = `${8 + Math.random() * 8}s`;
      petal.style.animationDelay = `${Math.random() * 10}s`;
      petal.style.fontSize = `${1.1 + Math.random() * 0.9}rem`;
      container.appendChild(petal);
    }
  }

  /**
   * Đổi màn hình hiển thị
   */
  switchToScreen(screenId) {
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.remove("active");
    });
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add("active");
    }
  }

  /**
   * Gắn toàn bộ sự kiện click và điều khiển
   */
  bindEvents() {
    // 1. Âm thanh nhanh
    const btnBgm = document.getElementById("btn-toggle-bgm");
    const btnSfx = document.getElementById("btn-toggle-sfx");

    btnBgm.addEventListener("click", () => {
      const isEnabled = window.soundManager.toggleBGM();
      btnBgm.classList.toggle("muted", !isEnabled);
      btnBgm.querySelector(".icon").textContent = isEnabled ? "🎵" : "🔇";
      this.showToast(isEnabled ? "Đã bật nhạc nền 🎵" : "Đã tắt nhạc nền 🔇", "🎵");
    });

    btnSfx.addEventListener("click", () => {
      const isEnabled = window.soundManager.toggleSFX();
      btnSfx.classList.toggle("muted", !isEnabled);
      btnSfx.querySelector(".icon").textContent = isEnabled ? "🔔" : "🔕";
      this.showToast(isEnabled ? "Đã bật hiệu ứng 🔔" : "Đã tắt hiệu ứng 🔕", "🔔");
    });

    // 2. Nút menu chính
    document.getElementById("btn-mode-ai").addEventListener("click", () => {
      window.soundManager.playSFX("button");
      this.switchToScreen("difficulty-screen");
    });

    document.getElementById("btn-mode-online").addEventListener("click", () => {
      window.soundManager.playSFX("button");
      this.switchToScreen("online-lobby-screen");
    });

    document.getElementById("btn-open-rules").addEventListener("click", () => {
      window.soundManager.playSFX("button");
      this.openModal("modal-rules");
    });

    document.getElementById("btn-close-rules").addEventListener("click", () => {
      this.closeModal("modal-rules");
    });

    document.getElementById("btn-understood-rules").addEventListener("click", () => {
      window.soundManager.playSFX("button");
      this.closeModal("modal-rules");
    });

    // 3. Chọn độ khó AI
    document.querySelectorAll(".btn-diff").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        window.soundManager.playSFX("button");
        const level = btn.dataset.level || "medium";
        this.switchToScreen("game-screen");
        window.caroGame.startVsAIMode(level);
      });
    });

    document.getElementById("btn-back-from-diff").addEventListener("click", () => {
      window.soundManager.playSFX("button");
      this.switchToScreen("menu-screen");
    });

    // 4. Tab sảnh chờ Online
    const tabCreate = document.getElementById("tab-create");
    const tabJoin = document.getElementById("tab-join");
    const panelCreate = document.getElementById("panel-create");
    const panelJoin = document.getElementById("panel-join");

    tabCreate.addEventListener("click", () => {
      window.soundManager.playSFX("button");
      tabCreate.classList.add("active");
      tabJoin.classList.remove("active");
      panelCreate.classList.remove("hidden");
      panelJoin.classList.add("hidden");
    });

    tabJoin.addEventListener("click", () => {
      window.soundManager.playSFX("button");
      tabJoin.classList.add("active");
      tabCreate.classList.remove("active");
      panelJoin.classList.remove("hidden");
      panelCreate.classList.add("hidden");
    });

    document.getElementById("btn-back-from-lobby").addEventListener("click", () => {
      window.soundManager.playSFX("button");
      window.onlineManager.leaveRoom();
      this.resetLobbyUI();
      this.switchToScreen("menu-screen");
    });

    // 5. Tạo phòng Online
    document.getElementById("btn-create-room").addEventListener("click", () => {
      window.soundManager.playSFX("button");
      const nameInput = document.getElementById("create-player-name").value.trim() || "Người chơi X";
      window.onlineManager.createRoom(nameInput);
    });

    // 6. Sao chép mã phòng
    const copyRoomCode = () => {
      const code = window.onlineManager.currentRoomId;
      if (!code) return;
      navigator.clipboard.writeText(code).then(() => {
        this.showToast(`Đã sao chép mã phòng: ${code}`, "📋");
      }).catch(() => {
        // Fallback
        const dummy = document.createElement("input");
        document.body.appendChild(dummy);
        dummy.value = code;
        dummy.select();
        document.execCommand("copy");
        document.body.removeChild(dummy);
        this.showToast(`Đã sao chép mã phòng: ${code}`, "📋");
      });
    };

    document.getElementById("btn-copy-code").addEventListener("click", copyRoomCode);
    document.getElementById("btn-copy-game-code").addEventListener("click", copyRoomCode);

    // 7. Hủy phòng chờ
    document.getElementById("btn-cancel-room").addEventListener("click", () => {
      window.soundManager.playSFX("button");
      window.onlineManager.leaveRoom();
      this.resetLobbyUI();
      this.showToast("Đã hủy phòng tạo.", "ℹ️");
    });

    // 8. Vào phòng có sẵn
    document.getElementById("btn-join-room").addEventListener("click", () => {
      window.soundManager.playSFX("button");
      const nameInput = document.getElementById("join-player-name").value.trim() || "Người chơi O";
      const codeInput = document.getElementById("join-room-code").value.trim();

      if (!codeInput || codeInput.length < 4) {
        this.showToast("Vui lòng nhập đúng mã phòng!", "⚠️");
        return;
      }

      window.onlineManager.joinRoom(codeInput, nameInput);
    });

    // 9. Điều hướng trên màn hình Game
    document.getElementById("btn-nav-home").addEventListener("click", () => {
      window.soundManager.playSFX("button");
      if (window.caroGame.mode === "online") {
        window.onlineManager.leaveRoom();
      }
      this.hideAllModals();
      this.resetLobbyUI();
      this.switchToScreen("menu-screen");
    });

    document.getElementById("btn-nav-restart").addEventListener("click", () => {
      window.soundManager.playSFX("button");
      this.handleRematchAction();
    });

    // 10. Modal Game Over
    document.getElementById("btn-gameover-rematch").addEventListener("click", () => {
      window.soundManager.playSFX("button");
      this.closeModal("modal-gameover");
      this.handleRematchAction();
    });

    document.getElementById("btn-gameover-home").addEventListener("click", () => {
      window.soundManager.playSFX("button");
      this.closeModal("modal-gameover");
      if (window.caroGame.mode === "online") {
        window.onlineManager.leaveRoom();
      }
      this.resetLobbyUI();
      this.switchToScreen("menu-screen");
    });

    // 11. Modal Xác nhận chơi lại Online
    document.getElementById("btn-accept-rematch").addEventListener("click", () => {
      window.soundManager.playSFX("button");
      this.closeModal("modal-rematch-confirm");
      window.onlineManager.requestRematch();
    });

    document.getElementById("btn-decline-rematch").addEventListener("click", () => {
      window.soundManager.playSFX("button");
      this.closeModal("modal-rematch-confirm");
      this.showToast("Đã từ chối chơi lại.", "🥺");
    });
  }

  /**
   * Xử lý thao tác Chơi lại tùy theo chế độ
   */
  handleRematchAction() {
    if (window.caroGame.mode === "ai") {
      window.caroGame.startVsAIMode(window.caroGame.aiDifficulty);
      this.showToast("Ván mới đã sẵn sàng! 🌸", "✨");
    } else if (window.caroGame.mode === "online") {
      window.onlineManager.requestRematch();
    }
  }

  /**
   * Reset lại giao diện phần tạo phòng chờ
   */
  resetLobbyUI() {
    const waitingBox = document.getElementById("created-room-box");
    const btnCreate = document.getElementById("btn-create-room");
    if (waitingBox) waitingBox.classList.add("hidden");
    if (btnCreate) btnCreate.classList.remove("hidden");
    const joinCodeInput = document.getElementById("join-room-code");
    if (joinCodeInput) joinCodeInput.value = "";
  }

  /**
   * Mở modal
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove("hidden");
  }

  /**
   * Đóng modal
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add("hidden");
  }

  /**
   * Đóng tất cả modal
   */
  hideAllModals() {
    document.querySelectorAll(".modal-overlay").forEach((m) => m.classList.add("hidden"));
    this.stopConfetti();
  }

  /**
   * Hiển thị Modal Game Over
   */
  showGameOverModal(title, msg, emoji = "🎉") {
    document.getElementById("gameover-emoji").textContent = emoji;
    document.getElementById("gameover-title").textContent = title;
    document.getElementById("gameover-message").textContent = msg;
    this.openModal("modal-gameover");
  }

  /**
   * Hiển thị Modal hỏi Chơi Lại Online
   */
  showRematchModal() {
    this.openModal("modal-rematch-confirm");
  }

  /**
   * Hiển thị Toast thông báo nhanh
   */
  showToast(text, icon = "🌸") {
    const toast = document.getElementById("toast-notify");
    const toastIcon = document.getElementById("toast-icon");
    const toastText = document.getElementById("toast-text");

    if (!toast) return;

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    toastIcon.textContent = icon;
    toastText.textContent = text;
    toast.classList.remove("hidden");

    this.toastTimer = setTimeout(() => {
      toast.classList.add("hidden");
    }, 3200);
  }

  /**
   * Hiệu ứng pháo hoa giấy (Confetti) chúc mừng khi chiến thắng
   */
  triggerConfetti() {
    const canvas = document.getElementById("confetti-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ["#ff7597", "#ff4d6d", "#7b2cbf", "#ffd166", "#06d6a0", "#ffb703", "#e0aaff"];
    const count = 90;

    for (let i = 0; i < count; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        size: Math.random() * 8 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: Math.random() * 4 + 2,
        angle: Math.random() * 360,
        spin: Math.random() * 6 - 3
      });
    }

    let frames = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      pieces.forEach((p) => {
        p.y += p.speed;
        p.angle += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.angle * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();

        if (p.y > canvas.height) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }
      });

      frames++;
      if (frames < 240) {
        this.confettiAnimationId = requestAnimationFrame(render);
      } else {
        this.stopConfetti();
      }
    };

    render();
  }

  /**
   * Dừng hiệu ứng pháo hoa
   */
  stopConfetti() {
    if (this.confettiAnimationId) {
      cancelAnimationFrame(this.confettiAnimationId);
      this.confettiAnimationId = null;
    }
    const canvas = document.getElementById("confetti-canvas");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
}

// Khởi tạo ứng dụng sau khi DOM tải xong
document.addEventListener("DOMContentLoaded", () => {
  window.mainApp = new MainApp();
});
