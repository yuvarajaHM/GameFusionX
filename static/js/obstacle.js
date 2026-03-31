const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const playerNameInput = document.getElementById("playerName");
const scoreValue = document.getElementById("scoreValue");
const livesValue = document.getElementById("livesValue");
const bestScoreValue = document.getElementById("bestScore");
const statusValue = document.getElementById("statusValue");
const finalScore = document.getElementById("finalScore");
const leaderboardList = document.getElementById("leaderboardList");
const gameOverScreen = document.getElementById("gameOverScreen");
const restartButton = document.getElementById("restartButton");
const pauseButton = document.getElementById("pauseButton");
const soundToggle = document.getElementById("soundToggle");
const skinButtons = document.querySelectorAll(".skin-btn");

const groundY = canvas.height - 76;

const player = {
    x: 76,
    y: groundY - 50,
    width: 34,
    height: 50,
    speed: 250,
    direction: 0,
    vx: 0,
    vy: 0,
    gravity: 980,
    jumpStrength: -500,
    color: "#38bdf8",
    isGrounded: true,
    invincibleTime: 0,
};

const state = {
    score: 0,
    lives: 3,
    bestScore: Number(localStorage.getItem("obstacleHighScore") || 0),
    worldSpeed: 210,
    spawnTimer: 0,
    spawnInterval: 1400,
    isPaused: false,
    isGameOver: false,
    lastTime: 0,
    animationId: null,
    soundEnabled: window.GameFusionMusic ? window.GameFusionMusic.isEnabled() : true,
    scoreSaved: false,
    groundOffset: 0,
};

let obstacles = [];
let effects = [];
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

function addBurst(x, y, color) {
    for (let index = 0; index < 10; index += 1) {
        effects.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 120,
            vy: (Math.random() - 0.5) * 120,
            radius: 2 + Math.random() * 3,
            life: 0.35 + Math.random() * 0.2,
            color,
        });
    }
}

function setStatus(text) {
    statusValue.textContent = text;
}

function updateHud() {
    scoreValue.textContent = Math.floor(state.score);
    livesValue.textContent = state.lives;
    bestScoreValue.textContent = state.bestScore;

    if (state.isGameOver) {
        setStatus("Run over — restart to try again.");
    } else if (state.isPaused) {
        setStatus("Paused. Press P or click Pause to resume.");
    } else if (player.invincibleTime > 0) {
        setStatus("Careful! You are recovering from a hit.");
    } else {
        setStatus("Survive longer as the trap speed increases.");
    }
}

function createObstacle(type) {
    const x = canvas.width + 30 + Math.random() * 80;

    if (type === "blade") {
        return {
            type,
            x,
            y: groundY - 22,
            radius: 18,
            width: 36,
            height: 36,
            rotation: 0,
        };
    }

    if (type === "hammer") {
        return {
            type,
            x,
            anchorY: 46,
            length: 92,
            bobRadius: 18,
            swingTime: Math.random() * Math.PI * 2,
            width: 50,
            height: 140,
        };
    }

    if (type === "fire") {
        return {
            type,
            x,
            y: groundY - 44,
            width: 34,
            height: 44,
            cycleTime: Math.random() * Math.PI * 2,
        };
    }

    if (type === "laser") {
        return {
            type,
            x,
            y: 70,
            width: 16,
            height: groundY - 100,
            cycleTime: Math.random() * Math.PI * 2,
        };
    }

    return {
        type: "spikes",
        x,
        y: groundY - 24,
        width: 46,
        height: 24,
    };
}

function spawnObstacle() {
    const obstacleTypes = ["blade", "hammer", "fire", "laser", "spikes"];
    const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    obstacles.push(createObstacle(type));
}

