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

const track = {
    x: 50,
    width: 260,
    lanes: 3,
};

const bike = {
    width: 38,
    height: 78,
    x: canvas.width / 2 - 19,
    y: canvas.height - 105,
    speed: 280,
    direction: 0,
    color: "#22c55e",
    jumpActive: false,
    jumpTime: 0,
    jumpDuration: 0.72,
    jumpHeight: 78,
    jumpOffset: 0,
};

const state = {
    score: 0,
    bestScore: Number(localStorage.getItem("bikeHighScore") || 0),
    baseSpeed: 210,
    spawnTimer: 0,
    spawnInterval: 920,
    stripeOffset: 0,
    boostTime: 0,
    isGameOver: false,
    lastTime: 0,
    animationId: null,
    soundEnabled: window.GameFusionMusic ? window.GameFusionMusic.isEnabled() : true,
    scoreSaved: false,
};

let items = [];
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

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
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
    } else if (state.boostTime > 0) {
        setStatus(`Boost ${state.boostTime.toFixed(1)}s`, "status-good");
    } else if (bike.jumpActive) {
        setStatus("Jumping", "status-warn");
    } else {
        setStatus("Ready", "status-good");
    }
}

function resetGame() {
    items = [];
    bike.x = canvas.width / 2 - bike.width / 2;
    bike.direction = 0;
    bike.jumpActive = false;
    bike.jumpTime = 0;
    bike.jumpOffset = 0;

    state.score = 0;
    state.spawnTimer = 0;
    state.spawnInterval = 920;
    state.stripeOffset = 0;
    state.boostTime = 0;
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

function startJump() {
    if (state.isGameOver) {
        resetGame();
        return;
    }

    if (!bike.jumpActive) {
        bike.jumpActive = true;
        bike.jumpTime = 0;
        playTone(660, 920, 0.08);
    }
}

function spawnItem() {
    const laneWidth = track.width / track.lanes;
    const lane = Math.floor(Math.random() * track.lanes);

    if (Math.random() < 0.22) {
        items.push({
            kind: "boost",
            x: track.x + lane * laneWidth + (laneWidth - 42) / 2,
            y: -40,
            width: 42,
            height: 18,
            color: "#facc15",
        });
        return;
    }

    const obstacleTypes = [
        { kind: "rock", width: 34, height: 28, color: "#a3a3a3" },
        { kind: "cone", width: 28, height: 36, color: "#fb7185" },
        { kind: "barrier", width: 46, height: 24, color: "#f97316" },
    ];

    const obstacle = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    items.push({
        ...obstacle,
        x: track.x + lane * laneWidth + (laneWidth - obstacle.width) / 2,
        y: -obstacle.height - Math.random() * 110,
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

function getBikeHitbox() {
    return {
        x: bike.x,
        y: bike.y - bike.jumpOffset,
        width: bike.width,
        height: bike.height,
    };
}

function drawTrack() {
    ctx.fillStyle = "#166534";
    ctx.fillRect(0, 0, track.x, canvas.height);
    ctx.fillRect(track.x + track.width, 0, canvas.width - (track.x + track.width), canvas.height);

    ctx.fillStyle = "#334155";
    ctx.fillRect(track.x, 0, track.width, canvas.height);

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(track.x + 4, 0, 4, canvas.height);
    ctx.fillRect(track.x + track.width - 8, 0, 4, canvas.height);

    const laneWidth = track.width / track.lanes;
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";

    for (let lane = 1; lane < track.lanes; lane += 1) {
        const x = track.x + lane * laneWidth - 3;
        for (let y = -36 + (state.stripeOffset % 60); y < canvas.height; y += 60) {
            ctx.fillRect(x, y, 6, 28);
        }
    }
}

function drawBike() {
    const x = bike.x;
    const y = bike.y - bike.jumpOffset;

    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(x + 8, y + bike.height - 6, 9, 0, Math.PI * 2);
    ctx.arc(x + bike.width - 8, y + bike.height - 6, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = bike.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + bike.height - 6);
    ctx.lineTo(x + 18, y + 38);
    ctx.lineTo(x + 30, y + bike.height - 6);
    ctx.lineTo(x + 18, y + 38);
    ctx.lineTo(x + bike.width - 6, y + 24);
    ctx.stroke();

    ctx.fillStyle = bike.color;
    ctx.fillRect(x + 14, y + 10, 12, 20);
    ctx.fillRect(x + 18, y + 0, 10, 12);

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(x + 20, y + 3, 6, 6);
}

function drawItem(item) {
    if (item.kind === "boost") {
        ctx.fillStyle = item.color;
        ctx.fillRect(item.x, item.y, item.width, item.height);
        ctx.fillStyle = "#111827";
        ctx.font = "bold 10px Arial";
        ctx.fillText("BOOST", item.x + 3, item.y + 12);
        return;
    }

    ctx.fillStyle = item.color;

    if (item.kind === "rock") {
        ctx.beginPath();
        ctx.arc(item.x + item.width / 2, item.y + item.height / 2, item.width / 2, 0, Math.PI * 2);
        ctx.fill();
    } else if (item.kind === "cone") {
        ctx.beginPath();
        ctx.moveTo(item.x + item.width / 2, item.y);
        ctx.lineTo(item.x, item.y + item.height);
        ctx.lineTo(item.x + item.width, item.y + item.height);
        ctx.closePath();
        ctx.fill();
    } else {
        ctx.fillRect(item.x, item.y, item.width, item.height);
        ctx.fillStyle = "#111827";
        ctx.fillRect(item.x + 6, item.y + 6, item.width - 12, 4);
    }
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
        localStorage.setItem("bikeHighScore", String(finishedScore));
    }

    gameOverScreen.classList.remove("hidden");
    playTone(260, 70, 0.3, "sawtooth");
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

    bike.x += bike.direction * bike.speed * deltaTime;
    bike.x = clamp(bike.x, track.x + 10, track.x + track.width - bike.width - 10);

    if (bike.jumpActive) {
        bike.jumpTime += deltaTime;
        const progress = bike.jumpTime / bike.jumpDuration;

        if (progress >= 1) {
            bike.jumpActive = false;
            bike.jumpOffset = 0;
        } else {
            bike.jumpOffset = Math.sin(progress * Math.PI) * bike.jumpHeight;
        }
    }

    if (state.boostTime > 0) {
        state.boostTime = Math.max(0, state.boostTime - deltaTime);
    }

    const currentSpeed = Math.min(540, state.baseSpeed + state.score * 0.65 + (state.boostTime > 0 ? 160 : 0));

    state.score += currentSpeed * deltaTime * 0.05;
    state.spawnInterval = Math.max(330, 920 - state.score * 0.9);
    state.stripeOffset += currentSpeed * deltaTime;

    state.spawnTimer += deltaTime * 1000;
    if (state.spawnTimer >= state.spawnInterval) {
        spawnItem();
        state.spawnTimer = 0;
    }

    const hitbox = getBikeHitbox();

    items.forEach((item) => {
        item.y += currentSpeed * deltaTime;
    });

    items = items.filter((item) => item.y < canvas.height + item.height);

    for (let index = items.length - 1; index >= 0; index -= 1) {
        const item = items[index];

        if (!isColliding(hitbox, item)) {
            continue;
        }

        if (item.kind === "boost") {
            state.boostTime = 2.6;
            items.splice(index, 1);
            playTone(480, 900, 0.12);
            continue;
        }

        if (bike.jumpOffset < 26) {
            endGame();
            break;
        }
    }

    updateHud();
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawTrack();
    drawBike();
    items.forEach(drawItem);
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
        emptyItem.textContent = "No scores yet. Start riding!";
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
        const response = await fetch("/api/leaderboard/bike");
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
        const response = await fetch("/api/score/bike", {
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
        bike.direction = direction;
    };

    const release = (event) => {
        event.preventDefault();
        if (bike.direction === direction) {
            bike.direction = 0;
        }
    };

    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointerleave", release);
    button.addEventListener("pointercancel", release);
}

window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (["arrowleft", "arrowright", "arrowup", "a", "d", "w", " ", "enter"].includes(key)) {
        event.preventDefault();
    }

    if (key === "arrowleft" || key === "a") {
        bike.direction = -1;
    }

    if (key === "arrowright" || key === "d") {
        bike.direction = 1;
    }

    if (key === "arrowup" || key === "w" || key === " ") {
        startJump();
    }

    if (key === "enter" && state.isGameOver) {
        resetGame();
    }
});

window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();

    if ((key === "arrowleft" || key === "a") && bike.direction < 0) {
        bike.direction = 0;
    }

    if ((key === "arrowright" || key === "d") && bike.direction > 0) {
        bike.direction = 0;
    }
});

restartButton.addEventListener("click", resetGame);
document.getElementById("jumpButton").addEventListener("click", startJump);

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
        bike.color = button.dataset.color;
    });
});

bindDirectionalButton("leftButton", -1);
bindDirectionalButton("rightButton", 1);
updateHud();
loadLeaderboard();
resetGame();
