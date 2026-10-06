/**
 * =========================================================
 * 🎀 CỜ CARO - TRÍ TUỆ NHÂN TẠO (AI ENGINE) 🎀
 * =========================================================
 * Gồm 3 cấp độ:
 * 1. Dễ (Easy): Đánh ngẫu nhiên nhẹ nhàng
 * 2. Thường (Medium): Biết ăn điểm và chặn nước thắng cơ bản
 * 3. Khó (Hard): Heuristic Gomoku chuẩn xác, đánh giá thế trận 4 hướng
 */

class CaroAI {
  constructor(size = 15) {
    this.size = size;
  }

  /**
   * Tính toán nước đi tiếp theo của AI
   * @param {Array<Array<string|null>>} board - Bàn cờ 15x15 hiện tại
   * @param {string} aiPlayer - Ký tự của AI ('O' hoặc 'X')
   * @param {string} difficulty - Độ khó ('easy', 'medium', 'hard')
   * @returns {{ row: number, col: number }}
   */
  getNextMove(board, aiPlayer = "O", difficulty = "medium") {
    const humanPlayer = aiPlayer === "X" ? "O" : "X";
    const availableMoves = this.getAvailableMoves(board);

    // Nếu bàn cờ trống hoàn toàn, đánh vào ô trung tâm (7, 7)
    if (availableMoves.length === this.size * this.size) {
      const center = Math.floor(this.size / 2);
      return { row: center, col: center };
    }

    if (availableMoves.length === 0) return null;

    // Giới hạn các nước đi ứng viên trong phạm vi lân cận (radius 2) để tối ưu hiệu năng
    const candidateMoves = this.getCandidateMoves(board, 2);
    const movesToEvaluate = candidateMoves.length > 0 ? candidateMoves : availableMoves;

    switch (difficulty) {
      case "easy":
        return this.getMoveEasy(movesToEvaluate);

      case "medium":
        return this.getMoveMedium(board, movesToEvaluate, aiPlayer, humanPlayer);

      case "hard":
      default:
        return this.getMoveHard(board, movesToEvaluate, aiPlayer, humanPlayer);
    }
  }