function resetGame() {
    obstacles = [];
    effects = [];

    player.x = 76;
    player.y = groundY - player.height;
    player.vx = 0;
    player.vy = 0;
    player.direction = 0;
    player.isGrounded = true;
    player.invincibleTime = 0;

    state.score = 0;
    state.lives = 3;
    state.worldSpeed = 210;
    state.spawnTimer = 0;
    state.spawnInterval = 1400;
    state.isPaused = false;
    state.isGameOver = false;
    state.lastTime = 0;
    state.scoreSaved = false;
    state.groundOffset = 0;

    pauseButton.textContent = "⏸ Pause";
    finalScore.textContent = "0";
    gameOverScreen.classList.add("hidden");
    updateHud();

    if (state.animationId) {
        cancelAnimationFrame(state.animationId);
    }

    state.animationId = requestAnimationFrame(gameLoop);
}

function jump() {
    if (state.isGameOver) {
        resetGame();
        return;
    }

    if (state.isPaused || !player.isGrounded) {
        return;
    }

    player.vy = player.jumpStrength;
    player.isGrounded = false;
    playTone(420, 760, 0.09);
}

function togglePause() {
    if (state.isGameOver) {
        return;
    }

    state.isPaused = !state.isPaused;
    pauseButton.textContent = state.isPaused ? "▶ Resume" : "⏸ Pause";
    updateHud();
}

function hitPlayer() {
    if (player.invincibleTime > 0 || state.isGameOver) {
        return;
    }

    state.lives -= 1;
    player.invincibleTime = 1.2;
    addBurst(player.x + player.width / 2, player.y + player.height / 2, "#f87171");
    playTone(240, 90, 0.2, "sawtooth");

    if (state.lives <= 0) {
        endGame();
    }

    updateHud();
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
        localStorage.setItem("obstacleHighScore", String(finishedScore));
    }

    gameOverScreen.classList.remove("hidden");
    updateHud();

    if (!state.scoreSaved) {
        state.scoreSaved = true;
        saveScore(finishedScore);
    }
}

function getPlayerHitbox() {
    return {
        x: player.x + 4,
        y: player.y + 4,
        width: player.width - 8,
        height: player.height - 4,
    };
}

