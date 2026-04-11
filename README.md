
# Superstore DuckDB Dashboard

This version uses a real DuckDB database file instead of reading `superstore.csv` directly at request time.

## Structure

- `backend/superstore.duckdb` — DuckDB database file
- `backend/app.py` — FastAPI backend reading from DuckDB
- `backend/init_db.py` — rebuilds the DuckDB file from `backend/superstore.csv`
- `frontend/` — React + Vite dashboard UI

## Why this version

Your previous Node backend was blocked by the native `duckdb` package on Node 23. This version avoids that by:

- keeping DuckDB as the data engine
- moving the backend to Python + FastAPI
- keeping the React frontend

## Run the backend

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app:app --reload --port 8000
```

Health check:

- `http://localhost:8000/`
- `http://localhost:8000/api/health`
- `http://localhost:8000/api/dashboard?month=2026-02`

## Rebuild the database from CSV

If you replace `backend/superstore.csv` with another CSV that uses the same column names, rebuild the DB:

```bash
cd backend
python init_db.py
```

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

By default the frontend calls `http://localhost:8000`.

If needed, set a different backend URL:

```bash
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

## Important note about "frontend using DuckDB"

In this version, the frontend talks to a backend that queries DuckDB.

That is the safest architecture for your Mac right now.

If you want the browser itself to run DuckDB directly, the next step would be a separate version using **DuckDB-Wasm**.
