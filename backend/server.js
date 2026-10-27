require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "quizchronicles-dev-secret-change-me";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

const io = new Server(server, {
  cors: { origin: FRONTEND_URL, methods: ["GET", "POST"] },
});

// ---------- JSON file store (no external database required) ----------
const DB_PATH = path.join(__dirname, "data", "db.json");

function seedQuizzes() {
  return [
    {
      id: "general-knowledge",
      title: "General Knowledge",
      category: "General Knowledge",
      questions: [
        { question: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], answer: 1, timeLimit: 20 },
        { question: "What is the capital of Japan?", options: ["Seoul", "Beijing", "Tokyo", "Bangkok"], answer: 2, timeLimit: 20 },
        { question: "How many continents are there on Earth?", options: ["5", "6", "7", "8"], answer: 2, timeLimit: 20 },
        { question: "Which ocean is the largest?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], answer: 3, timeLimit: 20 },
        { question: "Who wrote Romeo and Juliet?", options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"], answer: 1, timeLimit: 20 },
      ],
    },
    {
      id: "tech",
      title: "Tech Basics",
      category: "Technology",
      questions: [
        { question: "What does HTML stand for?", options: ["Hyper Text Markup Language", "High Tech Machine Language", "Hyperlink Text Mode Language", "Home Tool Markup Language"], answer: 0, timeLimit: 20 },
        { question: "Which language runs in a web browser?", options: ["Python", "C", "JavaScript", "Java"], answer: 2, timeLimit: 20 },
        { question: "What does CPU stand for?", options: ["Central Process Unit", "Central Processing Unit", "Computer Personal Unit", "Central Program Utility"], answer: 1, timeLimit: 20 },
        { question: "Which of these is a NoSQL database?", options: ["PostgreSQL", "MySQL", "MongoDB", "SQLite"], answer: 2, timeLimit: 20 },
        { question: "What does API stand for?", options: ["Application Programming Interface", "Advanced Program Integration", "Automated Process Interface", "Application Process Instruction"], answer: 0, timeLimit: 20 },
      ],
    },
  ];
}

function loadDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
      if (parsed && Array.isArray(parsed.quizzes) && Array.isArray(parsed.users)) return parsed;
    }
  } catch (err) {
    console.error("Could not read database file, starting fresh:", err.message);
  }
  const fresh = { users: [], quizzes: seedQuizzes() };
  saveDb(fresh);
  return fresh;
}

function saveDb(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

let db = loadDb();

function publicQuiz(quiz) {
  return {
    id: quiz.id,
    title: quiz.title,
    category: quiz.category,
    questions: quiz.questions.map((q) => ({
      question: q.question,
      options: q.options,
      timeLimit: q.timeLimit || 20,
    })),
  };
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Login required" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ---------- REST API ----------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", quizzes: db.quizzes.length, users: db.users.length });
});

app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "Name, email, and password are required" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  const existing = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
  if (existing) return res.status(400).json({ error: "An account with this email already exists" });
  const user = {
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
  };
  db.users.push(user);
  saveDb(db);
  res.status(201).json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email } });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  const user = db.users.find((u) => u.email.toLowerCase() === String(email || "").toLowerCase());
  if (!user || !bcrypt.compareSync(password || "", user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email } });
});

app.get("/api/quizzes", (req, res) => {
  res.json(db.quizzes.map(publicQuiz));
});

app.get("/api/quizzes/:id", (req, res) => {
  const quiz = db.quizzes.find((q) => q.id === req.params.id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });
  res.json(publicQuiz(quiz));
});

