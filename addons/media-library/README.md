## Media Library Home Assistant Add-on

- **Ports:** `8787` (API + UI)
- **Description:** Runs the Vue 3 frontend and Express backend together as a single containerized add-on.

### Configuration

- `PORT` (int): Backend listening port; frontend uses the same value for `VITE_API_URL`.
- `VITE_API_URL` (string): Base URL for backend API (default `http://localhost:8787/api`).

### Startup

1. Add the repository (`repository.json`) via **Supervisor → Add-on Store → Repositories** using `https://github.com/NikolausStoll/media-library`.
2. Install the **Media Library** add-on from your local store.
3. Optionally adjust `PORT`/`VITE_API_URL` in the add-on configuration tab.
4. Start the add-on. It runs `run.sh`, which builds the frontend (`npm run build`) and launches `npm run start:backend`.
5. Access the UI/API at `http://<your-ha-host>:<PORT>/`.

### Notes

- `run.sh` lives in the repository root so the add-on can share the frontend build logic with local/manual runs.
- The add-on exposes `/api/...` endpoints on the same port (e.g., `/api/games`, `/api/series`).
