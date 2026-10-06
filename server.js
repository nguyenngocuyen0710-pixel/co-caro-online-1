const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const BOARD_SIZE = 15;
const WIN_COUNT = 5;

// Phục vụ thư mục static public
app.use(express.static(path.join(__dirname, "public")));

// Quản lý rooms trong memory
// Map: roomId -> Room Object
const rooms = new Map();
// Map: socketId -> roomId (để tra cứu nhanh khi disconnect)
const socketToRoom = new Map();

/**
 * Sinh mã phòng ngẫu nhiên 6 ký tự (chữ hoa và số)
 */
function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Bỏ I, O, 0, 1 để tránh nhầm lẫn
  let roomId = "";
  do {
    roomId = "";
    for (let i = 0; i < 6; i++) {
      roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms.has(roomId));
  return roomId;
}

/**
 * Khởi tạo bàn cờ trống 15x15
 */
function createEmptyBoard() {
  const board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    board.push(new Array(BOARD_SIZE).fill(null));
  }
  return board;
}

/**
 * Kiểm tra chiến thắng 5 quân liên tiếp từ nước đi mới nhất
 */
function checkWin(board, lastRow, lastCol, player) {
  if (lastRow === undefined || lastCol === undefined || !player) return null;

  const directions = [
    { dr: 0, dc: 1 },  // Ngang
    { dr: 1, dc: 0 },  // Dọc
    { dr: 1, dc: 1 },  // Chéo xuống (\)
    { dr: 1, dc: -1 }  // Chéo lên (/)
  ];

  for (const { dr, dc } of directions) {
    const line = [[lastRow, lastCol]];

    // Quét theo chiều dương
    let r = lastRow + dr;
    let c = lastCol + dc;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
      line.push([r, c]);
      r += dr;
      c += dc;
    }

    // Quét theo chiều âm
    r = lastRow - dr;
    c = lastCol - dc;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
      line.unshift([r, c]);
      r -= dr;
      c -= dc;
    }

    if (line.length >= WIN_COUNT) {
      return line; // Trả về danh sách toạ độ các ô chiến thắng
    }
  }

  return null;
}

/**
 * Kiểm tra bàn cờ đã đầy chưa (hòa)
 */
function isBoardFull(board) {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === null) return false;
    }
  }
  return true;
}

/**
 * Đóng gói trạng thái game để gửi về client
 */
function getSanitizedGameState(room) {
  return {
    roomId: room.roomId,
    board: room.board,
    currentTurn: room.currentTurn,
    gameStatus: room.gameStatus,
    winner: room.winner,
    winningLine: room.winningLine,
    lastMove: room.lastMove,
    players: {
      X: room.players.X ? { id: room.players.X.id, name: room.players.X.name } : null,
      O: room.players.O ? { id: room.players.O.id, name: room.players.O.name } : null
    },
    restartRequests: Array.from(room.restartRequests || [])
  };
}