function rectsOverlap(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function obstacleHitsPlayer(obstacle, hitbox) {
    if (obstacle.type === "blade") {
        const centerX = obstacle.x + obstacle.radius;
        const centerY = obstacle.y + obstacle.radius;
        const closestX = clamp(centerX, hitbox.x, hitbox.x + hitbox.width);
        const closestY = clamp(centerY, hitbox.y, hitbox.y + hitbox.height);
        const dx = centerX - closestX;
        const dy = centerY - closestY;
        return dx * dx + dy * dy < obstacle.radius * obstacle.radius;
    }

    if (obstacle.type === "hammer") {
        const bobX = obstacle.x + Math.sin(obstacle.swingTime) * 28;
        const bobY = obstacle.anchorY + obstacle.length * 0.7 + Math.cos(obstacle.swingTime * 1.4) * 16;
        const closestX = clamp(bobX, hitbox.x, hitbox.x + hitbox.width);
        const closestY = clamp(bobY, hitbox.y, hitbox.y + hitbox.height);
        const dx = bobX - closestX;
        const dy = bobY - closestY;
        return dx * dx + dy * dy < obstacle.bobRadius * obstacle.bobRadius;
    }

    if (obstacle.type === "fire") {
        const active = Math.sin(obstacle.cycleTime) > -0.15;
        if (!active) {
            return false;
        }
        return rectsOverlap(hitbox, obstacle);
    }

    if (obstacle.type === "laser") {
        const active = Math.sin(obstacle.cycleTime) > 0;
        if (!active) {
            return false;
        }
        return rectsOverlap(hitbox, obstacle);
    }

    return rectsOverlap(hitbox, obstacle);
}

function update(deltaTime) {
    if (state.isPaused || state.isGameOver) {
        return;
    }

    player.vx = player.direction * player.speed;
    player.x += player.vx * deltaTime;
    player.x = clamp(player.x, 10, canvas.width - player.width - 10);

    player.vy += player.gravity * deltaTime;
    player.y += player.vy * deltaTime;

    if (player.y + player.height >= groundY) {
        player.y = groundY - player.height;
        player.vy = 0;
        player.isGrounded = true;
    }

    player.invincibleTime = Math.max(0, player.invincibleTime - deltaTime);

    state.score += deltaTime * 14;
    state.worldSpeed = Math.min(420, 210 + state.score * 1.2);
    state.spawnInterval = Math.max(520, 1400 - state.score * 3);
    state.groundOffset += state.worldSpeed * deltaTime;

    state.spawnTimer += deltaTime * 1000;
    if (state.spawnTimer >= state.spawnInterval) {
        spawnObstacle();
        state.spawnTimer = 0;
    }

    const hitbox = getPlayerHitbox();

    obstacles.forEach((obstacle) => {
        obstacle.x -= state.worldSpeed * deltaTime;

        if (obstacle.type === "blade") {
            obstacle.rotation += deltaTime * 10;
        }

        if (obstacle.type === "hammer") {
            obstacle.swingTime += deltaTime * 4;
        }

        if (obstacle.type === "fire" || obstacle.type === "laser") {
            obstacle.cycleTime += deltaTime * 5;
        }
    });

    obstacles = obstacles.filter((obstacle) => obstacle.x > -120);

    for (const obstacle of obstacles) {
        if (obstacleHitsPlayer(obstacle, hitbox)) {
            hitPlayer();
            break;
        }
    }

    effects.forEach((effect) => {
        effect.x += effect.vx * deltaTime;
        effect.y += effect.vy * deltaTime;
        effect.life -= deltaTime;
    });
    effects = effects.filter((effect) => effect.life > 0);

    updateHud();
}

function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "#0f172a");
    sky.addColorStop(1, "#1e293b");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255,255,255,0.12)";
    for (let index = 0; index < 7; index += 1) {
        const x = (index * 65 + 20) % canvas.width;
        ctx.beginPath();
        ctx.arc(x, 80 + (index % 3) * 22, 14, 0, Math.PI * 2);
        ctx.arc(x + 14, 78 + (index % 3) * 22, 12, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = "#65a30d";
    ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

    for (let x = -(state.groundOffset % 40); x < canvas.width + 40; x += 40) {
        ctx.fillStyle = "#4d7c0f";
        ctx.fillRect(x, groundY + 22, 24, 10);
    }
}

function drawPlayer() {
    ctx.save();

    if (player.invincibleTime > 0 && Math.floor(player.invincibleTime * 10) % 2 === 0) {
        ctx.globalAlpha = 0.45;
    }

    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y + 10, player.width, player.height - 10);
    ctx.fillStyle = "#fde68a";
    ctx.fillRect(player.x + 6, player.y, player.width - 12, 14);
    ctx.fillStyle = "#111827";
    ctx.fillRect(player.x + 7, player.y + 22, 6, 6);
    ctx.fillRect(player.x + player.width - 13, player.y + 22, 6, 6);
    ctx.fillRect(player.x + 6, player.y + player.height - 4, 6, 8);
    ctx.fillRect(player.x + player.width - 12, player.y + player.height - 4, 6, 8);

    ctx.restore();
}

