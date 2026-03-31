const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const playerNameInput = document.getElementById("playerName");
const scoreValue = document.getElementById("scoreValue");
const livesValue = document.getElementById("livesValue");
const statusValue = document.getElementById("statusValue");
const finalScore = document.getElementById("finalScore");
const overlayTitle = document.getElementById("overlayTitle");
const leaderboardList = document.getElementById("leaderboardList");
const gameOverScreen = document.getElementById("gameOverScreen");
const restartButton = document.getElementById("restartButton");
const soundToggle = document.getElementById("soundToggle");

const player = {
    width: 42,
    height: 26,
    x: canvas.width / 2 - 21,
    y: canvas.height - 54,
    speed: 320,
};

const state = {
    moveLeft: false,
    moveRight: false,
    score: 0,
    lives: 3,
    isGameOver: false,
    isWin: false,
    soundEnabled: window.GameFusionMusic ? window.GameFusionMusic.isEnabled() : true,
    scoreSaved: false,
    lastTime: 0,
    animationId: null,
    bulletCooldown: 0,
    enemyDirection: 1,
    enemySpeed: 28,
    enemyShootTimer: 0,
};

let bullets = [];
let enemyBullets = [];
let enemies = [];
let particles = [];
let audioContext = null;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function playTone(startFrequency, endFrequency, duration, type = "square") {
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

function updateHud() {
    scoreValue.textContent = state.score;
    livesValue.textContent = state.lives;

    if (state.isGameOver && state.isWin) {
        statusValue.textContent = "Victory";
        statusValue.className = "hud-number small-number status-good";
    } else if (state.isGameOver) {
        statusValue.textContent = "Defeat";
        statusValue.className = "hud-number small-number status-danger";
    } else if (state.lives === 1) {
        statusValue.textContent = "Danger";
        statusValue.className = "hud-number small-number status-warn";
    } else {
        statusValue.textContent = "Fighting";
        statusValue.className = "hud-number small-number status-good";
    }
}

function makeEnemies() {
    enemies = [];
    const rowColors = ["#f472b6", "#a78bfa", "#38bdf8", "#34d399"];

    for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 8; col += 1) {
            enemies.push({
                x: 38 + col * 42,
                y: 50 + row * 38,
                width: 28,
                height: 20,
                color: rowColors[row],
                points: (4 - row) * 10,
                type: row,
            });
        }
    }
}

function resetGame() {
    player.x = canvas.width / 2 - player.width / 2;
    bullets = [];
    enemyBullets = [];
    particles = [];
    makeEnemies();

    state.moveLeft = false;
    state.moveRight = false;
    state.score = 0;
    state.lives = 3;
    state.isGameOver = false;
    state.isWin = false;
    state.scoreSaved = false;
    state.lastTime = 0;
    state.bulletCooldown = 0;
    state.enemyDirection = 1;
    state.enemySpeed = 28;
    state.enemyShootTimer = 0;

    finalScore.textContent = "0";
    overlayTitle.textContent = "Game Over";
    gameOverScreen.classList.add("hidden");
    updateHud();

    if (state.animationId) {
        cancelAnimationFrame(state.animationId);
    }

    state.animationId = requestAnimationFrame(gameLoop);
}

function createExplosion(x, y, color) {
    for (let index = 0; index < 14; index += 1) {
        const angle = (Math.PI * 2 * index) / 14;
        const speed = 50 + Math.random() * 90;
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.45 + Math.random() * 0.2,
            size: 2 + Math.random() * 2,
            color,
        });
    }
}

function firePlayerBullet() {
    if (state.isGameOver || state.bulletCooldown > 0) {
        return;
    }

    bullets.push({
        x: player.x + player.width / 2 - 2,
        y: player.y - 10,
        width: 4,
        height: 12,
        speed: 440,
    });

    state.bulletCooldown = 0.22;
    playTone(880, 420, 0.08, "sawtooth");
}

function fireEnemyBullet() {
    if (!enemies.length) {
        return;
    }

    const shooter = enemies[Math.floor(Math.random() * enemies.length)];
    enemyBullets.push({
        x: shooter.x + shooter.width / 2 - 2,
        y: shooter.y + shooter.height,
        width: 4,
        height: 12,
        speed: 220,
    });
}

