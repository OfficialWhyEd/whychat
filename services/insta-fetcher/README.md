# WhyInsta fetcher

Il servizietto che dà a **WhyInsta** gli occhi: scarica il video di un link
social (Instagram reel/post, e anche TikTok/YouTube) e lo restituisce al Worker
WhyChat, che lo passa a Gemini perché lo *guardi davvero*.

È l'**unico pezzo** di WhyInsta che gira fuori da Cloudflare — un Worker non può
scaricare un reel da solo (Instagram blocca gli IP datacenter). Lo deployi una
volta, copi l'URL in un secret del Worker, e WhyInsta funziona per tutti.

```
WhyChat (browser) → Worker /api/insta → [questo servizio] /fetch → Gemini guarda
```

## API

`POST /fetch`
```json
{ "url": "https://www.instagram.com/reel/XXXX/" }
```
→
```json
{ "video_base64": "...", "mime": "video/mp4",
  "caption": "...", "title": "...", "uploader": "...", "duration": 12 }
```
Header opzionale `x-fetcher-secret` (vedi sotto). `GET /health` → `{ "ok": true }`.

## Prova in locale (30 secondi)

```bash
cd services/insta-fetcher
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
# in un altro terminale:
curl -s localhost:8080/fetch -H 'content-type: application/json' \
  -d '{"url":"https://www.instagram.com/reel/XXXX/"}' | head -c 300
```

## Deploy (scegline uno)

### A) Fly.io — un comando
```bash
cd services/insta-fetcher
fly launch --now            # crea l'app dal Dockerfile e la mette online
# (opzionale) protezione: stesso valore qui e nel Worker
fly secrets set FETCHER_SHARED_SECRET="una-passphrase-lunga"
```
L'URL sarà tipo `https://whyinsta-fetcher.fly.dev`.

### B) Render.com — dal browser
New → **Web Service** → punta a questa cartella → runtime **Docker** → Deploy.

### C) Google Cloud Run
```bash
gcloud run deploy whyinsta-fetcher --source . --region europe-west1 --allow-unauthenticated
```

## Aggancia al Worker WhyChat

Dal repo privato `whychat-core`, una riga:
```bash
printf '%s' 'https://whyinsta-fetcher.fly.dev' | \
  CLOUDFLARE_API_TOKEN=$(security find-generic-password -s cloudflare-workers-deploy-token -w) \
  npx --yes wrangler secret put FETCHER_URL
# se hai messo il secret condiviso, anche:
printf '%s' 'una-passphrase-lunga' | npx --yes wrangler secret put FETCHER_SHARED_SECRET
```
Fatto. Finché `FETCHER_URL` non è impostato, WhyInsta risponde con un messaggio
guida (niente crash) — quindi puoi shippare il frontend anche prima del deploy.

## Variabili d'ambiente

| Variabile | Default | A cosa serve |
|---|---|---|
| `FETCHER_MAX_BYTES` | `12582912` (12MB) | Limite scarico. Oltre ~8MB il Worker non fa l'analisi inline. |
| `FETCHER_SHARED_SECRET` | _(vuoto)_ | Se impostato, richiede l'header `x-fetcher-secret`. Tienilo = al secret del Worker. |
| `FETCHER_COOKIES` | _(vuoto)_ | Path a un `cookies.txt` per contenuti login-only (v1: solo pubblici consigliato). |

## Limiti onesti
- Reel > ~8MB: non analizzati per intero finché il Worker non usa la Files API di Gemini (v2).
- Contenuti privati: servono cookie del tuo account (`FETCHER_COOKIES`); per uso personale.
- ToS Instagram/yt-dlp: uso personale. Non trasformarlo in un servizio pubblico massivo.
