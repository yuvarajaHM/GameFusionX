const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const playerNameInput = document.getElementById("playerName");
const scoreValue = document.getElementById("scoreValue");
const bestScoreValue = document.getElementById("bestScore");
const statusValue = document.getElementById("statusValue");
const finalScore = document.getElementById("finalScore");
const leaderboardList = document.getElementById("leaderboardList");
const gameOverScreen = document.getElementById("gameOverScreen");
const restartButton = document.getElementById("restartButton");
const soundToggle = document.getElementById("soundToggle");
const skinButtons = document.querySelectorAll(".skin-btn");

const player = {
    x: canvas.width / 2 - 16,
    y: canvas.height - 80,
    width: 32,
    height: 42,
    vx: 0,
    vy: -560,
    speed: 240,
    gravity: 980,
    jumpStrength: -560,
    color: "#a855f7",
};

const state = {
    direction: 0,
    score: 0,
    bestScore: Number(localStorage.getItem("towerHighScore") || 0),
    isGameOver: false,
    lastTime: 0,
    animationId: null,
    soundEnabled: window.GameFusionMusic ? window.GameFusionMusic.isEnabled() : true,
    scoreSaved: false,
};

let platforms = [];
let audioContext = null;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function playTone(startFrequency, endFrequency, duration, type = "triangle") {
    if (!state.soundEnabled) {
        return;
    }

    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
        endFrequency,
        audioContext.currentTime + duration
    );

    gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
}

function setStatus(text, className = "") {
    statusValue.textContent = text;
    statusValue.className = `hud-number small-number ${className}`.trim();
}

function updateHud() {
    scoreValue.textContent = Math.floor(state.score);
    bestScoreValue.textContent = state.bestScore;

    if (state.isGameOver) {
        setStatus("Fell", "status-danger");
    } else if (player.vy < -120) {
        setStatus("Rising", "status-good");
    } else if (player.vy > 180) {
        setStatus("Falling", "status-warn");
    } else {
        setStatus("Climbing", "status-good");
    }
}

function createPlatform(y, forceStatic = false) {
    const width = 78;
    const movingChance = Math.min(0.45, 0.15 + state.score / 2000);
    const moving = !forceStatic && Math.random() < movingChance;

    return {
        x: Math.random() * (canvas.width - width),
        y,
        width,
        height: 12,
        moving,
        speed: moving ? (Math.random() < 0.5 ? -1 : 1) * (45 + Math.random() * 45) : 0,
    };
}

function createInitialPlatforms() {
    platforms = [];

    for (let index = 0; index < 9; index += 1) {
        const y = canvas.height - index * 72 - 20;
        platforms.push(createPlatform(y, index < 2));
    }

    // Keep a stable starting platform near the player.
    platforms[0] = {
        x: canvas.width / 2 - 46,
        y: canvas.height - 26,
        width: 92,
        height: 12,
        moving: false,
        speed: 0,
    };
}

function resetGame() {
    createInitialPlatforms();

    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - 80;
    player.vx = 0;
    player.vy = player.jumpStrength;

    state.direction = 0;
    state.score = 0;
    state.isGameOver = false;
    state.lastTime = 0;
    state.scoreSaved = false;

    finalScore.textContent = "0";
    gameOverScreen.classList.add("hidden");
    updateHud();

    if (state.animationId) {
        cancelAnimationFrame(state.animationId);
    }

    state.animationId = requestAnimationFrame(gameLoop);
}

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(1, "#1e293b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    for (let index = 0; index < 18; index += 1) {
        const x = (index * 57) % canvas.width;
        const y = (index * 83) % canvas.height;
        ctx.fillRect(x, y, 2, 2);
    }

    ctx.strokeStyle = "rgba(148, 163, 184, 0.14)";
    ctx.lineWidth = 2;
    for (let y = 40; y < canvas.height; y += 80) {
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(canvas.width - 20, y);
        ctx.stroke();
    }
}

function drawPlayer() {
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.fillRect(player.x + 7, player.y + 6, player.width - 14, 10);

    ctx.fillStyle = "#111827";
    ctx.fillRect(player.x + 4, player.y + player.height, 8, 6);
    ctx.fillRect(player.x + player.width - 12, player.y + player.height, 8, 6);
}

function drawPlatform(platform) {
    ctx.fillStyle = platform.moving ? "#22c55e" : "#38bdf8";
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);

    ctx.fillStyle = "rgba(15, 23, 42, 0.55)";
    ctx.fillRect(platform.x + 6, platform.y + 3, platform.width - 12, 4);
}

function endGame() {
    if (state.isGameOver) {
        return;
    }

    state.isGameOver = true;
    const finishedScore = Math.floor(state.score);
    finalScore.textContent = finishedScore;

    if (finishedScore > state.bestScore) {
        state.bestScore = finishedScore;
        localStorage.setItem("towerHighScore", String(finishedScore));
    }

    gameOverScreen.classList.remove("hidden");
    playTone(260, 80, 0.32, "sawtooth");
    updateHud();

    if (!state.scoreSaved) {
        state.scoreSaved = true;
        saveScore(finishedScore);
    }
}

