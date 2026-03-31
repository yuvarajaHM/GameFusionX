const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const finalScore = document.getElementById("finalScore");
const gameOverScreen = document.getElementById("gameOverScreen");
const restartButton = document.getElementById("restartButton");
const leaderboardList = document.getElementById("leaderboardList");
const playerNameInput = document.getElementById("playerName");
const soundToggle = document.getElementById("soundToggle");
const skinButtons = document.querySelectorAll(".skin-btn");

const road = {
    x: 60,
    width: 240,
    laneCount: 3,
};

const player = {
    width: 46,
    height: 86,
    x: canvas.width / 2 - 23,
    y: canvas.height - 110,
    speed: 280,
    moveDirection: 0,
    color: "#38bdf8",
};

const game = {
    score: 0,
    obstacleSpeed: 220,
    spawnInterval: 1100,
    spawnTimer: 0,
    roadStripeOffset: 0,
    isGameOver: false,
    lastTime: 0,
    animationId: null,
    soundEnabled: true,
    scoreSaved: false,
};

let enemies = [];
let audioContext;

// Create a short crash sound using the Web Audio API.
function playCrashSound() {
    if (!game.soundEnabled) {
        return;
    }

    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(60, audioContext.currentTime + 0.25);

    gainNode.gain.setValueAtTime(0.12, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.25);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.25);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getLaneX(lane, width) {
    const laneWidth = road.width / road.laneCount;
    return road.x + lane * laneWidth + (laneWidth - width) / 2;
}

function resetGame() {
    enemies = [];
    player.x = canvas.width / 2 - player.width / 2;
    player.moveDirection = 0;

    game.score = 0;
    game.obstacleSpeed = 220;
    game.spawnInterval = 1100;
    game.spawnTimer = 0;
    game.roadStripeOffset = 0;
    game.isGameOver = false;
    game.lastTime = 0;
    game.scoreSaved = false;

    scoreValue.textContent = "0";
    finalScore.textContent = "0";
    gameOverScreen.classList.add("hidden");

    if (game.animationId) {
        cancelAnimationFrame(game.animationId);
    }

    game.animationId = requestAnimationFrame(gameLoop);
}

function drawRoad() {
    // Grass/background areas.
    ctx.fillStyle = "#14532d";
    ctx.fillRect(0, 0, road.x, canvas.height);
    ctx.fillRect(road.x + road.width, 0, canvas.width - (road.x + road.width), canvas.height);

    // Main road.
    ctx.fillStyle = "#374151";
    ctx.fillRect(road.x, 0, road.width, canvas.height);

    // Road edges.
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(road.x + 4, 0, 4, canvas.height);
    ctx.fillRect(road.x + road.width - 8, 0, 4, canvas.height);

    // Moving lane divider lines.
    const laneWidth = road.width / road.laneCount;
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";

    for (let lane = 1; lane < road.laneCount; lane += 1) {
        const x = road.x + lane * laneWidth - 3;
        for (let y = -40 + (game.roadStripeOffset % 60); y < canvas.height; y += 60) {
            ctx.fillRect(x, y, 6, 30);
        }
    }
}

function drawCar(x, y, width, height, color) {
    // Car body.
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);

    // Windshield.
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.fillRect(x + 8, y + 10, width - 16, 18);
    ctx.fillRect(x + 10, y + height - 30, width - 20, 14);

    // Tires.
    ctx.fillStyle = "#111827";
    ctx.fillRect(x - 4, y + 10, 6, 18);
    ctx.fillRect(x - 4, y + height - 28, 6, 18);
    ctx.fillRect(x + width - 2, y + 10, 6, 18);
    ctx.fillRect(x + width - 2, y + height - 28, 6, 18);

    // Headlights.
    ctx.fillStyle = "#fde68a";
    ctx.fillRect(x + 7, y + 4, 8, 6);
    ctx.fillRect(x + width - 15, y + 4, 8, 6);
}