// Xử lý kết nối Socket.IO
io.on("connection", (socket) => {
  console.log(`[Socket] Kết nối mới: ${socket.id}`);

  // 1. Tạo phòng
  socket.on("createRoom", (data) => {
    // Nếu socket đã ở trong phòng khác, rời phòng cũ trước
    const oldRoomId = socketToRoom.get(socket.id);
    if (oldRoomId && rooms.has(oldRoomId)) {
      handlePlayerLeave(socket);
    }

    const roomId = generateRoomId();
    const playerName = (data && data.playerName && typeof data.playerName === 'string') 
      ? data.playerName.trim().slice(0, 20) 
      : "Người chơi 1";

    const newRoom = {
      roomId,
      players: {
        X: { id: socket.id, name: playerName },
        O: null
      },
      board: createEmptyBoard(),
      currentTurn: "X",
      gameStatus: "waiting", // 'waiting' | 'playing' | 'ended'
      winner: null,
      winningLine: null,
      lastMove: null,
      restartRequests: new Set()
    };

    rooms.set(roomId, newRoom);
    socketToRoom.set(socket.id, roomId);
    socket.join(roomId);

    console.log(`[Room] Phòng ${roomId} đã được tạo bởi ${socket.id} (X)`);

    socket.emit("roomCreated", {
      roomId,
      symbol: "X",
      state: getSanitizedGameState(newRoom)
    });
  });

  // 2. Tham gia phòng
  socket.on("joinRoom", (data) => {
    if (!data || !data.roomId || typeof data.roomId !== "string") {
      return socket.emit("errorMessage", "Mã phòng không hợp lệ!");
    }

    const rawRoomId = data.roomId.trim().toUpperCase();
    const room = rooms.get(rawRoomId);

    if (!room) {
      return socket.emit("errorMessage", "Không tìm thấy phòng với mã này!");
    }

    if (room.players.O !== null) {
      return socket.emit("errorMessage", "Phòng này đã đủ 2 người chơi!");
    }

    if (room.players.X && room.players.X.id === socket.id) {
      return socket.emit("errorMessage", "Bạn đã ở trong phòng này!");
    }

    // Gán người chơi thứ 2 làm O
    const playerName = (data.playerName && typeof data.playerName === 'string') 
      ? data.playerName.trim().slice(0, 20) 
      : "Người chơi 2";

    room.players.O = { id: socket.id, name: playerName };
    room.gameStatus = "playing";
    socketToRoom.set(socket.id, rawRoomId);
    socket.join(rawRoomId);

    console.log(`[Room] Người chơi ${socket.id} (O) đã tham gia phòng ${rawRoomId}`);

    // Gửi thông báo cho người tham gia
    socket.emit("roomJoined", {
      roomId: rawRoomId,
      symbol: "O",
      state: getSanitizedGameState(room)
    });

    // Thông báo cho toàn bộ phòng rằng ván đấu bắt đầu
    io.to(rawRoomId).emit("gameStart", getSanitizedGameState(room));
  });

  // 3. Đánh cờ
  socket.on("makeMove", (data) => {
    if (!data || typeof data.row !== "number" || typeof data.col !== "number") {
      return socket.emit("errorMessage", "Dữ liệu nước đi không hợp lệ!");
    }

    const { roomId, row, col } = data;
    const room = rooms.get(roomId);

    if (!room) {
      return socket.emit("errorMessage", "Phòng không tồn tại!");
    }

    if (room.gameStatus !== "playing") {
      return socket.emit("errorMessage", "Trò chơi chưa bắt đầu hoặc đã kết thúc!");
    }

    // Xác định vai trò của người chơi
    let playerSymbol = null;
    if (room.players.X && room.players.X.id === socket.id) {
      playerSymbol = "X";
    } else if (room.players.O && room.players.O.id === socket.id) {
      playerSymbol = "O";
    }

    if (!playerSymbol) {
      return socket.emit("errorMessage", "Bạn không thuộc phòng chơi này!");
    }

    // Kiểm tra lượt đi
    if (room.currentTurn !== playerSymbol) {
      return socket.emit("errorMessage", "Chưa đến lượt của bạn!");
    }

    // Kiểm tra tọa độ hợp lệ
    if (
      !Number.isInteger(row) || 
      !Number.isInteger(col) || 
      row < 0 || 
      row >= BOARD_SIZE || 
      col < 0 || 
      col >= BOARD_SIZE
    ) {
      return socket.emit("errorMessage", "Tọa độ nước đi vượt ngoài bàn cờ!");
    }

    // Kiểm tra ô trống
    if (room.board[row][col] !== null) {
      return socket.emit("errorMessage", "Ô này đã có quân cờ!");
    }

    // Thực hiện nước đi
    room.board[row][col] = playerSymbol;
    room.lastMove = { row, col, player: playerSymbol };

    // Kiểm tra thắng
    const winningLine = checkWin(room.board, row, col, playerSymbol);

    if (winningLine) {
      room.gameStatus = "ended";
      room.winner = playerSymbol;
      room.winningLine = winningLine;
      console.log(`[Game] Phòng ${roomId}: ${playerSymbol} chiến thắng!`);
    } else if (isBoardFull(room.board)) {
      room.gameStatus = "ended";
      room.winner = "draw";
      room.winningLine = null;
      console.log(`[Game] Phòng ${roomId}: Hòa!`);
    } else {
      // Đổi lượt
      room.currentTurn = playerSymbol === "X" ? "O" : "X";
    }

    // Reset restart requests khi có nước đi
    room.restartRequests.clear();

    // Broadcast trạng thái mới
    io.to(roomId).emit("gameState", getSanitizedGameState(room));
  });

  // 4. Yêu cầu chơi lại (Rematch)
  socket.on("restartGame", (data) => {
    const roomId = data ? data.roomId : socketToRoom.get(socket.id);
    const room = rooms.get(roomId);

    if (!room) {
      return socket.emit("errorMessage", "Phòng không tồn tại!");
    }

    if (!room.players.X || !room.players.O) {
      return socket.emit("errorMessage", "Chưa đủ người chơi để chơi lại!");
    }

    // Thêm socket vào danh sách muốn chơi lại
    room.restartRequests.add(socket.id);

    // Nếu cả hai người chơi đều đồng ý chơi lại
    if (room.restartRequests.has(room.players.X.id) && room.restartRequests.has(room.players.O.id)) {
      room.board = createEmptyBoard();
      room.currentTurn = "X";
      room.gameStatus = "playing";
      room.winner = null;
      room.winningLine = null;
      room.lastMove = null;
      room.restartRequests.clear();

      console.log(`[Game] Phòng ${roomId}: Cả hai đã đồng ý chơi lại!`);
      io.to(roomId).emit("gameState", getSanitizedGameState(room));
      io.to(roomId).emit("gameRestarted");
    } else {
      // Thông báo cho người chơi còn lại biết đối thủ muốn chơi lại
      const opponentId = (socket.id === room.players.X.id) ? room.players.O.id : room.players.X.id;
      io.to(opponentId).emit("restartRequested", {
        requestedBy: socket.id === room.players.X.id ? "X" : "O"
      });
      socket.emit("restartPending");
    }
  });

  // 5. Rời phòng chủ động
  socket.on("leaveRoom", () => {
    handlePlayerLeave(socket);
  });

  // 6. Xử lý disconnect
  socket.on("disconnect", () => {
    console.log(`[Socket] Mất kết nối: ${socket.id}`);
    handlePlayerLeave(socket);
  });
});

/**
 * Xử lý khi một người chơi thoát phòng hoặc disconnect
 */
function handlePlayerLeave(socket) {
  const roomId = socketToRoom.get(socket.id);
  if (!roomId) return;

  socketToRoom.delete(socket.id);
  const room = rooms.get(roomId);
  if (!room) return;

  const isX = room.players.X && room.players.X.id === socket.id;
  const isO = room.players.O && room.players.O.id === socket.id;

  if (isX || isO) {
    const remainingPlayer = isX ? room.players.O : room.players.X;

    // Báo cho người còn lại
    socket.to(roomId).emit("playerLeft", {
      message: "🌸 Đối thủ đã rời phòng.",
      leaver: isX ? "X" : "O"
    });

    // Giải phóng room
    rooms.delete(roomId);
    console.log(`[Room] Phòng ${roomId} đã được giải phóng do người chơi rời.`);
  }

  socket.leave(roomId);
}

server.listen(PORT, () => {
  console.log(`🌸 Server Cờ caro đang chạy tại http://localhost:${PORT}`);
});
