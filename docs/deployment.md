# Deployment

CarLink can run as a Vite PWA plus the bundled Node API server.

## Required production environment

- `NODE_ENV=production`
- `PORT`
- `CORS_ORIGIN=https://your-domain`
- `OPENAI_API_KEY` for real OCR/image analysis
- `OPENAI_VISION_MODEL=gpt-4.1-mini` or another vision-capable model

The app uses the OpenAI Responses API for image input when `OPENAI_API_KEY` is present. If the key is absent or the API fails, the server returns a local fallback so listing flow remains usable during development.

## HTTPS

Camera capture, installable PWA behavior, secure cookies, and Web NFC are production features that should be served through HTTPS.

Recommended production setup:

1. Build with `npm run build`.
2. Run `npm run api` behind a platform HTTPS endpoint or reverse proxy.
3. Set `CORS_ORIGIN` to the public domain.

Optional direct HTTPS for local device testing:

```sh
mkdir -p certs
mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost 127.0.0.1 ::1
npm run build
npm run api:https
```

Then open `https://<PCのローカルIP>:8787` from a phone on the same network. Some phones require trusting the local certificate.

## Authentication

The current implementation includes a lightweight session login:

- `POST /api/auth/login`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `GET /api/users`

For a real launch, replace this with phone/SMS verification, eKYC, rate limiting, passwordless login, and database-backed sessions.

## Electronic vehicle certificate / NFC

The frontend uses Web NFC when available. Web NFC support is limited, mainly Android Chrome, and it requires HTTPS. iOS Safari does not generally expose Web NFC to web apps, so production should keep the photo/OCR path as the reliable fallback or wrap native NFC through Capacitor/React Native.

## Deploy targets

- Render/Railway/Fly.io: can run the bundled Node API as a single service. Use `Dockerfile`, `render.yaml`, or `railway.json`.
- Vercel/Netlify: good for frontend-only previews, but the file-based API persistence here should be replaced with a database/serverless storage.
- AWS/GCP/Azure: use managed TLS, object storage for images, PostgreSQL, and a job queue for OCR.

## Render quick start

1. Push this folder to GitHub.
2. In Render, create a new Blueprint or Web Service from the repository.
3. Use `render.yaml` or set:
   - Build command: `npm ci && npm run check`
   - Start command: `node server/index.mjs`
   - Health check path: `/api/health`
   - Instance type: Free
4. Add `OPENAI_API_KEY` and `CORS_ORIGIN` in Render environment variables.

## Railway quick start

1. Push this folder to GitHub.
2. Create a Railway project from the repository.
3. Railway will use `railway.json` and `Dockerfile`.
4. Add `OPENAI_API_KEY`, `CORS_ORIGIN`, and `NODE_ENV=production`.
