# WhyInsta — design (2026-06-26)

> Modalità WhyChat: incolli un **link Instagram** (reel/post) e WhyChat lo **capisce davvero**
> — trascrizione del parlato, descrizione delle scene, testo a schermo, caption — e poi ci
> chiacchieri sopra + analisi del "perché funziona". Estendibile a TikTok/YouTube (stesso fetcher).

## Origine
Da un diagramma "Perceptor" (IRC + streamlink + VAD/ASR/VLM) che Edo ha trovato in un video.
Due idee intrecciate:
1. **Bot-streamer** (futuro): un AI che guarda una live e parla in chat. Userà lo stack Python
   completo (streamlink, IRC, faster-whisper, Qwen2-VL su GPU). **PARCHEGGIATO.**
2. **WhyInsta** (questo spec, ora): WhyChat capisce un contenuto condiviso da Instagram.

## Decisione chiave: niente stack Python locale
WhyChat usa già **Gemini**, che è un VLM multimodale: gli passi il **video intero** e in *una
chiamata* fa trascrizione + descrizione scene + lettura testo a schermo. Tutta la pipeline del
diagramma (`PyAV + perceptual hashing + faster-whisper + Qwen2-VL`) collassa in un prompt.
→ **Qwen2-VL NON serve** per WhyInsta (avrebbe senso solo self-hosted/GPU per il bot-streamer).
Vantaggio: zero ML locale → nessun problema col Mac Intel/Monterey.

## Il nodo: link IG → byte del video
Un Worker non può scaricare un reel da solo (IG blocca bot/IP datacenter, richiede login).
**Approccio A (scelto): microservizio yt-dlp** dietro un'interfaccia pluggabile.
- Tutto il codice WhyChat è completo e funzionante *ora*.
- Un solo punto di config: `FETCHER_URL` (secret del Worker).
- Finché `FETCHER_URL` non è settato, WhyInsta risponde con un messaggio guida (no crash).
- yt-dlp gestisce anche TikTok/YouTube → "WhyInsta" diventa "qualsiasi link social".

## Architettura
**Frontend** (repo pubblico WhyChat)
- `CommandComposer.tsx`: nuova `Mode "insta"` + voce in `MODES` (icona Instagram, tag "beta").
- `lib/api.ts`: `streamInsta(url, prompt, history, onToken, visitorId, name)` → SSE da `/api/insta`.
- `App.tsx`: in modalità insta, se il messaggio contiene un URL IG/social → instrada a `streamInsta`;
  altrimenti chiede gentilmente un link. Riconoscimento URL via `SOCIAL_URL_RE`.
- Rendering: messaggio assistant normale (markdown/ChatMessage). Nessuna UI nuova → riuso totale.

**Worker** (repo privato whychat-core)
- `MODE_HINTS.insta`: persona "stai guardando un contenuto social condiviso".
- `handleInsta()` (clone di `handleSee`): 
  1. `fetchMedia(url)` → `POST FETCHER_URL {url}` → `{ video_base64, mime, caption, meta }`.
  2. costruisce `inlineData` (video) + caption come testo nel contesto.
  3. system prompt WhyInsta → **dossier**: trascrizione · scene · testo a schermo · caption ·
     "perché funziona" (hook/ritmo/formula, in linea col lavoro di Edo sui video virali).
  4. stream SSE identico a handleSee.
- routing: `if (url.pathname === "/api/insta") return handleInsta(...)`.
- guardia dimensione: video inline ≤ ~8MB (come handleSee `.slice(8_000_000)`); se più grande →
  messaggio onesto ("reel troppo pesante per l'analisi inline", v2 = Files API di Gemini).

**Fetcher** (`services/insta-fetcher/`)
- Microservizio minimale (FastAPI + yt-dlp) che Edo deploya una volta (Fly/Render/Container CF).
- `POST /fetch {url}` → scarica col `yt-dlp`, ritorna video base64 + caption + metadati.
- README con deploy in 1 comando. È l'UNICO pezzo che richiede un suo account.

## Limiti onesti (v1)
- Reel grandi (>~8MB inline): non analizzati per intero finché non aggiungo Files API (v2).
- Contenuti privati/login-only: dipende dai cookie del fetcher (v1 = solo pubblici).
- ToS Instagram: yt-dlp per uso personale; non scalare a servizio pubblico massivo.

## Fuori scope (YAGNI ora)
IRC, VAD, sherpa-onnx diarization, perceptual hashing locale, Qwen2-VL → tutto il bot-streamer.
