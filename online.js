/**
 * =========================================================
 * 🎀 CỜ CARO - ONLINE SOCKET.IO MANAGER 🎀
 * =========================================================
 */

class OnlineManager {
  constructor() {
    this.socket = null;
    this.currentRoomId = null;
    this.mySymbol = null; // 'X' hoặc 'O'
    this.playerName = "";

    this.initSocket();
  }

  /**
   * Khởi tạo kết nối Socket.IO
   */
  initSocket() {
    if (typeof io === "undefined") {
      console.warn("Socket.IO client library chưa được tải.");
      return;
    }

    this.socket = io();

    // 1. Nhận sự kiện tạo phòng thành công
    this.socket.on("roomCreated", (data) => {
      this.currentRoomId = data.roomId;
      this.mySymbol = data.symbol;

      // Hiển thị khung chờ với mã phòng to rõ
      const displayCodeEl = document.getElementById("display-room-code");
      const waitingBoxEl = document.getElementById("created-room-box");
      const btnCreateEl = document.getElementById("btn-create-room");

      if (displayCodeEl) displayCodeEl.textContent = data.roomId;
      if (waitingBoxEl) waitingBoxEl.classList.remove("hidden");
      if (btnCreateEl) btnCreateEl.classList.add("hidden");

      window.mainApp.showToast(`🎀 Phòng đã tạo! Mã: ${data.roomId}`, "🌸");
    });

    // 2. Nhận sự kiện tham gia phòng thành công
    this.socket.on("roomJoined", (data) => {
      this.currentRoomId = data.roomId;
      this.mySymbol = data.symbol;
      window.mainApp.showToast("✨ Đã vào phòng thành công!", "💕");
    });

    // 3. Ván đấu bắt đầu (đủ 2 người)
    this.socket.on("gameStart", (state) => {
      window.mainApp.switchToScreen("game-screen");

      // Cập nhật cấu hình CaroGame
      window.caroGame.mode = "online";
      window.caroGame.mySymbol = this.mySymbol;

      // Cập nhật tên hiển thị
      const nameX = (state.players && state.players.X) ? state.players.X.name : "Người chơi X";
      const nameO = (state.players && state.players.O) ? state.players.O.name : "Người chơi O";
      document.getElementById("name-player-x").textContent = `${nameX} (X)`;
      document.getElementById("name-player-o").textContent = `${nameO} (O)`;
      document.getElementById("nav-mode-badge").textContent = `🌸 Phòng: ${this.currentRoomId}`;

      // Hiển thị badge mã phòng
      const roomTag = document.getElementById("game-room-tag");
      const roomCodeLabel = document.getElementById("game-room-code-label");
      if (roomTag && roomCodeLabel) {
        roomCodeLabel.textContent = this.currentRoomId;
        roomTag.classList.remove("hidden");
      }

      window.caroGame.syncOnlineState(state, this.mySymbol);
      window.mainApp.showToast(`✨ Bắt đầu! Bạn là quân ${this.mySymbol}`, "🎉");
    });

    // 4. Nhận cập nhật trạng thái bàn cờ
    this.socket.on("gameState", (state) => {
      window.caroGame.syncOnlineState(state, this.mySymbol);
    });

    // 5. Đối thủ gửi lời mời chơi lại
    this.socket.on("restartRequested", () => {
      window.mainApp.showRematchModal();
    });

    // 6. Đang chờ đối thủ đồng ý chơi lại
    this.socket.on("restartPending", () => {
      window.mainApp.showToast("Đã gửi lời mời chơi lại, đang chờ đối thủ... ⏳", "💌");
    });

    // 7. Cả hai đã đồng ý chơi lại
    this.socket.on("gameRestarted", () => {
      window.mainApp.hideAllModals();
      window.mainApp.showToast("🌸 Ván mới bắt đầu! Lượt X đánh trước 💕", "✨");
    });

    // 8. Đối thủ rời phòng
    this.socket.on("playerLeft", (data) => {
      window.mainApp.showToast(data.message || "🌸 Đối thủ đã rời phòng.", "🥺");
      window.caroGame.updateStatusBanner("🌸 Đối thủ đã rời phòng.");
      window.caroGame.gameStatus = "ended";
    });

    // 9. Lỗi từ Server
    this.socket.on("errorMessage", (msg) => {
      window.mainApp.showToast(msg, "❌");
    });

    // 10. Lỗi kết nối
    this.socket.on("connect_error", () => {
      window.mainApp.showToast("Mất kết nối tới máy chủ!", "⚠️");
    });
  }

  /**
   * Gửi yêu cầu tạo phòng mới
   */
  createRoom(playerName) {
    this.playerName = playerName;
    if (this.socket) {
      this.socket.emit("createRoom", { playerName });
    }
  }

  /**
   * Gửi yêu cầu vào phòng có sẵn
   */
  joinRoom(roomId, playerName) {
    this.playerName = playerName;
    if (this.socket) {
      this.socket.emit("joinRoom", {
        roomId: roomId.trim().toUpperCase(),
        playerName
      });
    }
  }

  /**
   * Gửi nước đi lên server
   */
  sendMove(row, col) {
    if (this.socket && this.currentRoomId) {
      this.socket.emit("makeMove", {
        roomId: this.currentRoomId,
        row,
        col
      });
    }
  }

  /**
   * Gửi yêu cầu chơi lại
   */
  requestRematch() {
    if (this.socket && this.currentRoomId) {
      this.socket.emit("restartGame", {
        roomId: this.currentRoomId
      });
    }
  }

  /**
   * Rời khỏi phòng hiện tại
   */
  leaveRoom() {
    if (this.socket && this.currentRoomId) {
      this.socket.emit("leaveRoom");
      this.currentRoomId = null;
      this.mySymbol = null;
    }
  }
}

// Khởi tạo OnlineManager toàn cục
window.onlineManager = new OnlineManager();