function drawBlade(obstacle) {
    const cx = obstacle.x + obstacle.radius;
    const cy = obstacle.y + obstacle.radius;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(obstacle.rotation);
    ctx.fillStyle = "#cbd5e1";
    for (let index = 0; index < 8; index += 1) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(obstacle.radius + 8, -4);
        ctx.lineTo(obstacle.radius - 2, 6);
        ctx.closePath();
        ctx.fill();
    }
    ctx.fillStyle = "#64748b";
    ctx.beginPath();
    ctx.arc(0, 0, obstacle.radius - 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawHammer(obstacle) {
    const bobX = obstacle.x + Math.sin(obstacle.swingTime) * 28;
    const bobY = obstacle.anchorY + obstacle.length * 0.7 + Math.cos(obstacle.swingTime * 1.4) * 16;

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(obstacle.x, obstacle.anchorY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();

    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(bobX, bobY, obstacle.bobRadius, 0, Math.PI * 2);
    ctx.fill();
}

function drawFire(obstacle) {
    const active = Math.sin(obstacle.cycleTime) > -0.15;
    const flameHeight = active ? 36 + Math.sin(obstacle.cycleTime * 3) * 6 : 10;

    ctx.fillStyle = "#7c2d12";
    ctx.fillRect(obstacle.x, obstacle.y + obstacle.height - 8, obstacle.width, 8);

    ctx.fillStyle = active ? "#fb923c" : "#9ca3af";
    ctx.beginPath();
    ctx.moveTo(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height - flameHeight);
    ctx.lineTo(obstacle.x, obstacle.y + obstacle.height);
    ctx.lineTo(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height - flameHeight / 2);
    ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + obstacle.height);
    ctx.closePath();
    ctx.fill();
}

function drawLaser(obstacle) {
    const active = Math.sin(obstacle.cycleTime) > 0;

    ctx.fillStyle = "#475569";
    ctx.fillRect(obstacle.x - 4, obstacle.y - 16, obstacle.width + 8, 16);
    ctx.fillRect(obstacle.x - 4, obstacle.y + obstacle.height, obstacle.width + 8, 16);

    ctx.fillStyle = active ? "rgba(244, 63, 94, 0.75)" : "rgba(148, 163, 184, 0.2)";
    ctx.shadowColor = active ? "#f43f5e" : "transparent";
    ctx.shadowBlur = active ? 12 : 0;
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    ctx.shadowBlur = 0;
}

function drawSpikes(obstacle) {
    ctx.fillStyle = "#a1a1aa";
    const spikeCount = 4;
    const spikeWidth = obstacle.width / spikeCount;

    for (let index = 0; index < spikeCount; index += 1) {
        const x = obstacle.x + index * spikeWidth;
        ctx.beginPath();
        ctx.moveTo(x, obstacle.y + obstacle.height);
        ctx.lineTo(x + spikeWidth / 2, obstacle.y);
        ctx.lineTo(x + spikeWidth, obstacle.y + obstacle.height);
        ctx.closePath();
        ctx.fill();
    }
}

function drawObstacle(obstacle) {
    if (obstacle.type === "blade") {
        drawBlade(obstacle);
        return;
    }

    if (obstacle.type === "hammer") {
        drawHammer(obstacle);
        return;
    }

    if (obstacle.type === "fire") {
        drawFire(obstacle);
        return;
    }

    if (obstacle.type === "laser") {
        drawLaser(obstacle);
        return;
    }

    drawSpikes(obstacle);
}

function drawEffects() {
    effects.forEach((effect) => {
        ctx.fillStyle = effect.color;
        ctx.globalAlpha = Math.max(effect.life * 2, 0);
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    });
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    obstacles.forEach(drawObstacle);
    drawPlayer();
    drawEffects();
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
        emptyItem.textContent = "No scores yet. Start surviving!";
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
        const response = await fetch("/api/leaderboard/obstacle");
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
        const response = await fetch("/api/score/obstacle", {
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

    if (["arrowleft", "arrowright", "arrowup", "a", "d", "w", " ", "p"].includes(key)) {
        event.preventDefault();
    }

    if (key === "arrowleft" || key === "a") {
        player.direction = -1;
    }

    if (key === "arrowright" || key === "d") {
        player.direction = 1;
    }

    if (key === "arrowup" || key === "w" || key === " ") {
        jump();
    }

    if (key === "p") {
        togglePause();
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
pauseButton.addEventListener("click", togglePause);
document.getElementById("jumpButton").addEventListener("click", jump);

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