function intersects(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function endGame(isWin = false) {
    if (state.isGameOver) {
        return;
    }

    state.isGameOver = true;
    state.isWin = isWin;
    finalScore.textContent = state.score;
    overlayTitle.textContent = isWin ? "You Win!" : "Game Over";
    gameOverScreen.classList.remove("hidden");
    playTone(isWin ? 520 : 240, isWin ? 940 : 80, 0.3, isWin ? "triangle" : "square");
    updateHud();

    if (!state.scoreSaved) {
        state.scoreSaved = true;
        saveScore(state.score);
    }
}

function update(deltaTime) {
    if (state.isGameOver) {
        return;
    }

    if (state.moveLeft) {
        player.x -= player.speed * deltaTime;
    }
    if (state.moveRight) {
        player.x += player.speed * deltaTime;
    }
    player.x = clamp(player.x, 10, canvas.width - player.width - 10);

    state.bulletCooldown = Math.max(0, state.bulletCooldown - deltaTime);
    state.enemyShootTimer += deltaTime;

    bullets.forEach((bullet) => {
        bullet.y -= bullet.speed * deltaTime;
    });
    bullets = bullets.filter((bullet) => bullet.y + bullet.height > 0);

    enemyBullets.forEach((bullet) => {
        bullet.y += bullet.speed * deltaTime;
    });
    enemyBullets = enemyBullets.filter((bullet) => bullet.y < canvas.height + bullet.height);

    let hitEdge = false;
    enemies.forEach((enemy) => {
        enemy.x += state.enemyDirection * state.enemySpeed * deltaTime;
        if (enemy.x <= 12 || enemy.x + enemy.width >= canvas.width - 12) {
            hitEdge = true;
        }
    });

    if (hitEdge) {
        state.enemyDirection *= -1;
        enemies.forEach((enemy) => {
            enemy.y += 16;
        });
        state.enemySpeed = Math.min(110, state.enemySpeed + 6);
    }

    if (state.enemyShootTimer >= 1.2) {
        fireEnemyBullet();
        state.enemyShootTimer = 0;
    }

    for (let bulletIndex = bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
        const bullet = bullets[bulletIndex];

        for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
            const enemy = enemies[enemyIndex];
            if (!intersects(bullet, enemy)) {
                continue;
            }

            state.score += enemy.points;
            createExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color);
            playTone(240, 120, 0.09, "triangle");
            bullets.splice(bulletIndex, 1);
            enemies.splice(enemyIndex, 1);
            break;
        }
    }

    const playerHitbox = {
        x: player.x,
        y: player.y,
        width: player.width,
        height: player.height,
    };

    for (let index = enemyBullets.length - 1; index >= 0; index -= 1) {
        if (!intersects(enemyBullets[index], playerHitbox)) {
            continue;
        }

        enemyBullets.splice(index, 1);
        state.lives -= 1;
        createExplosion(player.x + player.width / 2, player.y + player.height / 2, "#f87171");
        playTone(180, 90, 0.14, "sawtooth");

        if (state.lives <= 0) {
            endGame(false);
            return;
        }
    }

    if (enemies.some((enemy) => enemy.y + enemy.height >= player.y - 4)) {
        endGame(false);
        return;
    }

    if (!enemies.length) {
        endGame(true);
        return;
    }

    particles.forEach((particle) => {
        particle.x += particle.vx * deltaTime;
        particle.y += particle.vy * deltaTime;
        particle.life -= deltaTime;
    });
    particles = particles.filter((particle) => particle.life > 0);

    updateHud();
}

function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#020617");
    gradient.addColorStop(1, "#111827");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    for (let i = 0; i < 35; i += 1) {
        const x = (i * 73) % canvas.width;
        const y = (i * 97) % canvas.height;
        ctx.fillRect(x, y, 2, 2);
    }
}

function drawPlayer() {
    ctx.save();
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(player.x + player.width / 2 - 4, player.y + 8, 8, 12);
    ctx.restore();
}

function drawEnemies() {
    enemies.forEach((enemy) => {
        ctx.save();
        ctx.shadowColor = enemy.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = enemy.color;
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(enemy.x + 4, enemy.y + 5, 5, 5);
        ctx.fillRect(enemy.x + enemy.width - 9, enemy.y + 5, 5, 5);
        ctx.fillRect(enemy.x + 8, enemy.y + enemy.height - 5, enemy.width - 16, 3);
        ctx.restore();
    });
}

function drawBullets() {
    bullets.forEach((bullet) => {
        ctx.save();
        ctx.shadowColor = "#22c55e";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#86efac";
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        ctx.restore();
    });

    enemyBullets.forEach((bullet) => {
        ctx.save();
        ctx.shadowColor = "#f97316";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#fb923c";
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        ctx.restore();
    });
}

function drawParticles() {
    particles.forEach((particle) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, particle.life * 1.8);
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
        ctx.restore();
    });
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawEnemies();
    drawBullets();
    drawParticles();
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
        const item = document.createElement("li");
        item.textContent = "No scores yet. Defend the galaxy!";
        leaderboardList.appendChild(item);
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
        const response = await fetch("/api/leaderboard/space");
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
        const response = await fetch("/api/score/space", {
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

window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (["arrowleft", "arrowright", "a", "d", " ", "spacebar", "enter"].includes(key)) {
        event.preventDefault();
    }

    if (key === "arrowleft" || key === "a") {
        state.moveLeft = true;
    }

    if (key === "arrowright" || key === "d") {
        state.moveRight = true;
    }

    if (key === " " || key === "spacebar") {
        firePlayerBullet();
    }

    if (key === "enter" && state.isGameOver) {
        resetGame();
    }
});

window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();

    if (key === "arrowleft" || key === "a") {
        state.moveLeft = false;
    }

    if (key === "arrowright" || key === "d") {
        state.moveRight = false;
    }
});

function bindDirectionalButton(buttonId, direction) {
    const button = document.getElementById(buttonId);

    const press = (event) => {
        event.preventDefault();
        if (direction < 0) {
            state.moveLeft = true;
        } else {
            state.moveRight = true;
        }
    };

    const release = (event) => {
        event.preventDefault();
        if (direction < 0) {
            state.moveLeft = false;
        } else {
            state.moveRight = false;
        }
    };

    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointerleave", release);
    button.addEventListener("pointercancel", release);
}

bindDirectionalButton("leftButton", -1);
bindDirectionalButton("rightButton", 1);
document.getElementById("shootButton").addEventListener("click", firePlayerBullet);
restartButton.addEventListener("click", resetGame);

soundToggle.addEventListener("click", () => {
    state.soundEnabled = window.GameFusionMusic
        ? window.GameFusionMusic.toggle()
        : !state.soundEnabled;
    soundToggle.textContent = state.soundEnabled ? "🔊 Sound On" : "🔇 Sound Off";
});

updateHud();
loadLeaderboard();
resetGame();