app.post("/api/quizzes/:id/check", (req, res) => {
  const quiz = db.quizzes.find((q) => q.id === req.params.id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  let score = 0;
  const results = quiz.questions.map((q, i) => {
    const correct = answers[i] === q.answer;
    if (correct) score += 1;
    return { question: q.question, yourAnswer: answers[i], correctAnswer: q.answer, options: q.options, correct };
  });
  res.json({ score, total: quiz.questions.length, results });
});

app.post("/api/quizzes", authMiddleware, (req, res) => {
  const { title, category, questions } = req.body || {};
  if (!title || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: "A title and at least one question are required" });
  }
  for (const q of questions) {
    if (!q.question || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4) {
      return res.status(400).json({ error: "Each question needs text and 2 to 4 options" });
    }
    if (typeof q.answer !== "number" || q.answer < 0 || q.answer >= q.options.length) {
      return res.status(400).json({ error: "Each question needs a valid correct answer index" });
    }
  }
  const quiz = {
    id: `custom_${Date.now()}`,
    title,
    category: category || "Custom",
    questions: questions.map((q) => ({
      question: q.question,
      options: q.options,
      answer: q.answer,
      timeLimit: Math.min(60, Math.max(10, Number(q.timeLimit) || 20)),
    })),
    createdBy: req.user.id,
  };
  db.quizzes.push(quiz);
  saveDb(db);
  res.status(201).json(publicQuiz(quiz));
});

// ---------- Real-time rooms (in-memory game state) ----------
const rooms = new Map();

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? makeCode() : code;
}

app.post("/api/rooms", authMiddleware, (req, res) => {
  const quiz = db.quizzes.find((q) => q.id === req.body.quizId);
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });
  const code = makeCode();
  const room = {
    code,
    quizId: quiz.id,
    quiz,
    elimination: Boolean(req.body.elimination),
    createdBy: req.user.id,
    state: "lobby",
    players: [],
    currentIndex: -1,
    questionEndsAt: null,
    timer: null,
    lastResult: null,
  };
  rooms.set(code, room);
  res.status(201).json({ code, quizId: quiz.id, quizTitle: quiz.title, elimination: room.elimination });
});

function leaderboard(room) {
  return [...room.players]
    .sort((a, b) => b.score - a.score)
    .map((p) => ({ playerId: p.playerId, name: p.name, score: p.score, eliminated: p.eliminated, ready: p.ready, connected: p.connected }));
}

function publicQuestion(room) {
  if (room.state !== "playing" || room.currentIndex < 0) return null;
  const q = room.quiz.questions[room.currentIndex];
  return {
    index: room.currentIndex,
    total: room.quiz.questions.length,
    question: q.question,
    options: q.options,
    timeLimit: q.timeLimit || 20,
    endsAt: room.questionEndsAt,
  };
}

function roomState(room) {
  return {
    code: room.code,
    quizTitle: room.quiz.title,
    elimination: room.elimination,
    state: room.state,
    players: leaderboard(room),
    hostUserId: room.createdBy,
    currentQuestion: publicQuestion(room),
    lastResult: room.lastResult,
  };
}

function broadcast(room) {
  io.to(room.code).emit("roomState", roomState(room));
}

function askQuestion(room) {
  room.currentIndex += 1;
  room.state = "playing";
  room.lastResult = null;
  const q = room.quiz.questions[room.currentIndex];
  const timeLimit = q.timeLimit || 20;
  room.questionEndsAt = Date.now() + timeLimit * 1000;
  room.players.forEach((p) => { p.answered = false; });
  broadcast(room);
  room.timer = setTimeout(() => finishQuestion(room), timeLimit * 1000);
}

function finishQuestion(room) {
  if (room.timer) { clearTimeout(room.timer); room.timer = null; }
  const q = room.quiz.questions[room.currentIndex];
  const timeLimit = q.timeLimit || 20;
  const perPlayer = room.players.map((p) => {
    const ans = p.answers ? p.answers[room.currentIndex] : undefined;
    let correct = false;
    let gained = 0;
    if (ans !== undefined && !p.eliminated) {
      correct = ans.answerIndex === q.answer;
      if (correct) {
        const elapsed = Math.max(0, Math.min(timeLimit, (ans.at - room.questionStartAt) / 1000));
        const remaining = Math.max(0, timeLimit - elapsed);
        gained = 100 + Math.round(50 * (remaining / timeLimit));
        p.score += gained;
      } else if (room.elimination) {
        p.eliminated = true;
      }
    }
    return { playerId: p.playerId, name: p.name, correct, gained, score: p.score, eliminated: p.eliminated };
  });
  room.lastResult = {
    index: room.currentIndex,
    correctAnswer: q.answer,
    options: q.options,
    question: q.question,
    perPlayer,
  };
  room.questionEndsAt = null;
  broadcast(room);
  setTimeout(() => {
    if (room.currentIndex + 1 < room.quiz.questions.length) {
      askQuestion(room);
    } else {
      room.state = "finished";
      broadcast(room);
      io.to(room.code).emit("gameFinished", { leaderboard: leaderboard(room) });
    }
  }, 3000);
}