function update(deltaTime) {
    if (state.isGameOver) {
        return;
    }

    player.vx = state.direction * player.speed;
    player.x += player.vx * deltaTime;
    player.x = clamp(player.x, 0, canvas.width - player.width);

    const previousBottom = player.y + player.height;
    player.vy += player.gravity * deltaTime;
    player.y += player.vy * deltaTime;

    platforms.forEach((platform) => {
        if (!platform.moving) {
            return;
        }

        platform.x += platform.speed * deltaTime;
        if (platform.x <= 0 || platform.x + platform.width >= canvas.width) {
            platform.speed *= -1;
            platform.x = clamp(platform.x, 0, canvas.width - platform.width);
        }
    });

    for (const platform of platforms) {
        const isLanding =
            player.vy > 0 &&
            previousBottom <= platform.y &&
            player.y + player.height >= platform.y &&
            player.x + player.width > platform.x &&
            player.x < platform.x + platform.width;

        if (isLanding) {
            player.y = platform.y - player.height;
            player.vy = player.jumpStrength;
            playTone(520, 760, 0.07);
            break;
        }
    }

    const cameraLine = canvas.height * 0.35;
    if (player.y < cameraLine) {
        const shift = cameraLine - player.y;
        player.y = cameraLine;
        state.score += shift * 0.2;
        platforms.forEach((platform) => {
            platform.y += shift;
        });
    }

    platforms = platforms.filter((platform) => platform.y <= canvas.height + 20);

    let highestPlatformY = Math.min(...platforms.map((platform) => platform.y));
    while (platforms.length < 10 || highestPlatformY > 20) {
        highestPlatformY -= 70 + Math.random() * 20;
        platforms.push(createPlatform(highestPlatformY));
    }

    state.score += deltaTime * 2;

    if (player.y > canvas.height + 60) {
        endGame();
    }

    updateHud();
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    platforms.forEach(drawPlatform);
    drawPlayer();
}

function gameLoop(timestamp) {
    if (!state.lastTime) {
        state.lastTime = timestamp;
    }

    const deltaTime = Math.min((timestamp - state.lastTime) / 1000, 0.03);
    state.lastTime = timestamp;

    update(deltaTime);
    render();

    if (!state.isGameOver) {
        state.animationId = requestAnimationFrame(gameLoop);
    }
}

function renderLeaderboard(scores) {
    leaderboardList.innerHTML = "";

    if (!scores.length) {
        const emptyItem = document.createElement("li");
        emptyItem.textContent = "No scores yet. Start climbing!";
        leaderboardList.appendChild(emptyItem);
        return;
    }

    scores.forEach((entry, index) => {
        const item = document.createElement("li");
        const name = document.createElement("strong");
        const info = document.createElement("span");

        name.textContent = `${index + 1}. ${entry.player_name}`;
        info.textContent = ` — ${entry.score} pts`;

        item.appendChild(name);
        item.appendChild(info);
        leaderboardList.appendChild(item);
    });
}

async function loadLeaderboard() {
    try {
        const response = await fetch("/api/leaderboard/tower");
        const data = await response.json();
        renderLeaderboard(data.scores || []);
    } catch (error) {
        console.error(error);
        leaderboardList.innerHTML = "<li>Leaderboard unavailable right now.</li>";
    }
}

async function saveScore(score) {
    const payload = {
        name: playerNameInput.value.trim() || "Player",
        score,
    };

    try {
        const response = await fetch("/api/score/tower", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error("Could not save the score.");
        }

        const data = await response.json();
        renderLeaderboard(data.scores || []);
    } catch (error) {
        console.error(error);
    }
}

function bindDirectionalButton(buttonId, direction) {
    const button = document.getElementById(buttonId);

    const press = (event) => {
        event.preventDefault();
        state.direction = direction;
    };

    const release = (event) => {
        event.preventDefault();
        if (state.direction === direction) {
            state.direction = 0;
        }
    };

    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointerleave", release);
    button.addEventListener("pointercancel", release);
}

window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (["arrowleft", "arrowright", "a", "d", "enter"].includes(key)) {
        event.preventDefault();
    }

    if (key === "arrowleft" || key === "a") {
        state.direction = -1;
    }

    if (key === "arrowright" || key === "d") {
        state.direction = 1;
    }

    if (key === "enter" && state.isGameOver) {
        resetGame();
    }
});

window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();

    if ((key === "arrowleft" || key === "a") && state.direction < 0) {
        state.direction = 0;
    }

    if ((key === "arrowright" || key === "d") && state.direction > 0) {
        state.direction = 0;
    }
});

restartButton.addEventListener("click", resetGame);

soundToggle.addEventListener("click", () => {
    state.soundEnabled = window.GameFusionMusic
        ? window.GameFusionMusic.toggle()
        : !state.soundEnabled;
    soundToggle.textContent = state.soundEnabled ? "🔊 Sound On" : "🔇 Sound Off";
});

skinButtons.forEach((button) => {
    button.addEventListener("click", () => {
        skinButtons.forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        player.color = button.dataset.color;
    });
});

bindDirectionalButton("leftButton", -1);
bindDirectionalButton("rightButton", 1);
updateHud();
loadLeaderboard();
resetGame();
