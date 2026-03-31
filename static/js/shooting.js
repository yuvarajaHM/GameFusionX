const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const playerNameInput = document.getElementById("playerName");
const difficultySelect = document.getElementById("difficultySelect");
const scoreValue = document.getElementById("scoreValue");
const statusValue = document.getElementById("statusValue");
const bestScoreValue = document.getElementById("bestScore");
const finalScore = document.getElementById("finalScore");
const leaderboardList = document.getElementById("leaderboardList");
const gameOverScreen = document.getElementById("gameOverScreen");
const restartButton = document.getElementById("restartButton");
const restartButtonTop = document.getElementById("restartButtonTop");
const soundToggle = document.getElementById("soundToggle");

const DIFFICULTY_SETTINGS = {
    easy: { duration: 30, targetCount: 4, speed: 80, radius: 24, scoreKey: "shootingEasyHighScore" },
    medium: { duration: 25, targetCount: 5, speed: 120, radius: 20, scoreKey: "shootingMediumHighScore" },
    hard: { duration: 20, targetCount: 6, speed: 170, radius: 16, scoreKey: "shootingHardHighScore" },
};

const state = {
    score: 0,
    timeLeft: 0,
    bestScore: 0,
    difficulty: difficultySelect.value,
    isGameOver: false,
    lastTime: 0,
    animationId: null,
    soundEnabled: window.GameFusionMusic ? window.GameFusionMusic.isEnabled() : true,
    scoreSaved: false,
    pointerX: canvas.width / 2,
    pointerY: canvas.height / 2,
};

let targets = [];
let audioContext = null;

function playTone(startFrequency, endFrequency, duration, type = "sine") {
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
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, audioContext.currentTime + duration);

    gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
}

function getDifficultyConfig() {
    return DIFFICULTY_SETTINGS[state.difficulty];
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getBestScore() {
    const config = getDifficultyConfig();
    return Number(localStorage.getItem(config.scoreKey) || 0);
}

function updateHud() {
    scoreValue.textContent = state.score;
    bestScoreValue.textContent = state.bestScore;
    statusValue.textContent = `${state.timeLeft.toFixed(1)}s`;
    statusValue.className = `hud-number small-number ${state.timeLeft < 6 ? "status-danger" : "status-good"}`;
}

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

function createTarget() {
    const config = getDifficultyConfig();
    const radius = config.radius + randomBetween(-3, 4);

    return {
        x: randomBetween(radius + 10, canvas.width - radius - 10),
        y: randomBetween(radius + 10, canvas.height - radius - 10),
        radius,
        vx: randomBetween(-config.speed, config.speed),
        vy: randomBetween(-config.speed, config.speed),
        color: ["#ef4444", "#f59e0b", "#38bdf8", "#22c55e", "#e879f9"][Math.floor(Math.random() * 5)],
    };
}

function fillTargets() {
    const config = getDifficultyConfig();
    while (targets.length < config.targetCount) {
        targets.push(createTarget());
    }
}

function resetGame() {
    state.difficulty = difficultySelect.value;
    state.score = 0;
    state.timeLeft = getDifficultyConfig().duration;
    state.bestScore = getBestScore();
    state.isGameOver = false;
    state.lastTime = 0;
    state.scoreSaved = false;
    targets = [];
    fillTargets();

    finalScore.textContent = "0";
    gameOverScreen.classList.add("hidden");
    updateHud();

    if (state.animationId) {
        cancelAnimationFrame(state.animationId);
    }

    state.animationId = requestAnimationFrame(gameLoop);
}

function drawBackground() {
    const gradient = ctx.createRadialGradient(180, 120, 20, 180, 300, 360);
    gradient.addColorStop(0, "#1e3a8a");
    gradient.addColorStop(1, "#020617");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
    for (let x = 20; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 20; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawTarget(target) {
    ctx.fillStyle = target.color;
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.radius * 0.62, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = target.color;
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
}

function drawCrosshair() {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(state.pointerX, state.pointerY, 14, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(state.pointerX - 18, state.pointerY);
    ctx.lineTo(state.pointerX + 18, state.pointerY);
    ctx.moveTo(state.pointerX, state.pointerY - 18);
    ctx.lineTo(state.pointerX, state.pointerY + 18);
    ctx.stroke();
}

function update(deltaTime) {
    if (state.isGameOver) {
        return;
    }

    state.timeLeft = Math.max(0, state.timeLeft - deltaTime);
    if (state.timeLeft <= 0) {
        endGame();
        return;
    }

    targets.forEach((target) => {
        target.x += target.vx * deltaTime;
        target.y += target.vy * deltaTime;

        if (target.x - target.radius <= 0 || target.x + target.radius >= canvas.width) {
            target.vx *= -1;
            target.x = clamp(target.x, target.radius, canvas.width - target.radius);
        }

        if (target.y - target.radius <= 0 || target.y + target.radius >= canvas.height) {
            target.vy *= -1;
            target.y = clamp(target.y, target.radius, canvas.height - target.radius);
        }

        if (Math.random() < 0.01) {
            target.vx += randomBetween(-20, 20);
            target.vy += randomBetween(-20, 20);
        }
    });

    updateHud();
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    targets.forEach(drawTarget);
    drawCrosshair();
}

function endGame() {
    if (state.isGameOver) {
        return;
    }

    state.isGameOver = true;
    finalScore.textContent = state.score;

    if (state.score > state.bestScore) {
        state.bestScore = state.score;
        localStorage.setItem(getDifficultyConfig().scoreKey, String(state.score));
    }

    gameOverScreen.classList.remove("hidden");
    playTone(260, 80, 0.28, "sawtooth");
    updateHud();

    if (!state.scoreSaved) {
        state.scoreSaved = true;
        saveScore(state.score);
    }
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
        emptyItem.textContent = "No scores yet. Start shooting!";
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
        const response = await fetch("/api/leaderboard/shooting");
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
        const response = await fetch("/api/score/shooting", {
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

function handleShot(clientX, clientY) {
    if (state.isGameOver) {
        resetGame();
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    state.pointerX = x;
    state.pointerY = y;

    let hitIndex = -1;
    for (let index = 0; index < targets.length; index += 1) {
        const target = targets[index];
        const distance = Math.hypot(x - target.x, y - target.y);
        if (distance <= target.radius) {
            hitIndex = index;
            break;
        }
    }

    if (hitIndex >= 0) {
        const hitTarget = targets[hitIndex];
        const bonus = Math.max(5, Math.round(30 - hitTarget.radius));
        state.score += bonus;
        targets.splice(hitIndex, 1);
        fillTargets();
        playTone(520, 920, 0.08, "triangle");
    } else {
        state.score = Math.max(0, state.score - 1);
        playTone(180, 120, 0.06, "square");
    }

    updateHud();
}

canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    state.pointerX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    state.pointerY = ((event.clientY - rect.top) / rect.height) * canvas.height;
});

canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    handleShot(event.clientX, event.clientY);
});

restartButton.addEventListener("click", resetGame);
restartButtonTop.addEventListener("click", resetGame);
difficultySelect.addEventListener("change", resetGame);

soundToggle.addEventListener("click", () => {
    state.soundEnabled = window.GameFusionMusic
        ? window.GameFusionMusic.toggle()
        : !state.soundEnabled;
    soundToggle.textContent = state.soundEnabled ? "🔊 Sound On" : "🔇 Sound Off";
});

loadLeaderboard();
resetGame();
