# WhyChat — Bozza di tutto (stato verificato nel codice) · Fase 4

> Letti **integralmente** i 4 paper (Parte1 cronologia msg-per-msg, Parte2 media/note a mano, Parte3 psicologia, Parte4 TODO) + FASE3-DA-FARE + le 27 voci, e **controllato nel codice reale** cosa è fatto.
> Note a mano (IMG_9886/9918/9919) lette e mappate: error screen 🟡, sidebar+artifact ✅, upload immagini ✅ (video follow-up), transizioni 🟡.
> Legenda: ✅ fatto e verificato · 🟡 parziale/da rifinire · 🔴 da fare · 🔒 bloccato (serve azione di Edo)
> Si spedisce **un pezzo alla volta**, ognuno buildato verde + screenshot prima di dire "fatto".

## 🔒 IL BLOCCO UNICO — Cloudflare KV (sblocca le richieste in CAPS)
Tracking utenti, **dashboard**, memoria/dreaming/soul **per-utente** sono **già scritti** nel worker
(`logTurn`, `/api/vault`, cron sogni) ma gated su `env.MEMORY` (KV), **oggi spento**.
Il token nel Portachiavi **deploya ma non ha permesso KV** (verificato: errore 10000).
→ Serve un token Cloudflare con `Workers KV Storage:Edit`. Istruzioni in fondo. **Solo Edo può farlo.**

## Esperienza / UI
| # | Voce | Stato |
|---|------|-------|
| — | Chat Minimap (puntini, pin artifact, jump) | ✅ Fase 4 |
| — | Dashboard tracciamento aggregata (`#dashboard`) | ✅ UI fatta · 🔒 dati con KV |
| — | "Sto ragionando" mostra il TEMA della domanda | ✅ Fase 4 |
| 3 | Logo "WhyChat" Loverine, gesto unico, shimmer | ✅ (DiaText + font Loverine) |
| 22 | Barra composer proporzioni/liquid glass | 🟡 rifinita, manca pass "assurdo" completo |
| — | Sidebar stile Claude (recency, gruppi data, rename, no-overlay new chat) | ✅ Fase 4 |
| 2 | Sidebar + pannello Artifact "identici a Claude Desktop" | ✅ Fase 4 (sidebar Claude-style + pannello artifact agganciato split) |
| 4 | Upload file/immagini nella barra | ✅ immagini (vision /api/see) · 🔴 video (follow-up: frame→vision) |
| 7 | Animazione di ogni icona (triggerabile) | ✅ AnimatedIcon |
| 6 | Transizioni entrata→uscita modalità | 🟡 presenti, da curare |
| 20 | Jump-to-bottom liquid glass | ✅ |
| 21 | Tolta la luce centrale | ✅ |
| 27 | Schermata errori 404/502 centrata | 🟡 ErrorScreen esiste, da verificare |

## Modalità
| # | Voce | Stato |
|---|------|-------|
| 9 | OnlyType (disegno→crea, foglio, motion-blur) | ✅ render intatto (foglio+strumenti+composer), regressione assente |
| 10 | Adaptive reasoning + "Rispondi ora" | 🟡 /api/reason c'è; bottone da verificare |
| 11 | Deep Thinking visibile | ✅ |
| 12 | Group Prediction UI multi-agente | 🟡 backend ✅, UI da rifinire (KV per memoria) |
| 13 | WhyEarth chat-nel-globo + pin + toggle | ✅ pin+toggle+chat; immagine del luogo ✅ Fase 4 |
| 14 | WhyMusic analisi traccia | ✅ |
| 15 | WhyEntropy conversabile | ✅ system prompt a tema + overlay chat (verificato) |
| 16 | Plan Mode su task complessi | ✅ /api/plan + AgentPlanning |
| 17 | Azioni-agente visibili (bash/tool) | ✅ AgentPlanning |
| — | WhyEcosystem simulazioni + download | ✅ (volpi/conigli, captureStream) |

## Effetti (componenti dei prompt 21st.dev)
DotLoader ✅ · ProgressiveFluxLoader ✅ · TextInertia ✅ · ShiningText ✅ · AnimatedCounter ✅ ·
HoverPreview ✅ · DiaText ✅ · GlowCard/spotlight ✅ · ProtocolBadge/AwardBadge ✅ · YouTubeEmbed ✅ ·
SilkTrails (scie mouse) ✅ · Web search ✅ (toggle + auto `needsLiveInfo` → Wikipedia/HN, verificato).

## Infrastruttura / governance
| # | Voce | Stato |
|---|------|-------|
| 18 | TTS Edge it-IT su ogni messaggio | ✅ |
| 19 | Reattività audio→visiva (bordi/particelle) | ✅ |
| 23 | Fallback API a cascata Groq×6 + Gemini×2 | ✅ |
| 24 | Sicurezza chiavi (secret + rotazione) | ✅ secret; rotazione da confermare |
| 25 | Offuscamento codice / IP (repo pubblico) | 🔴 da decidere (worker→repo privato?) |
| 1 | **Memoria/tracking per-utente reale** | 🔒 scritto, serve KV |
| 8 | Dreaming/Soul/Identity per-utente | 🔒 scritto, serve KV |
| 26 | Benchmark finale vs altri | 🔴 ULTIMO step |
| — | Ricerca online (webkimi/openclaw) + skill/plugin per utente | 🔴 grande, da progettare |

---
## Come attivare la KV (Edo, ~1 minuto)
1. https://dash.cloudflare.com → profilo → **API Tokens** → *Create Token* → *Custom*.
2. Permessi: **Account → Workers KV Storage → Edit** (+ se vuoi *Workers Scripts → Edit* per deployare). Account: il tuo.
3. Copia il token. Poi salvalo nel Portachiavi (riusabile):
   `security add-generic-password -U -s cloudflare-kv-token -a whyed -w 'IL_TOKEN'`
4. Dimmi "fatto": creo il namespace MEMORY, scommento `wrangler.toml`, deployo. Si accende tutto.
