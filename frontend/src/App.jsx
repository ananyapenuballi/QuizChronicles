import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { codingTasks, runCodingTests } from "./codingTasks.js";

const API = "/api";

function getPlayerId() {
  let id = localStorage.getItem("quizchronicles_player_id");
  if (!id) {
    id = `p_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("quizchronicles_player_id", id);
  }
  return id;
}

function authHeaders() {
  const token = localStorage.getItem("quizchronicles_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function App() {
  const [view, setView] = useState("home");
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("quizchronicles_user") || "null"); } catch { return null; }
  });
  const [quizzes, setQuizzes] = useState([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch(`${API}/quizzes`).then((r) => r.json()).then(setQuizzes).catch(() => setQuizzes([]));
  }, []);

  function logout() {
    localStorage.removeItem("quizchronicles_token");
    localStorage.removeItem("quizchronicles_user");
    setUser(null);
    setView("home");
  }

  return (
    <div>
      <header>
        <h1>QuizChronicles</h1>
        <nav>
          <button className="secondary" onClick={() => setView("home")}>Home</button>
          <button className="secondary" onClick={() => setView("solo")}>Solo</button>
          <button className="secondary" onClick={() => setView("room")}>Multiplayer</button>
          <button className="secondary" onClick={() => setView("coding")}>Coding</button>
          <button className="secondary" onClick={() => setView("create")}>Create Quiz</button>
          {user ? (
            <>
              <span>Hi, {user.name}</span>
              <button className="secondary" onClick={logout}>Log out</button>
            </>
          ) : (
            <button onClick={() => setView("auth")}>Log in / Register</button>
          )}
        </nav>
      </header>
      <main>
        {notice && <p className="card">{notice}</p>}
        {view === "home" && (
          <div>
            <div className="card">
              <h2>Play quizzes, live or solo</h2>
              <p>Create a multiplayer room with a shareable code, play a quiz alone, or try a coding challenge in your browser. No code is sent to the server for coding challenges: tests run in your browser.</p>
              <p className="muted">To create a room or a custom quiz, log in first. Solo play and coding challenges do not require an account.</p>
            </div>
            <div className="grid">
              {quizzes.map((q) => (
                <div className="card" key={q.id}>
                  <h3>{q.title}</h3>
                  <p>{q.category} | {q.questions.length} questions</p>
                  <button onClick={() => setView("solo")}>Play solo</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {view === "auth" && <AuthForm onDone={(u) => { setUser(u); setView("home"); }} />}
        {view === "solo" && <SoloPlay quizzes={quizzes} />}
        {view === "room" && <RoomPlay user={user} quizzes={quizzes} goAuth={() => setView("auth")} />}
        {view === "coding" && <CodingPlay />}
        {view === "create" && <CreateQuiz user={user} goAuth={() => setView("auth")} onCreated={() => {
          fetch(`${API}/quizzes`).then((r) => r.json()).then(setQuizzes);
          setNotice("Custom quiz created. It now appears in the quiz list.");
          setView("home");
        }} />}
      </main>
    </div>
  );
}

function AuthForm({ onDone }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    const res = await fetch(`${API}/auth/${mode === "login" ? "login" : "register"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "login" ? { email, password } : { name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Something went wrong");
    localStorage.setItem("quizchronicles_token", data.token);
    localStorage.setItem("quizchronicles_user", JSON.stringify(data.user));
    onDone(data.user);
  }

  return (
    <div className="card">
      <h2>{mode === "login" ? "Log in" : "Register"}</h2>
      <form onSubmit={submit}>
        {mode === "register" && (<><label>Display name</label><input value={name} onChange={(e) => setName(e.target.value)} required /></>)}
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="error">{error}</p>}
        <button type="submit">{mode === "login" ? "Log in" : "Register"}</button>
        <button type="button" className="secondary" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          Switch to {mode === "login" ? "register" : "log in"}
        </button>
      </form>
    </div>
  );
}

function SoloPlay({ quizzes }) {
  const [quizId, setQuizId] = useState("");
  const [quiz, setQuiz] = useState(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(20);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  async function start() {
    setError("");
    const res = await fetch(`${API}/quizzes/${quizId}`);
    if (!res.ok) return setError("Quiz not found");
    const data = await res.json();
    setQuiz(data);
    setIndex(0);
    setAnswers([]);
    setSelected(null);
    setSecondsLeft(data.questions[0].timeLimit || 20);
    setSummary(null);
  }

  useEffect(() => {
    if (!quiz || summary) return;
    if (secondsLeft <= 0) { next(null); return; }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, quiz, index, summary]);

  async function finish(allAnswers) {
    const res = await fetch(`${API}/quizzes/${quiz.id}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: allAnswers }),
    });
    const data = await res.json();
    setSummary(data);
  }

  function next(choice) {
    const nextAnswers = [...answers, choice];
    setAnswers(nextAnswers);
    if (index + 1 < quiz.questions.length) {
      setIndex(index + 1);
      setSelected(null);
      setSecondsLeft(quiz.questions[index + 1].timeLimit || 20);
    } else {
      finish(nextAnswers);
    }
  }

  if (summary) {
    return (
      <div className="card">
        <h2>Solo result: {summary.score} out of {summary.total}</h2>
        {summary.results.map((r, i) => (
          <p key={i}><strong>Q{i + 1}:</strong> {r.question} <br />
            <span className={r.correct ? "success" : "error"}>{r.correct ? "Correct" : `Correct answer: ${r.options[r.correctAnswer]}`}</span>
          </p>
        ))}
        <button onClick={() => { setQuiz(null); setSummary(null); }}>Play another quiz</button>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="card">
        <h2>Solo mode</h2>
        <label>Choose a quiz</label>
        <select value={quizId} onChange={(e) => setQuizId(e.target.value)}>
          <option value="">Select a quiz</option>
          {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title} ({q.questions.length} questions)</option>)}
        </select>
        {error && <p className="error">{error}</p>}
        <button disabled={!quizId} onClick={start}>Start solo quiz</button>
      </div>
    );
  }

  const q = quiz.questions[index];
  return (
    <div className="card">
      <h2>{quiz.title}: Question {index + 1} of {quiz.questions.length}</h2>
      <p>Time left: {secondsLeft} seconds</p>
      <p><strong>{q.question}</strong></p>
      {q.options.map((opt, i) => (
        <button key={i} className={`option ${selected === i ? "selected" : ""}`} onClick={() => setSelected(i)}>{opt}</button>
      ))}
      <button onClick={() => next(selected)}>Next question</button>
      <p className="muted">If time runs out, the question is recorded as unanswered.</p>
    </div>
  );
}

function RoomPlay({ user, quizzes, goAuth }) {
  const [step, setStep] = useState("join");
  const [quizId, setQuizId] = useState("");
  const [elimination, setElimination] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState(user ? user.name : "");
  const [room, setRoom] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState("");
  const [answered, setAnswered] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => () => { if (socketRef.current) socketRef.current.disconnect(); }, []);

  async function createRoom() {
    setError("");
    const res = await fetch(`${API}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ quizId, elimination }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Could not create room");
    setCode(data.code);
    joinSocket(data.code);
  }

  function joinSocket(roomCode) {
    setError("");
    const socket = io(window.location.origin);
    socketRef.current = socket;
    socket.on("connect", () => {
      socket.emit("joinRoom", { code: roomCode, playerId: getPlayerId(), name: name || "Player", userId: user ? user.id : null });
    });
    socket.on("joined", (state) => { setRoom(state); setIsHost(state.isHost); setStep("room"); setAnswered(false); });
    socket.on("roomState", (state) => {
      setRoom(state);
      if (state.currentQuestion) setAnswered(false);
    });
    socket.on("joinError", (d) => setError(d.error));
    socket.on("gameFinished", () => setStep("room"));
  }

  function joinExisting(e) {
    e.preventDefault();
    if (!code || !name) return setError("Enter a room code and a display name");
    joinSocket(code.toUpperCase());
  }

  if (step === "join") {
    return (
      <div>
        <div className="card">
          <h2>Create a multiplayer room</h2>
          {!user && <p>Log in to create a room. <button onClick={goAuth}>Log in</button></p>}
          {user && (
            <>
              <label>Choose a quiz</label>
              <select value={quizId} onChange={(e) => setQuizId(e.target.value)}>
                <option value="">Select a quiz</option>
                {quizzes.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
              </select>
              <label><input type="checkbox" checked={elimination} onChange={(e) => setElimination(e.target.checked)} style={{ width: "auto" }} /> Elimination mode: a wrong answer eliminates a player</label>
              <br />
              <button disabled={!quizId} onClick={createRoom}>Create room</button>
            </>
          )}
        </div>
        <div className="card">
          <h2>Join a room</h2>
          <p className="muted">If you refresh during a game, join again with the same room code and display name. Your player id is stored in this browser, so your score is restored.</p>
          <form onSubmit={joinExisting}>
            <label>Room code</label>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" required />
            <label>Display name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
            <button type="submit">Join room</button>
          </form>
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }

  if (!room) return <div className="card"><p>Connecting to room...</p>{error && <p className="error">{error}</p>}</div>;

  const myPlayer = room.players.find((p) => p.playerId === getPlayerId());
  const allReady = room.players.length > 0 && room.players.every((p) => p.ready);

  return (
    <div>
      <div className="card">
        <h2>Room {room.code}: {room.quizTitle}</h2>
        <p>Share this code: <strong>{room.code}</strong> {room.elimination && <span className="badge">Elimination on</span>}</p>
        <p>Status: {room.state}</p>
        {error && <p className="error">{error}</p>}
        {room.state === "lobby" && (
          <>
            <button onClick={() => socketRef.current.emit("toggleReady")}>{myPlayer && myPlayer.ready ? "Mark not ready" : "Ready up"}</button>
            {isHost && <button disabled={!allReady} onClick={() => socketRef.current.emit("startGame")}>Start game</button>}
            {!allReady && <p className="muted">All players must be ready before the host can start.</p>}
          </>
        )}
      </div>
      <div className="grid">
        <div className="card">
          <h3>Leaderboard</h3>
          <table>
            <thead><tr><th>Player</th><th>Score</th><th>Status</th></tr></thead>
            <tbody>
              {room.players.map((p) => (
                <tr key={p.playerId}><td>{p.name}</td><td>{p.score}</td><td>{p.eliminated ? "Eliminated" : p.ready ? "Ready" : p.connected ? "Joined" : "Disconnected"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          {room.state === "playing" && room.currentQuestion && !myPlayer?.eliminated && (
            <>
              <h3>Question {room.currentQuestion.index + 1} of {room.currentQuestion.total}</h3>
              <p><strong>{room.currentQuestion.question}</strong></p>
              {answered && <p className="success">Answer submitted. Waiting for other players or the timer.</p>}
              {!answered && room.currentQuestion.options.map((opt, i) => (
                <button key={i} className="option" onClick={() => { socketRef.current.emit("submitAnswer", { answerIndex: i }); setAnswered(true); }}>{opt}</button>
              ))}
            </>
          )}
          {room.state === "playing" && myPlayer?.eliminated && <p>You were eliminated. You can watch the leaderboard until the game ends.</p>}
          {room.lastResult && (
            <>
              <h3>Last result</h3>
              <p>{room.lastResult.question}</p>
              <p>Correct answer: {room.lastResult.options[room.lastResult.correctAnswer]}</p>
              <ul>{room.lastResult.perPlayer.map((p) => <li key={p.playerId}>{p.name}: {p.correct ? `correct, +${p.gained}` : "incorrect"} (total {p.score})</li>)}</ul>
            </>
          )}
          {room.state === "finished" && <h3>Game finished. See the leaderboard for final scores.</h3>}
        </div>
      </div>
      <button className="secondary" onClick={() => { socketRef.current.disconnect(); setStep("join"); setRoom(null); }}>Leave room</button>
    </div>
  );
}

function CodingPlay() {
  const [taskId, setTaskId] = useState(codingTasks[0].id);
  const task = codingTasks.find((t) => t.id === taskId);
  const [code, setCode] = useState(task.starter);
  const [results, setResults] = useState(null);

  function select(id) {
    setTaskId(id);
    setCode(codingTasks.find((t) => t.id === id).starter);
    setResults(null);
  }

  return (
    <div className="card">
      <h2>Coding challenges</h2>
      <p className="muted">Tests run in your browser. Nothing is executed on the server.</p>
      <label>Choose a challenge</label>
      <select value={taskId} onChange={(e) => select(e.target.value)}>
        {codingTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
      </select>
      <p>{task.description}</p>
      <textarea className="code" value={code} onChange={(e) => setCode(e.target.value)} />
      <button onClick={() => setResults(runCodingTests(task, code))}>Run tests</button>
      <button className="secondary" onClick={() => { setCode(task.starter); setResults(null); }}>Reset starter code</button>
      {results && (
        <div>
          <h3>Results: {results.filter((r) => r.passed).length} of {results.length} passed</h3>
          <ul>
            {results.map((r, i) => (
              <li key={i} className={r.passed ? "success" : "error"}>
                {r.passed ? "Passed" : "Failed"}: input {JSON.stringify(r.input)}, expected {JSON.stringify(r.expected)}, got {JSON.stringify(r.got)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CreateQuiz({ user, goAuth, onCreated }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Custom");
  const [questions, setQuestions] = useState([{ question: "", options: ["", "", "", ""], answer: 0, timeLimit: 20 }]);
  const [error, setError] = useState("");

  function updateQuestion(i, field, value) {
    const next = [...questions];
    next[i] = { ...next[i], [field]: value };
    setQuestions(next);
  }

  function updateOption(qi, oi, value) {
    const next = [...questions];
    const options = [...next[qi].options];
    options[oi] = value;
    next[qi] = { ...next[qi], options };
    setQuestions(next);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    const res = await fetch(`${API}/quizzes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ title, category, questions }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || "Could not create quiz");
    onCreated();
  }

  if (!user) {
    return <div className="card"><h2>Create a custom quiz</h2><p>Log in to create a quiz.</p><button onClick={goAuth}>Log in</button></div>;
  }

  return (
    <div className="card">
      <h2>Create a custom quiz</h2>
      <form onSubmit={submit}>
        <label>Quiz title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        <label>Category</label>
        <input value={category} onChange={(e) => setCategory(e.target.value)} />
        {questions.map((q, qi) => (
          <div key={qi} className="card">
            <h3>Question {qi + 1}</h3>
            <input placeholder="Question text" value={q.question} onChange={(e) => updateQuestion(qi, "question", e.target.value)} required />
            {q.options.map((opt, oi) => (
              <div key={oi}>
                <label>Option {oi + 1} {q.answer === oi ? "(correct)" : ""}</label>
                <input value={opt} onChange={(e) => updateOption(qi, oi, e.target.value)} required />
              </div>
            ))}
            <label>Correct option</label>
            <select value={q.answer} onChange={(e) => updateQuestion(qi, "answer", Number(e.target.value))}>
              {q.options.map((_, oi) => <option key={oi} value={oi}>Option {oi + 1}</option>)}
            </select>
            <label>Time limit (seconds)</label>
            <input type="number" min="10" max="60" value={q.timeLimit} onChange={(e) => updateQuestion(qi, "timeLimit", Number(e.target.value))} />
            {questions.length > 1 && <button type="button" className="secondary" onClick={() => setQuestions(questions.filter((_, i) => i !== qi))}>Remove question</button>}
          </div>
        ))}
        <button type="button" className="secondary" onClick={() => setQuestions([...questions, { question: "", options: ["", "", "", ""], answer: 0, timeLimit: 20 }])}>Add question</button>
        {error && <p className="error">{error}</p>}
        <br /><button type="submit">Save quiz</button>
      </form>
    </div>
  );
}
