# QuizChronicles

A real-time multiplayer quiz platform with solo play and browser-based coding challenges.

## Features

- Accounts: register and log in with a hashed password and a JWT session.
- Multiplayer rooms: create a room with a shareable 6 character code, join by code, ready up, and let the host start the game.
- Timed questions: each question has a time limit. Answering early moves the game on once every active player has answered.
- Live scoring and leaderboard: correct answers earn 100 points plus a speed bonus of up to 50 points. Scores and the leaderboard update after every question.
- Elimination option: when enabled at room creation, a wrong answer eliminates that player for the rest of the game.
- Session recovery: if a player refreshes during a game, joining again with the same room code and display name restores the same seat and score, because the player id is stored in that browser.
- Solo mode: play any quiz alone with timed questions and a final score summary.
- Coding challenges: solve JavaScript function tasks in the browser editor. Tests run in the browser only, and no code is sent to the server for execution. Challenges include summing an array, reversing a string, and checking a palindrome.
- Seeded quizzes: General Knowledge and Tech Basics are included, so the app works on first run.
- Custom quizzes: a logged-in user can create a quiz with custom questions, options, correct answers, and time limits.
- Storage: quizzes and users are stored in a JSON file, so no external database is needed to run it. The code is structured so that file store can be replaced with MongoDB later.

## Project structure

```
quizchronicles/
  backend/
    server.js
    package.json
    .env.example
    data/db.json (created on first run, ignored by git)
  frontend/
    src/
      App.jsx
      codingTasks.js
      main.jsx
      styles.css
    vite.config.js
    package.json
  README.md
```

## Prerequisites

- Node.js 18 or later
- npm

## Install

Run these commands from the project root, in two terminals or in order:

```bash
cd backend
npm install
```

```bash
cd frontend
npm install
```

## Configure

Backend configuration lives in `backend/.env.example`. Copy it to `backend/.env` and change the secret before real use:

```bash
cd backend
cp .env.example .env
```

Settings:

- `PORT`: backend port, default 5000.
- `JWT_SECRET`: secret used to sign login tokens. Use a long random value.
- `FRONTEND_URL`: frontend origin allowed by CORS, default http://localhost:5173.

Do not put a real secret in `.env.example`. That file contains only a placeholder.

## Run

Terminal 1, backend:

```bash
cd backend
npm run dev
```

The backend listens on http://localhost:5000. Check it with:

```bash
curl http://localhost:5000/api/health
```

Terminal 2, frontend:

```bash
cd frontend
npm run dev
```

The frontend runs on http://localhost:5173. Open that address in a browser.

To stop either server, press Ctrl+C in its terminal.

## How to play

### Solo mode

1. Open the app and choose Solo.
2. Pick a quiz and press Start solo quiz.
3. Answer each question before the timer runs out.
4. At the end, review your score and the correct answers.

### Multiplayer mode

1. Log in or register.
2. Choose Multiplayer, pick a quiz, optionally turn on Elimination mode, and press Create room.
3. Share the 6 character room code with other players.
4. Other players choose Multiplayer, then Join a room, and enter the code and a display name.
5. Every player presses Ready up. The host presses Start game.
6. Answer each timed question. The leaderboard updates after every question.
7. If you refresh mid-game, join the same room again with the same code and display name to recover your seat and score.

### Coding challenges

1. Choose Coding.
2. Pick a challenge and edit the starter code in the editor.
3. Press Run tests to see which tests pass and which fail.

### Create a custom quiz

1. Log in.
2. Choose Create Quiz.
3. Enter a title, category, and at least one question with 2 to 4 options and a correct answer.
4. Add more questions if you want, then press Save quiz. The quiz appears in the quiz list.

## Reset to seeded data

To start fresh with only the two seeded quizzes, stop the backend, delete `backend/data/db.json`, and start the backend again. It recreates the file with the seeded quizzes.

## Known limitations

- Rooms are held in backend memory. If the backend restarts, active rooms end, and players must create a new room. Users and quizzes in the JSON file survive a restart.
- Session recovery works while the backend is running and the player rejoins from a browser with the same stored player id.
- Coding challenges run in the browser using client-side evaluation of the submitted function. They are intended for simple practice tasks, not for untrusted code review.
- The JSON file store is suitable for local use and small groups. For larger use, replace it with a real database.