  /**
   * Lấy tất cả các ô còn trống
   */
  getAvailableMoves(board) {
    const moves = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (board[r][c] === null) {
          moves.push({ row: r, col: c });
        }
      }
    }
    return moves;
  }

  /**
   * Lấy các ô trống xung quanh các quân cờ đã có trong bán kính radius
   * Giúp thuật toán chạy siêu tốc (< 20ms) mà không bỏ sót vị trí chiến lược
   */
  getCandidateMoves(board, radius = 2) {
    const visited = Array.from({ length: this.size }, () => Array(this.size).fill(false));
    const candidates = [];

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (board[r][c] !== null) {
          // Duyệt lân cận
          for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (
                nr >= 0 && nr < this.size &&
                nc >= 0 && nc < this.size &&
                board[nr][nc] === null &&
                !visited[nr][nc]
              ) {
                visited[nr][nc] = true;
                candidates.push({ row: nr, col: nc });
              }
            }
          }
        }
      }
    }
    return candidates;
  }

  /**
   * CẤP ĐỘ DỄ: Chọn ngẫu nhiên trong số các ô gần bàn đấu
   */
  getMoveEasy(candidates) {
    const index = Math.floor(Math.random() * candidates.length);
    return candidates[index];
  }

  /**
   * CẤP ĐỘ THƯỜNG:
   * 1. Ưu tiên thắng ngay nếu có (5 quân)
   * 2. Ưu tiên chặn người chơi nếu người chơi sắp thắng (4 hoặc 3 quân)
   * 3. Chọn nước đi có điểm heuristic cao nhất kèm yếu tố ngẫu nhiên nhẹ
   */
  getMoveMedium(board, candidates, aiPlayer, humanPlayer) {
    // 1. Kiểm tra AI có nước thắng ngay không
    for (const move of candidates) {
      if (this.checkImmediateWin(board, move.row, move.col, aiPlayer)) {
        return move;
      }
    }

    // 2. Kiểm tra chặn nước thắng của người chơi
    for (const move of candidates) {
      if (this.checkImmediateWin(board, move.row, move.col, humanPlayer)) {
        return move;
      }
    }

    // 3. Đánh giá heuristic cơ bản
    let bestScore = -Infinity;
    let bestMoves = [];

    for (const move of candidates) {
      const attackScore = this.evaluatePosition(board, move.row, move.col, aiPlayer);
      const defenseScore = this.evaluatePosition(board, move.row, move.col, humanPlayer);
      const totalScore = attackScore * 1.0 + defenseScore * 0.9;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestMoves = [move];
      } else if (totalScore === bestScore) {
        bestMoves.push(move);
      }
    }

    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  /**
   * CẤP ĐỘ KHÓ:
   * Thuật toán Heuristic Gomoku chuẩn mực:
   * - Phân tích mẫu: 5 liên tiếp, 4 mở (sống 4), 4 chặn (chết 4), 3 mở (sống 3), 3 chặn, 2 mở
   * - Trọng số phòng thủ cao để không để người chơi tạo thế đôi (nanh vuốt)
   * - Ưu tiên vị trí trung tâm bàn cờ
   */
  getMoveHard(board, candidates, aiPlayer, humanPlayer) {
    // 1. Nếu có nước thắng ngay cho AI -> Đánh ngay!
    for (const move of candidates) {
      if (this.checkImmediateWin(board, move.row, move.col, aiPlayer)) {
        return move;
      }
    }

    // 2. Nếu người chơi có nước thắng ngay -> Phải chặn ngay!
    for (const move of candidates) {
      if (this.checkImmediateWin(board, move.row, move.col, humanPlayer)) {
        return move;
      }
    }

    let bestScore = -Infinity;
    let bestMoves = [];

    for (const move of candidates) {
      const attackScore = this.evaluatePosition(board, move.row, move.col, aiPlayer);
      const defenseScore = this.evaluatePosition(board, move.row, move.col, humanPlayer);

      // Ưu tiên vị trí gần trung tâm bàn cờ
      const centerDist = Math.max(Math.abs(move.row - 7), Math.abs(move.col - 7));
      const centerBonus = (7 - centerDist) * 3;

      // Trọng số kết hợp: Công 1.1x, Thủ 1.15x (Phòng thủ rất nhạy bén với các mưu đồ của đối phương)
      const totalScore = (attackScore * 1.1) + (defenseScore * 1.15) + centerBonus;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestMoves = [move];
      } else if (Math.abs(totalScore - bestScore) < 0.001) {
        bestMoves.push(move);
      }
    }

    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  /**
   * Kiểm tra nhanh nếu đặt quân vào (row, col) có tạo thành 5 quân liên tiếp không
   */
  checkImmediateWin(board, row, col, player) {
    const directions = [
      [0, 1],   // Ngang
      [1, 0],   // Dọc
      [1, 1],   // Chéo \
      [1, -1]   // Chéo /
    ];

    for (const [dr, dc] of directions) {
      let count = 1;

      // Hướng thuận
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && r < this.size && c >= 0 && c < this.size && board[r][c] === player) {
        count++;
        r += dr;
        c += dc;
      }

      // Hướng nghịch
      r = row - dr;
      c = col - dc;
      while (r >= 0 && r < this.size && c >= 0 && c < this.size && board[r][c] === player) {
        count++;
        r -= dr;
        c -= dc;
      }

      if (count >= 5) return true;
    }
    return false;
  }

  /**
   * Đánh giá điểm chiến lược của một ô cờ cho một đấu thủ cụ thể
   */
  evaluatePosition(board, row, col, player) {
    const directions = [
      [0, 1],   // Ngang
      [1, 0],   // Dọc
      [1, 1],   // Chéo \
      [1, -1]   // Chéo /
    ];

    let totalScore = 0;

    for (const [dr, dc] of directions) {
      let count = 1;
      let openEnds = 0;

      // Quét chiều dương
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && r < this.size && c >= 0 && c < this.size && board[r][c] === player) {
        count++;
        r += dr;
        c += dc;
      }
      if (r >= 0 && r < this.size && c >= 0 && c < this.size && board[r][c] === null) {
        openEnds++;
      }

      // Quét chiều âm
      r = row - dr;
      c = col - dc;
      while (r >= 0 && r < this.size && c >= 0 && c < this.size && board[r][c] === player) {
        count++;
        r -= dr;
        c -= dc;
      }
      if (r >= 0 && r < this.size && c >= 0 && c < this.size && board[r][c] === null) {
        openEnds++;
      }

      // Bảng điểm chuẩn cờ Caro / Gomoku
      if (count >= 5) {
        totalScore += 100000; // Thắng tuyệt đối
      } else if (count === 4) {
        if (openEnds === 2) {
          totalScore += 12000; // Sống 4 (Chắc chắn thắng ở lượt sau)
        } else if (openEnds === 1) {
          totalScore += 2500;  // Chết 4
        }
      } else if (count === 3) {
        if (openEnds === 2) {
          totalScore += 2000;  // Sống 3 (Tạo thế gọng kìm)
        } else if (openEnds === 1) {
          totalScore += 400;   // Chết 3
        }
      } else if (count === 2) {
        if (openEnds === 2) {
          totalScore += 250;   // Sống 2
        } else if (openEnds === 1) {
          totalScore += 40;    // Chết 2
        }
      } else if (count === 1) {
        if (openEnds === 2) {
          totalScore += 10;
        }
      }
    }

    return totalScore;
  }
}

// Khởi tạo đối tượng CaroAI toàn cục
window.caroAI = new CaroAI(15);
