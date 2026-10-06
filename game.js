/**
 * =========================================================
 * 🎀 CỜ CARO - GAME CONTROLLER (QUẢN LÝ BÀN CỜ & LUẬT) 🎀
 * =========================================================
 */

class CaroGame {
  constructor() {
    this.size = 15;
    this.board = [];
    this.mode = "ai"; // 'ai' hoặc 'online'
    this.aiDifficulty = "easy";
    this.currentTurn = "X";
    this.mySymbol = "X"; // Ký tự của người chơi hiện tại ('X' hoặc 'O')
    this.gameStatus = "playing"; // 'waiting' | 'playing' | 'ended'
    this.winner = null;
    this.winningLine = null;
    this.lastMove = null;
    this.isAiThinking = false;

    // Tham chiếu DOM
    this.boardEl = document.getElementById("caro-board");
    this.statusBannerEl = document.getElementById("game-status-banner");
    this.cardX = document.getElementById("player-card-x");
    this.cardO = document.getElementById("player-card-o");
    this.nameXEl = document.getElementById("name-player-x");
    this.nameOEl = document.getElementById("name-player-o");

    this.initBoardCells();
  }

  /**
   * Khởi tạo 225 ô cờ trong DOM
   */
  initBoardCells() {
    this.boardEl.innerHTML = "";
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.row = r;
        cell.dataset.col = c;
        cell.addEventListener("click", () => this.handleCellClick(r, c));
        this.boardEl.appendChild(cell);
      }
    }
  }

  /**
   * Bắt đầu một ván chơi mới với máy (AI)
   */
  startVsAIMode(difficulty = "medium") {
    this.mode = "ai";
    this.aiDifficulty = difficulty;
    this.mySymbol = "X";
    this.resetBoardState();

    // Cập nhật tên hiển thị
    this.nameXEl.textContent = "Bạn (X)";
    const diffNames = { easy: "Dễ", medium: "Thường", hard: "Khó" };
    this.nameOEl.textContent = `Máy (${diffNames[difficulty] || "AI"})`;
    document.getElementById("nav-mode-badge").textContent = `🎮 Với Máy (${diffNames[difficulty]})`;
    document.getElementById("game-room-tag").classList.add("hidden");

    this.updateUI();
  }

  /**
   * Đặt lại toàn bộ dữ liệu bàn cờ
   */
  resetBoardState() {
    this.board = Array.from({ length: this.size }, () => Array(this.size).fill(null));
    this.currentTurn = "X";
    this.gameStatus = "playing";
    this.winner = null;
    this.winningLine = null;
    this.lastMove = null;
    this.isAiThinking = false;
  }

  /**
   * Xử lý khi người dùng click vào một ô trên bàn cờ
   */
  handleCellClick(row, col) {
    if (this.gameStatus !== "playing") return;
    if (this.isAiThinking) return;

    // Nếu là online, kiểm tra xem có đúng lượt của mình không
    if (this.mode === "online") {
      if (this.currentTurn !== this.mySymbol) {
        window.mainApp.showToast("Chưa đến lượt của bạn! Vui lòng chờ đối thủ 💕", "⏳");
        return;
      }
      if (this.board[row][col] !== null) {
        window.mainApp.showToast("Ô này đã có quân cờ rồi!", "⚠️");
        return;
      }

      // Gửi nước đi lên server Socket.IO
      window.onlineManager.sendMove(row, col);
      return;
    }

    // Nếu là chế độ chơi với máy
    if (this.currentTurn !== this.mySymbol) return;
    if (this.board[row][col] !== null) return;

    // Người chơi thực hiện nước đi
    this.executeLocalMove(row, col, this.mySymbol);

    // Nếu game chưa kết thúc, tới lượt AI
    if (this.gameStatus === "playing" && this.currentTurn === "O") {
      this.triggerAIMove();
    }
  }

  /**
   * Thực hiện nước đi trên bàn cờ cục bộ (dành cho chế độ chơi với máy)
   */
  executeLocalMove(row, col, player) {
    this.board[row][col] = player;
    this.lastMove = { row, col, player };

    // Phát âm thanh đặt cờ
    window.soundManager.playSFX("click");

    // Kiểm tra chiến thắng
    const winResult = this.checkWin(this.board, row, col, player);
    if (winResult) {
      this.gameStatus = "ended";
      this.winner = player;
      this.winningLine = winResult;
      this.handleGameOver(player);
    } else if (this.isBoardFull()) {
      this.gameStatus = "ended";
      this.winner = "draw";
      this.handleGameOver("draw");
    } else {
      // Đổi lượt
      this.currentTurn = player === "X" ? "O" : "X";
    }

    this.updateUI();
  }

  /**
   * Kích hoạt AI suy nghĩ và đánh cờ
   */
  triggerAIMove() {
    this.isAiThinking = true;
    this.updateStatusBanner("🤔 Máy đang suy nghĩ...");

    // Thêm khoảng trễ tự nhiên (350ms - 550ms)
    const thinkingDelay = Math.floor(Math.random() * 200) + 350;

    setTimeout(() => {
      if (this.gameStatus !== "playing") {
        this.isAiThinking = false;
        return;
      }

      const aiMove = window.caroAI.getNextMove(this.board, "O", this.aiDifficulty);
      this.isAiThinking = false;

      if (aiMove) {
        this.executeLocalMove(aiMove.row, aiMove.col, "O");
      }
    }, thinkingDelay);
  }

  /**
   * Kiểm tra 5 quân liên tiếp từ vị trí mới đánh
   */
  checkWin(board, lastRow, lastCol, player) {
    const directions = [
      { dr: 0, dc: 1 },  // Ngang
      { dr: 1, dc: 0 },  // Dọc
      { dr: 1, dc: 1 },  // Chéo \
      { dr: 1, dc: -1 }  // Chéo /
    ];

    for (const { dr, dc } of directions) {
      const line = [[lastRow, lastCol]];

      // Chiều dương
      let r = lastRow + dr;
      let c = lastCol + dc;
      while (r >= 0 && r < this.size && c >= 0 && c < this.size && board[r][c] === player) {
        line.push([r, c]);
        r += dr;
        c += dc;
      }

      // Chiều âm
      r = lastRow - dr;
      c = lastCol - dc;
      while (r >= 0 && r < this.size && c >= 0 && c < this.size && board[r][c] === player) {
        line.unshift([r, c]);
        r -= dr;
        c -= dc;
      }

      if (line.length >= 5) {
        return line;
      }
    }
    return null;
  }

  /**
   * Kiểm tra bàn cờ đã đầy chưa
   */
  isBoardFull() {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.board[r][c] === null) return false;
      }
    }
    return true;
  }

  /**
   * Cập nhật toàn bộ giao diện bàn cờ & thanh trạng thái
   */
  updateUI() {
    // 1. Render từng ô trên bàn cờ
    const cells = this.boardEl.children;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const index = r * this.size + c;
        const cell = cells[index];
        const val = this.board[r][c];

        cell.className = "cell";
        cell.innerHTML = "";

        if (val === "X") {
          const span = document.createElement("span");
          span.className = "piece-x";
          span.textContent = "X";
          cell.appendChild(span);
        } else if (val === "O") {
          const span = document.createElement("span");
          span.className = "piece-o";
          span.textContent = "O";
          cell.appendChild(span);
        }

        // Highlight nước đi cuối cùng
        if (this.lastMove && this.lastMove.row === r && this.lastMove.col === c) {
          cell.classList.add("last-move");
        }

        // Highlight đường chiến thắng
        if (this.winningLine) {
          const isWinningCell = this.winningLine.some(([wr, wc]) => wr === r && wc === c);
          if (isWinningCell) {
            cell.classList.add("winning-cell");
          }
        }
      }
    }

    // 2. Cập nhật lượt đi của 2 thẻ người chơi
    if (this.currentTurn === "X") {
      this.cardX.classList.add("active-turn");
      this.cardO.classList.remove("active-turn");
    } else {
      this.cardO.classList.add("active-turn");
      this.cardX.classList.remove("active-turn");
    }

    // 3. Cập nhật banner trạng thái
    if (this.gameStatus === "playing" && !this.isAiThinking) {
      if (this.mode === "ai") {
        if (this.currentTurn === "X") {
          this.updateStatusBanner("🌸 Lượt của bạn (X) - Hãy chọn một nước đi xinh xắn!");
        } else {
          this.updateStatusBanner("🤔 Máy đang suy nghĩ...");
        }
      } else if (this.mode === "online") {
        if (this.currentTurn === this.mySymbol) {
          this.updateStatusBanner(`🌸 Đến lượt của bạn (${this.mySymbol})! Tự tin lên nào 💕`);
        } else {
          const oppSymbol = this.mySymbol === "X" ? "O" : "X";
          this.updateStatusBanner(`⏳ Đang chờ đối thủ (${oppSymbol}) suy nghĩ nước đi...`);
        }
      }
    }
  }

  /**
   * Cập nhật câu chữ thanh trạng thái
   */
  updateStatusBanner(text) {
    this.statusBannerEl.textContent = text;
  }

  /**
   * Xử lý kết thúc ván đấu
   */
  handleGameOver(winner) {
    const isWin = winner === this.mySymbol;
    const isDraw = winner === "draw";

    if (isWin) {
      window.soundManager.playSFX("win");
      window.mainApp.triggerConfetti();
      window.mainApp.showGameOverModal("🎉 BẠN ĐÃ CHIẾN THẮNG! 🎉", "Một chiến thắng vô cùng ngọt ngào và xứng đáng 💕", "🎉");
      this.updateStatusBanner(`🎉 Chúc mừng bạn (${winner}) đã giành chiến thắng xuất sắc!`);
    } else if (isDraw) {
      window.soundManager.playSFX("draw");
      window.mainApp.showGameOverModal("🤍 HÒA NHAU RỒI! 🤍", "Hai đối thủ ngang tài ngang sức! Làm một ván mới chứ? ✨", "🤍");
      this.updateStatusBanner("🤍 Ván đấu kết thúc với kết quả Hòa!");
    } else {
      window.soundManager.playSFX("lose");
      window.mainApp.showGameOverModal("😢 TIẾC QUÁ, BẠN ĐÃ THUA! 😢", "Đừng buồn nha, ván sau chắc chắn sẽ phục thù thành công! 🌸", "😢");
      this.updateStatusBanner(`😢 Người chơi (${winner}) đã giành chiến thắng!`);
    }
  }

  /**
   * Nhận cập nhật trạng thái từ Server Online
   */
  syncOnlineState(serverState, mySymbol) {
    const previousMove = this.lastMove;
    this.board = serverState.board;
    this.currentTurn = serverState.currentTurn;
    this.gameStatus = serverState.gameStatus;
    this.winner = serverState.winner;
    this.winningLine = serverState.winningLine;
    this.lastMove = serverState.lastMove;
    this.mySymbol = mySymbol;

    // Âm thanh đặt quân cờ nếu có nước đi mới
    if (this.lastMove && (!previousMove || previousMove.row !== this.lastMove.row || previousMove.col !== this.lastMove.col)) {
      window.soundManager.playSFX("click");
    }

    this.updateUI();

    // Nếu game vừa kết thúc
    if (this.gameStatus === "ended" && this.winner) {
      this.handleGameOver(this.winner);
    }
  }
}

// Khởi tạo Game Controller toàn cục
window.caroGame = new CaroGame();
