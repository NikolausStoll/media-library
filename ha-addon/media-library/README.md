## Media Library (prebuilt) Home Assistant Add-on

1. Add this repository under **Supervisor › Add-on Store › Repositories** (URL: `https://github.com/NikolausStoll/media-library`).
2. Install **Media Library** (the entry with `media-library` slug).
3. Configure options (port, database path, static directory) if you need custom paths.
4. Start the add-on and open it via the Ingress button (`OPEN WEB UI`).

### Notes

- The add-on uses a prebuilt Docker image, so HA only needs to pull and run the container (no build on HA).
- Data is persisted in `/data/backend.db`, so mount a volume to keep your library between restarts.