io.on("connection", (socket) => {
  socket.on("joinRoom", ({ code, playerId, name, userId }) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room) return socket.emit("joinError", { error: "Room not found. Check the room code." });
    if (!playerId || !name) return socket.emit("joinError", { error: "A player id and a display name are required" });
    let player = room.players.find((p) => p.playerId === playerId);
    if (player) {
      // Session recovery: same player id reattaches to the same seat.
      player.socketId = socket.id;
      player.connected = true;
      player.name = name;
    } else {
      if (room.state !== "lobby") {
        return socket.emit("joinError", { error: "This game already started. Only existing players can rejoin." });
      }
      player = { playerId, name, socketId: socket.id, connected: true, ready: false, score: 0, eliminated: false, answers: {}, userId: userId || null };
      room.players.push(player);
      if (userId && userId === room.createdBy) room.hostPlayerId = playerId;
    }
    if (userId && userId === room.createdBy) room.hostPlayerId = playerId;
    socket.join(room.code);
    socket.data.roomCode = room.code;
    socket.data.playerId = playerId;
    socket.emit("joined", { ...roomState(room), playerId, isHost: room.hostPlayerId === playerId || (userId && userId === room.createdBy) });
    broadcast(room);
  });

  socket.on("toggleReady", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.state !== "lobby") return;
    const player = room.players.find((p) => p.playerId === socket.data.playerId);
    if (!player) return;
    player.ready = !player.ready;
    broadcast(room);
  });

  socket.on("startGame", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.state !== "lobby") return;
    const isHost = room.hostPlayerId === socket.data.playerId;
    if (!isHost) return socket.emit("joinError", { error: "Only the host can start the game" });
    if (room.players.length === 0) return;
    if (!room.players.every((p) => p.ready)) {
      return socket.emit("joinError", { error: "All players must be ready before the host starts the game" });
    }
    room.questionStartAt = Date.now();
    askQuestion(room);
    // askQuestion resets questionStartAt per question below via wrapper:
    room.questionStartAt = room.questionEndsAt - (room.quiz.questions[room.currentIndex].timeLimit || 20) * 1000;
  });

  socket.on("submitAnswer", ({ answerIndex }) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.state !== "playing") return;
    const player = room.players.find((p) => p.playerId === socket.data.playerId);
    if (!player || player.eliminated || player.answered) return;
    player.answered = true;
    player.answers[room.currentIndex] = { answerIndex, at: Date.now() };
    const active = room.players.filter((p) => !p.eliminated);
    if (active.length > 0 && active.every((p) => p.answered)) {
      finishQuestion(room);
    } else {
      broadcast(room);
    }
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const player = room.players.find((p) => p.playerId === socket.data.playerId);
    if (player) {
      player.connected = false;
      broadcast(room);
    }
  });
});

// Patch askQuestion start time tracking: wrap the original by recording on each call.
// The function above sets questionStartAt in startGame only for the first question;
// record it here by intercepting broadcast of a new question is not needed because
// finishQuestion uses room.questionStartAt, which we keep in sync in askQuestion
// through the assignment below.
const originalAsk = askQuestion;
askQuestion = function (room) {
  originalAsk(room);
  room.questionStartAt = room.questionEndsAt - (room.quiz.questions[room.currentIndex].timeLimit || 20) * 1000;
};

app.use((req, res) => res.status(404).json({ error: "Not found" }));

server.listen(PORT, () => {
  console.log(`QuizChronicles backend listening on http://localhost:${PORT}`);
});