function spawnEnemy() {
    const lane = Math.floor(Math.random() * road.laneCount);
    const width = 46;
    const height = 86;
    const colors = ["#ef4444", "#f59e0b", "#8b5cf6", "#22c55e", "#ec4899"];

    enemies.push({
        lane,
        targetLane: lane,
        x: getLaneX(lane, width),
        y: -height,
        width,
        height,
        color: colors[Math.floor(Math.random() * colors.length)],
        horizontalSpeed: 100 + Math.random() * 70,
        laneChangeCooldown: 0.7 + Math.random() * 1.4,
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

function endGame() {
    if (game.isGameOver) {
        return;
    }

    game.isGameOver = true;
    finalScore.textContent = Math.floor(game.score);
    gameOverScreen.classList.remove("hidden");
    playCrashSound();

    if (!game.scoreSaved) {
        game.scoreSaved = true;
        saveScore(Math.floor(game.score));
    }
}

function update(deltaTime) {
    if (game.isGameOver) {
        return;
    }

    // Move the player car and keep it inside the road.
    player.x += player.moveDirection * player.speed * deltaTime;
    player.x = clamp(player.x, road.x + 10, road.x + road.width - player.width - 10);

    // Increase score and difficulty over time.
    game.score += deltaTime * 12;
    game.obstacleSpeed = Math.min(520, 220 + game.score * 0.55);
    game.spawnInterval = Math.max(420, 1100 - game.score * 1.4);
    game.roadStripeOffset += game.obstacleSpeed * deltaTime;

    scoreValue.textContent = Math.floor(game.score);

    // Create new enemy cars at random intervals.
    game.spawnTimer += deltaTime * 1000;
    if (game.spawnTimer >= game.spawnInterval) {
        spawnEnemy();
        game.spawnTimer = 0;
    }

    // Move enemies downwards and let them occasionally switch lanes.
    enemies.forEach((enemy) => {
        enemy.y += game.obstacleSpeed * deltaTime;
        enemy.laneChangeCooldown -= deltaTime;

        if (enemy.laneChangeCooldown <= 0) {
            const possibleLanes = [enemy.targetLane - 1, enemy.targetLane + 1].filter(
                (lane) => lane >= 0 && lane < road.laneCount
            );

            if (possibleLanes.length > 0 && Math.random() < 0.8) {
                const randomIndex = Math.floor(Math.random() * possibleLanes.length);
                enemy.targetLane = possibleLanes[randomIndex];
            }

            enemy.laneChangeCooldown = 0.8 + Math.random() * 1.5;
        }

        const targetX = getLaneX(enemy.targetLane, enemy.width);
        const step = enemy.horizontalSpeed * deltaTime;

        if (Math.abs(targetX - enemy.x) <= step) {
            enemy.x = targetX;
            enemy.lane = enemy.targetLane;
        } else {
            enemy.x += Math.sign(targetX - enemy.x) * step;
        }
    });

    enemies = enemies.filter((enemy) => enemy.y < canvas.height + enemy.height);

    // Check collisions.
    for (const enemy of enemies) {
        if (isColliding(player, enemy)) {
            endGame();
            break;
        }
    }
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
    if (!game.lastTime) {
        game.lastTime = timestamp;
    }

    const deltaTime = Math.min((timestamp - game.lastTime) / 1000, 0.03);
    game.lastTime = timestamp;

    update(deltaTime);
    render();

    if (!game.isGameOver) {
        game.animationId = requestAnimationFrame(gameLoop);
    }
}

async function saveScore(score) {
    const payload = {
        name: playerNameInput.value.trim() || "Player",
        score,
    };

    try {
        const response = await fetch("/api/score", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error("Could not save the score.");
        }

        await loadLeaderboard();
    } catch (error) {
        console.error(error);
    }
}

async function loadLeaderboard() {
    try {
        const response = await fetch("/api/leaderboard");
        const data = await response.json();
        const scores = data.scores || [];

        if (scores.length === 0) {
            leaderboardList.innerHTML = "<li>No scores yet. Be the first racer!</li>";
            return;
        }

        leaderboardList.innerHTML = scores
            .map(
                (entry) =>
                    `<li><strong>${entry.player_name}</strong> - ${entry.score} <span>points</span></li>`
            )
            .join("");
    } catch (error) {
        leaderboardList.innerHTML = "<li>Leaderboard unavailable right now.</li>";
        console.error(error);
    }
}

function bindTouchControl(buttonId, direction) {
    const button = document.getElementById(buttonId);

    const press = (event) => {
        event.preventDefault();
        player.moveDirection = direction;
    };

    const release = (event) => {
        event.preventDefault();
        if (player.moveDirection === direction) {
            player.moveDirection = 0;
        }
    };

    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointerleave", release);
    button.addEventListener("pointercancel", release);
}

window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        player.moveDirection = -1;
    }

    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        player.moveDirection = 1;
    }

    if ((event.key === " " || event.key === "Enter") && game.isGameOver) {
        resetGame();
    }
});

window.addEventListener("keyup", (event) => {
    if (["ArrowLeft", "ArrowRight", "a", "d", "A", "D"].includes(event.key)) {
        player.moveDirection = 0;
    }
});

restartButton.addEventListener("click", resetGame);

document.getElementById("leftButton").addEventListener("click", () => {
    player.moveDirection = -1;
    setTimeout(() => {
        if (player.moveDirection === -1) {
            player.moveDirection = 0;
        }
    }, 120);
});

document.getElementById("rightButton").addEventListener("click", () => {
    player.moveDirection = 1;
    setTimeout(() => {
        if (player.moveDirection === 1) {
            player.moveDirection = 0;
        }
    }, 120);
});

bindTouchControl("leftButton", -1);
bindTouchControl("rightButton", 1);

soundToggle.addEventListener("click", () => {
    game.soundEnabled = !game.soundEnabled;
    soundToggle.textContent = game.soundEnabled ? "🔊 Sound On" : "🔇 Sound Off";
});

skinButtons.forEach((button) => {
    button.addEventListener("click", () => {
        skinButtons.forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        player.color = button.dataset.color;
    });
});

loadLeaderboard();
resetGame();
