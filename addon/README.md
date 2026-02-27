## Media Library Home Assistant Add-on

- **Ports:** `8787` (both backend API and frontend UI)
- **Purpose:** Runs the Vue + Express Media Library fullstack app as a single containerized addon.

### Configuration options

- `PORT` (int): backend listening port. This is the same port the frontend will use for its `VITE_API_URL`.
- `VITE_API_URL` (string): base API URL exposed to the frontend. Leave as `http://localhost:8787/api` if you keep the default port mapping.

### Startup

The add-on installs dependencies, builds the Vite frontend, and starts the Express backend. The bundled server serves the `dist/` assets so visiting `http://<addon-host>:8787/` opens the app.
