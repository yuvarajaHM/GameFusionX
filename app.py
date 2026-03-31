import os
from pathlib import Path
import sqlite3

from flask import Flask, abort, g, jsonify, render_template, request

app = Flask(__name__)
BASE_DIR = Path(__file__).resolve().parent
DATABASE = Path(os.environ.get("GAMEFUSIONX_DB", str(BASE_DIR / "scores.db")))

GAMES = {
    "car": {
        "title": "Car Racing Game",
        "subtitle": "Dodge weaving traffic and survive the speed climb.",
        "template": "car_game.html",
    },
    "bike": {
        "title": "Bike Riding Game",
        "subtitle": "Jump over barriers, grab speed boards, and ride farther.",
        "template": "bike_game.html",
    },
    "tower": {
        "title": "Tower Climbing Game",
        "subtitle": "Leap from platform to platform and climb as high as you can.",
        "template": "tower_game.html",
    },
    "shooting": {
        "title": "Target Shooting Game",
        "subtitle": "Click moving targets quickly before the timer runs out.",
        "template": "shooting_game.html",
    },
    "space": {
        "title": "Space Shooter Game",
        "subtitle": "Blast alien invaders before they reach your ship.",
        "template": "space_game.html",
    },
    "obstacle": {
        "title": "Obstacle Avoidance Game",
        "subtitle": "Jump, dodge, and survive spinning blades, lasers, and traps.",
        "template": "obstacle_game.html",
    },
}


# -----------------------------
# Database helper functions
# -----------------------------
def get_db():
    """Open one database connection per request."""
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_error=None):
    """Close the database connection after the request finishes."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    """Create the scores table and upgrade old databases if needed."""
    db = sqlite3.connect(DATABASE)
    cursor = db.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_name TEXT NOT NULL DEFAULT 'car',
            player_name TEXT NOT NULL,
            score INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    existing_columns = {
        column_info[1] for column_info in cursor.execute("PRAGMA table_info(scores)").fetchall()
    }
    if "game_name" not in existing_columns:
        cursor.execute("ALTER TABLE scores ADD COLUMN game_name TEXT NOT NULL DEFAULT 'car'")

    db.commit()
    db.close()


def fetch_top_scores(game_name, limit=10):
    """Return the best scores for one specific game."""
    rows = get_db().execute(
        """
        SELECT player_name, score, created_at
        FROM scores
        WHERE game_name = ?
        ORDER BY score DESC, created_at ASC
        LIMIT ?
        """,
        (game_name, limit),
    ).fetchall()
    return [dict(row) for row in rows]


def require_known_game(game_name):
    """Stop the request if the game key is not supported."""
    if game_name not in GAMES:
        abort(404, description=f"Unknown game '{game_name}'.")
    return game_name


# -----------------------------
# Page routes
# -----------------------------
@app.route("/")
def home():
    """Show the main dashboard with all available games."""
    return render_template("index.html", games=GAMES)


@app.route("/car-game")
def car_game():
    """Render the car racing game page."""
    return render_template("car_game.html", game=GAMES["car"])


@app.route("/bike-game")
def bike_game():
    """Render the bike riding game page."""
    return render_template("bike_game.html", game=GAMES["bike"])


@app.route("/tower-game")
def tower_game():
    """Render the vertical tower climbing game page."""
    return render_template("tower_game.html", game=GAMES["tower"])


@app.route("/shooting-game")
def shooting_game():
    """Render the target shooting game page."""
    return render_template("shooting_game.html", game=GAMES["shooting"])


@app.route("/space-game")
def space_game():
    """Render the retro alien invaders game page."""
    return render_template("space_game.html", game=GAMES["space"])


@app.route("/obstacle-game")
def obstacle_game():
    """Render the 2D obstacle avoidance game page."""
    return render_template("obstacle_game.html", game=GAMES["obstacle"])


@app.get("/health")
def health_check():
    """Simple health endpoint for deployment platforms and uptime checks."""
    return jsonify({"status": "ok", "app": "GameFusionX"})


@app.get("/leaderboard/<game_name>")
@app.get("/api/leaderboard/<game_name>")
def leaderboard(game_name):
    """Return a leaderboard as JSON for the selected game."""
    game_name = require_known_game(game_name)
    return jsonify({"game": game_name, "scores": fetch_top_scores(game_name, limit=10)})


@app.post("/save-score/<game_name>")
@app.post("/api/score/<game_name>")
def save_score(game_name):
    """Save a score for the selected game using JSON."""
    game_name = require_known_game(game_name)
    data = request.get_json(silent=True) or {}

    player_name = str(data.get("name", "Player")).strip()[:20] or "Player"

    try:
        score = int(data.get("score", 0))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Score must be a valid number."}), 400

    if score < 0:
        return jsonify({"success": False, "message": "Score must be zero or more."}), 400

    db = get_db()
    db.execute(
        "INSERT INTO scores (game_name, player_name, score) VALUES (?, ?, ?)",
        (game_name, player_name, score),
    )
    db.commit()

    return jsonify(
        {
            "success": True,
            "message": "Score saved successfully.",
            "game": game_name,
            "scores": fetch_top_scores(game_name, limit=10),
        }
    )


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(debug=debug, host="0.0.0.0", port=port)
else:
    init_db()
