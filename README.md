# Vixi File Storage — Personal File Vault for your LAN

Vixi is a self-hosted file storage app for your local network. Host it on a Raspberry Pi (or any Node-capable box) reachable from your LAN, sign in as admin, create invite links for others on the same network, and upload/download your files. Each user gets isolated storage; owners can share individual files or folders with read or read+write permissions.

- **Frontend**: React 18 + Vite + TypeScript + Tailwind + shadcn-style UI primitives
- **Backend**: Node.js 20 + Express + TypeScript
- **Object storage**: Cloudflare R2 (S3-compatible, free 10 GB + free egress)
- **Database**: MongoDB Atlas (free M0 tier)
- **Auth**: JWT, single-use invite-token signup, admin bootstrap on first boot

---

## Repository layout

```
vixi-file-storage/
├── package.json            npm workspaces root
├── .env.example            sample env — copy to .env and fill in
├── .gitignore
├── server/                 Node + Express API
│   ├── src/
│   │   ├── config/         env, db, r2
│   │   ├── models/         User, Invite, Folder, File, Share (Mongoose)
│   │   ├── middleware/     auth, zod validation, error handlers
│   │   ├── routes/         auth, admin, folders, files, shares
│   │   ├── services/       r2Service, inviteService, bootstrap
│   │   └── app.ts + index.ts
│   └── package.json
└── client/                 Vite + React + TS
    ├── src/
    │   ├── pages/          Login, InviteSignup, Dashboard, Admin
    │   ├── components/
    │   │   ├── ui/         shadcn-style primitives (button, card, dialog, ...)
    │   │   ├── files/
    │   │   └── admin/
    │   ├── hooks/useAuth.tsx
    │   └── lib/api.ts      typed API client
    └── package.json
```

---

## 1. Prerequisites

- **Node.js 20+** and **npm 10+** on your Pi/box
- **MongoDB Atlas** free M0 cluster — copy the `mongodb+srv://...` SRV connection string
- **Cloudflare R2** — sign up at dash.cloudflare.com → R2:
  1. Create a bucket (e.g. `vixi`)
  2. Manage R2 API tokens → Create token with **Object Read & Write** on that bucket
  3. Note: `Account ID`, `Access Key ID`, `Secret Access Key`, and the bucket's S3 endpoint (`https://<account_id>.r2.cloudflarestorage.com`)
- **Local network**: A device you can reach from your phone/laptop. A Pi 5 4GB is plenty.

---

## 2. Install

```bash
cd vixi-file-storage
npm install        # installs both workspaces
```

---

## 3. Configure environment

```bash
cp .env.example .env
nano .env
```

Fill in:

| Key | Value |
|---|---|
| `JWT_SECRET` | `openssl rand -hex 48` |
| `ADMIN_EMAIL` | your admin email (e.g. `admin@vixi.local`) |
| `ADMIN_PASSWORD` | a strong password (used once on first boot) |
| `MONGODB_URI` | your Atlas SRV string, e.g. `mongodb+srv://USER:PASS@cluster.mongodb.net/?appName=VixiLocalNetwork` |
| `MONGODB_DB` | `vixi` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET` | from Cloudflare R2 dashboard |
| `PUBLIC_BASE_URL` | how the app is reachable from your LAN, e.g. `http://vixi.local` (see step 6 below) |
| `CLIENT_ORIGIN` | same as `PUBLIC_BASE_URL` |
| `PORT` | 8080 (the API port) |

> ⚠️ **Never commit `.env`**. It's already in `.gitignore`. Rotate any credentials that you've shared publicly.

Let MongoDB Atlas allow your home IP: Atlas → Network Access → Add IP address (or `0.0.0.0/0` — less secure, not recommended).

---

## 4. Run in development

```bash
npm run dev
```

- API listens on `http://localhost:8080`
- Vite dev server on `http://localhost:5173` (proxies `/api/*` to the API)

---

## 5. Build & run for production (on the Pi)

```bash
npm run build

# Serve the React build + run the API
# Option A — install a static server for the React dist:
npm install -g serve
serve -s client/dist -l 3000 &

# Then start the API:
npm start
```

For a clean single-port setup, put a reverse proxy in front (nginx or HAProxy) — see step 6.

### Recommended: nginx on the Pi serving React + proxying `/api` to Node

```nginx
# /etc/nginx/sites-available/vixi
server {
    listen 80;
    server_name vixi.local;

    root /home/<you>/vixi-file-storage/client/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 0;   # no upload size limit at proxy layer
    }

    location / {
        try_files $uri $uri/ /index.html;   # SPA fallback
    }
}
```

Enable and restart:

