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

const road = {
    x: 55,
    width: 250,
    lanes: 3,
};

const player = {
    width: 46,
    height: 84,
    x: canvas.width / 2 - 23,
    y: canvas.height - 110,
    speed: 300,
    direction: 0,
    color: "#38bdf8",
};

const state = {
    score: 0,
    bestScore: Number(localStorage.getItem("carHighScore") || 0),
    obstacleSpeed: 220,
    spawnTimer: 0,
    spawnInterval: 1000,
    stripeOffset: 0,
    isGameOver: false,
    lastTime: 0,
    animationId: null,
    soundEnabled: window.GameFusionMusic ? window.GameFusionMusic.isEnabled() : true,
    scoreSaved: false,
};

let enemies = [];
let audioContext = null;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function playTone(startFrequency, endFrequency, duration, type = "sawtooth") {
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

    gainNode.gain.setValueAtTime(0.12, audioContext.currentTime);
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
        setStatus("Crashed", "status-danger");
    } else if (state.obstacleSpeed > 430) {
        setStatus("Max speed", "status-danger");
    } else if (state.obstacleSpeed > 320) {
        setStatus("Busy road", "status-warn");
    } else {
        setStatus("Cruising", "status-good");
    }
}

function resetGame() {
    enemies = [];
    player.x = canvas.width / 2 - player.width / 2;
    player.direction = 0;

    state.score = 0;
    state.obstacleSpeed = 220;
    state.spawnTimer = 0;
    state.spawnInterval = 1000;
    state.stripeOffset = 0;
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

function spawnEnemy() {
    const laneWidth = road.width / road.lanes;
    const width = 46;
    const height = 84;
    const lane = Math.floor(Math.random() * road.lanes);
    const minX = road.x + 10;
    const maxX = road.x + road.width - width - 10;
    const startX = road.x + lane * laneWidth + (laneWidth - width) / 2;
    const colors = ["#ef4444", "#f59e0b", "#8b5cf6", "#22c55e", "#ec4899"];

    enemies.push({
        x: clamp(startX, minX, maxX),
        y: -height - Math.random() * 160,
        width,
        height,
        color: colors[Math.floor(Math.random() * colors.length)],
        driftSpeed: (Math.random() > 0.5 ? 1 : -1) * (35 + Math.random() * 55),
        driftTimer: 0.5 + Math.random() * 1.2,
    });
}

function isColliding(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function drawRoad() {
    ctx.fillStyle = "#14532d";
    ctx.fillRect(0, 0, road.x, canvas.height);
    ctx.fillRect(road.x + road.width, 0, canvas.width - (road.x + road.width), canvas.height);

    ctx.fillStyle = "#374151";
    ctx.fillRect(road.x, 0, road.width, canvas.height);

    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(road.x + 4, 0, 4, canvas.height);
    ctx.fillRect(road.x + road.width - 8, 0, 4, canvas.height);

    const laneWidth = road.width / road.lanes;
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";

    for (let lane = 1; lane < road.lanes; lane += 1) {
        const x = road.x + lane * laneWidth - 3;
        for (let y = -40 + (state.stripeOffset % 60); y < canvas.height; y += 60) {
            ctx.fillRect(x, y, 6, 30);
        }
    }
}

function drawCar(x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.fillRect(x + 8, y + 10, width - 16, 18);
    ctx.fillRect(x + 10, y + height - 30, width - 20, 14);

    ctx.fillStyle = "#111827";
    ctx.fillRect(x - 4, y + 10, 6, 18);
    ctx.fillRect(x - 4, y + height - 28, 6, 18);
    ctx.fillRect(x + width - 2, y + 10, 6, 18);
    ctx.fillRect(x + width - 2, y + height - 28, 6, 18);

    ctx.fillStyle = "#fde68a";
    ctx.fillRect(x + 7, y + 4, 8, 6);
    ctx.fillRect(x + width - 15, y + 4, 8, 6);
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
        localStorage.setItem("carHighScore", String(finishedScore));
    }

    gameOverScreen.classList.remove("hidden");
    playTone(220, 60, 0.28);
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

    player.x += player.direction * player.speed * deltaTime;
    player.x = clamp(player.x, road.x + 10, road.x + road.width - player.width - 10);

    state.score += deltaTime * 15;
    state.obstacleSpeed = Math.min(560, 220 + state.score * 0.75);
    state.spawnInterval = Math.max(360, 1000 - state.score * 1.2);
    state.stripeOffset += state.obstacleSpeed * deltaTime;

    state.spawnTimer += deltaTime * 1000;
    if (state.spawnTimer >= state.spawnInterval) {
        spawnEnemy();
        state.spawnTimer = 0;
    }

    const minX = road.x + 10;
    const maxX = road.x + road.width - 56;

    enemies.forEach((enemy) => {
        enemy.y += state.obstacleSpeed * deltaTime;
        enemy.x += enemy.driftSpeed * deltaTime;
        enemy.driftTimer -= deltaTime;

        if (enemy.x <= minX || enemy.x >= maxX) {
            enemy.x = clamp(enemy.x, minX, maxX);
            enemy.driftSpeed *= -1;
        }

        if (enemy.driftTimer <= 0) {
            enemy.driftSpeed *= Math.random() > 0.5 ? -1 : 1;
            enemy.driftTimer = 0.45 + Math.random() * 1.1;
        }
    });

    enemies = enemies.filter((enemy) => enemy.y < canvas.height + enemy.height);

    for (const enemy of enemies) {
        if (isColliding(player, enemy)) {
            endGame();
            break;
        }
    }

    updateHud();
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawRoad();
    drawCar(player.x, player.y, player.width, player.height, player.color);

    enemies.forEach((enemy) => {
        drawCar(enemy.x, enemy.y, enemy.width, enemy.height, enemy.color);
    });
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
        emptyItem.textContent = "No scores yet. Drive first!";
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
        const response = await fetch("/api/leaderboard/car");
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
        const response = await fetch("/api/score/car", {
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
        player.direction = direction;
    };

    const release = (event) => {
        event.preventDefault();
        if (player.direction === direction) {
            player.direction = 0;
        }
    };

    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointerleave", release);
    button.addEventListener("pointercancel", release);
}

window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (["arrowleft", "arrowright", "a", "d", " ", "enter"].includes(key)) {
        event.preventDefault();
    }

    if (key === "arrowleft" || key === "a") {
        player.direction = -1;
    }

    if (key === "arrowright" || key === "d") {
        player.direction = 1;
    }

    if ((key === " " || key === "enter") && state.isGameOver) {
        resetGame();
    }
});

window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();

    if ((key === "arrowleft" || key === "a") && player.direction < 0) {
        player.direction = 0;
    }

    if ((key === "arrowright" || key === "d") && player.direction > 0) {
        player.direction = 0;
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
