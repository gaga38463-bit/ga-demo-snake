(() => {
  const { supabaseUrl, supabaseKey } = window.SNAKE_CONFIG;
  const GRID = 20;
  const TICK_MS = 110;
  const NAME_KEY = "snake-username";

  const $ = (id) => document.getElementById(id);
  const nameScreen = $("name-screen");
  const nameInput = $("name-input");
  const gameScreen = $("game-screen");
  const canvas = $("board");
  const ctx = canvas.getContext("2d");
  const overlay = $("overlay");
  const overlayText = $("overlay-text");
  const startButton = $("start");
  const scoreEl = $("score");
  const leaderboardEl = $("leaderboard");
  const leaderboardStatus = $("leaderboard-status");
  const cell = canvas.width / GRID;

  let username = "";
  let snake, dir, nextDirs, food, score, timer;

  // --- Supabase (plain REST, no library needed; read-only from the browser) ---

  async function api(path, options = {}) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: supabaseKey,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  }

  async function loadLeaderboard() {
    try {
      const rows = await api("leaderboard?select=username,score");
      leaderboardEl.replaceChildren(
        ...rows.map((row, i) => {
          const li = document.createElement("li");
          if (row.username === username) li.className = "me";
          for (const [cls, text] of [["rank", i + 1], ["name", row.username], ["pts", row.score]]) {
            const span = document.createElement("span");
            span.className = cls;
            span.textContent = text;
            li.append(span);
          }
          return li;
        })
      );
      leaderboardStatus.textContent = rows.length ? "" : "No scores yet. Be the first!";
    } catch (err) {
      console.error(err);
      leaderboardStatus.textContent = "Could not load the leaderboard.";
    }
  }

  async function saveScore() {
    try {
      // Browsers cannot write to the database directly; the server function does it.
      const res = await fetch("/api/submit-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, score }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    } catch (err) {
      console.error(err);
      leaderboardStatus.textContent = "Could not save your score.";
      return;
    }
    await loadLeaderboard();
  }

  // --- Username ---

  function showNameScreen() {
    stop();
    gameScreen.hidden = true;
    nameScreen.hidden = false;
    nameInput.value = username;
    nameInput.focus();
  }

  function showGameScreen() {
    nameScreen.hidden = true;
    gameScreen.hidden = false;
    $("player-name").textContent = username;
    reset();
    draw();
    showOverlay("Ready?", "Start");
    loadLeaderboard();
  }

  nameScreen.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = nameInput.value.trim().slice(0, 16);
    if (!name) return;
    username = name;
    localStorage.setItem(NAME_KEY, username);
    showGameScreen();
  });

  $("change-name").addEventListener("click", showNameScreen);

  // --- Game ---

  function reset() {
    snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    dir = { x: 1, y: 0 };
    nextDirs = [];
    score = 0;
    scoreEl.textContent = score;
    placeFood();
  }

  function placeFood() {
    const free = [];
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
      }
    }
    food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function start() {
    reset();
    overlay.hidden = true;
    timer = setInterval(tick, TICK_MS);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  function tick() {
    if (nextDirs.length) dir = nextDirs.shift();
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    const ate = food && head.x === food.x && head.y === food.y;
    // The tail moves out of the way this tick unless we just ate.
    const body = ate ? snake : snake.slice(0, -1);
    const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
    if (hitWall || body.some((s) => s.x === head.x && s.y === head.y)) return gameOver();

    snake.unshift(head);
    if (ate) {
      score++;
      scoreEl.textContent = score;
      placeFood();
      if (!food) return gameOver();
    } else {
      snake.pop();
    }
    draw();
  }

  function gameOver() {
    stop();
    draw();
    showOverlay(`Game over\nScore: ${score}`, "Play again");
    saveScore();
  }

  function showOverlay(text, buttonLabel) {
    overlayText.textContent = text;
    startButton.textContent = buttonLabel;
    overlay.hidden = false;
    startButton.focus();
  }

  function draw() {
    const css = getComputedStyle(document.documentElement);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (food) {
      ctx.fillStyle = css.getPropertyValue("--food");
      ctx.beginPath();
      ctx.arc((food.x + 0.5) * cell, (food.y + 0.5) * cell, cell * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = css.getPropertyValue("--accent");
    snake.forEach((s, i) => {
      ctx.globalAlpha = i === 0 ? 1 : 0.75;
      ctx.fillRect(s.x * cell + 1, s.y * cell + 1, cell - 2, cell - 2);
    });
    ctx.globalAlpha = 1;
  }

  // --- Input ---

  function steer(x, y) {
    if (!timer) return;
    // Compare against the last queued turn so quick double taps cannot reverse the snake.
    const last = nextDirs[nextDirs.length - 1] || dir;
    if (last.x === -x && last.y === -y) return;
    if (last.x === x && last.y === y) return;
    if (nextDirs.length < 2) nextDirs.push({ x, y });
  }

  const KEYS = {
    ArrowUp: [0, -1], w: [0, -1],
    ArrowDown: [0, 1], s: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0],
  };

  document.addEventListener("keydown", (e) => {
    if (e.target === nameInput) return;
    const move = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (!move) return;
    e.preventDefault();
    steer(...move);
  });

  let touchStart = null;
  canvas.addEventListener("touchstart", (e) => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  canvas.addEventListener("touchmove", (e) => {
    if (!touchStart) return;
    const dx = e.touches[0].clientX - touchStart.x;
    const dy = e.touches[0].clientY - touchStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) steer(Math.sign(dx), 0);
    else steer(0, Math.sign(dy));
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });

  startButton.addEventListener("click", start);

  // --- Boot ---

  username = localStorage.getItem(NAME_KEY) || "";
  if (username) showGameScreen();
  else {
    showNameScreen();
    loadLeaderboard();
  }
})();
