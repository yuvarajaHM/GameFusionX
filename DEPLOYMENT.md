# GameFusionX Deployment Guide

## Option 1: Render
1. Push this project to GitHub.
2. Create a new **Web Service** on Render.
3. Connect the repository.
4. Render will detect `render.yaml` automatically.
5. Deploy and open the generated URL.

## Option 2: Railway / Heroku-like platforms
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn wsgi:app`

## Local production-style run
```bash
pip install -r requirements.txt
python -m waitress --listen=127.0.0.1:8000 wsgi:app
```

## Notes
- Scores are stored in `scores.db` using SQLite.
- On some free hosts, SQLite data may reset when the container restarts.
- For persistent production storage, switch to PostgreSQL or MySQL later.