```bash
sudo ln -s /etc/nginx/sites-available/vixi /etc/nginx/sites-enabled/vixi
sudo nginx -t
sudo systemctl restart nginx
```

Run the API as a background service — simplest is `pm2`:

```bash
npm install -g pm2
pm2 start "npm start" --name vixi-api
pm2 save
pm2 startup        # follow the instructions to autostart at boot
```

---

## 6. Reach it as `http://vixi.local` from any LAN device (mDNS)

This is the **simplest path** described in our DNS notes — uses Avahi/mDNS broadcasting so no router changes are needed. Modern iOS/macOS/Android/Windows support it natively.

### On the Pi

```bash
# 1. Set the hostname to "vixi"
sudo hostnamectl set-hostname vixi

# 2. Install Avahi (mDNS broadcaster)
sudo apt install avahi-daemon -y
sudo systemctl enable --now avahi-daemon

# 3. Make sure nginx listens on port 80 (see step 5) and starts at boot
sudo systemctl enable nginx
```

Now from your phone/laptop on the **same Wi-Fi**, open `http://vixi.local` — it resolves automatically to the Pi.

> If you'd instead like a custom domain like `vixi.home` with full router DNS control, follow Phase 1 (Dnsmasq) and Phase 2 (HAProxy) of the local DNS guide. The mDNS approach is simpler and works for personal home networks.

---

## 7. First boot — admin login

1. Start the API. On first startup it will print:
   ```
   ✓ Admin bootstrap complete (admin@vixi.local)
   ```
   This happens **only** when the `users` collection is empty. It uses `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`. **Change the password after first login**.
2. Open `http://vixi.local` → sign in as admin.
3. Go to **Admin** → **New invite** → copy the link (`http://vixi.local/invite/<token>`).
4. Open the link on another device or incognito → sign up.
5. The new user lands in their own isolated file vault.

---

## 8. How storage & versions work

- Each user's files live under the R2 prefix `u/<userId>/<folderId|unfiled>/<fileName>/v<n>`
- Each overwrite creates a new `v<n>` object (immutable); Mongoose `FileDoc.currentVersion` points to the latest
- Mongo never stores file contents — only metadata, folder structure, and version history
- Download URLs are **presigned** (R2, 10-minute TTL) — the browser downloads directly from R2, not through the API

---

## 9. Sharing

- Any folder/file owner can generate a share link from the Dashboard via the Share icon
- Choose **read** or **read+write** permission
- Optionally target a specific user by email (becomes scope=`direct`)
- Link holders with an active account can accept shares at `/share/:token`; accepted shares appear in the share list of both owner and recipient

---

## 10. API overview

| Area | Method & path |
|---|---|
| Sign up via invite | `POST /api/auth/signup` |
| Login | `POST /api/auth/login` |
| Current user | `GET /api/auth/me` |
| Invite metadata (public) | `GET /api/auth/invite/:token` |
| List/create/revoke invites (admin) | `GET POST /api/admin/invites`, `DELETE /api/admin/invites/:token` |
| List/update/delete users (admin) | `GET /api/admin/users`, `PATCH DELETE /api/admin/users/:id` |
| Folder CRUD | `GET POST /api/folders`, `PATCH DELETE /api/folders/:id` |
| File list | `GET /api/files?parent=null\|<folderId>` |
| Begin upload (get presigned PUT URL) | `POST /api/files/begin-upload` |
| Commit upload (save metadata + version) | `POST /api/files/commit` |
| Download (presigned GET URL) | `GET /api/files/:id/download?version=<n>` |
| Version history | `GET /api/files/:id/versions` |
| Rename / delete | `PATCH /api/files/:id/rename`, `DELETE /api/files/:id` |
| Share CRUD | `POST /api/shares`, `GET /api/shares`, `GET /api/shares/:token`, `POST /api/shares/:token/accept`, `DELETE /api/shares/:token/revoke` |

---

## 11. Security notes

- `.env` and any directories named `data/` are gitignored. Verify in `git status` before any commit.
- **Rotate credentials immediately** if you ever paste them into chat, screenshots, or commits.
- The admin password is only consumed at bootstrap. Change it via the login UI right after first run.
- JWT is stored in `localStorage` (acceptable for a self-hosted tool on a trusted LAN; for internet exposure, move to httpOnly cookies + CSRF tokens).
- See `iptables` / router firewall if you want to prevent the Pi from being reachable outside your LAN. (It should not be — your router's NAT will already do that.)

---

## 12. Update Pi system packages periodically

```bash
sudo apt update && sudo apt upgrade -y
```

---

*Built as a personal file vault. Adjust IPs, ports, hostnames, and credentials to match your actual setup.*
