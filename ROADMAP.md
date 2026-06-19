# WhyChat — Roadmap & stato

Tracciamento vivo di cosa è fatto, cosa manca, e le decisioni prese. Nessuna idea va persa.

## ✅ Fatto e LIVE (frontend pushato + Worker deployato)
- **OnlyType**: puntatore-pennello stile Photoshop (cerchio che si ingrandisce con lo spessore).
- **Robustezza chat**: retry 502/503/504 + messaggi umani.
- **Easing** in/out su menu composer e cursore.
- **Sidebar**: tasto elimina che non si sovrappone all'ora; collassabile/chiudibile su desktop e mobile.
- **Deep thinking**: ragionamento nativo Gemini 2.5 (thinkingBudget dinamico), pannello ✦ RAGIONAMENTO; thoughts persistiti.
- **Hero**: parola che cicla (AnimatedTextCycle); placeholder barra che si auto-digita (Typewriter).
- **Aperture**: simmetriche, sempre diverse, legate alle modalità, con icona+etichetta; avviano la chat nella modalità scelta.
- **Logo firma** scritto a mano (SignatureMark); rimosso Fraunces.
- **Sicurezza**: fix XSS (escape virgolette nel markdown).
- **AI robusta**: 2ª chiave Gemini + catena di fallback (flash → flash-latest → … ) × 2 chiavi.
- **Repo**: link al sito nella descrizione/About.

## 🟡 Group Prediction (beta) — motore stile MiroFish
**Backend FATTO e live:**
- 11 agenti, ognuno con **personalità + parametri propri** (tratti, dominio, temperatura, assertività).
- **Regista** (`/api/group`): step 1 sceglie chi parla / next (agent·user·done); step 2 l'agente parla con i SUOI parametri.
- **ReportAgent** (`/api/group/predict`): predizione finale (esito, confidenza %, scenari, perché) via Gemini ×2 + thinking.
- **Fallback Groq → Gemini ×2** dentro ogni turno: il gruppo non si blocca mai.

**Ancora da fare:**
- [ ] **UI** della modalità (adattare il `ChatComponent`): bolle multi-agente colorate, "sta scrivendo…", ritardi realistici, ingresso utente, card predizione. ← *prossimo passo critico: senza UI non è usabile*
- [ ] Modalità "Group Prediction" con tag `beta` nel menu + wiring.
- [ ] **Memoria + auto-miglioramento** (la "social evolution" di MiroFish): richiede **KV** persistente. BLOCCO: il token Cloudflare attuale non ha permesso KV → serve abilitarlo.
- [ ] (Opzionale) Generazione dinamica di agenti tarati sul tema (persona-generation dal seed).

## 🟡 Altre cose aperte
- [ ] **Modalità legata alla chat**: ogni conversazione ricorda la sua modalità + **icona modalità accanto a ogni chat** in sidebar. (Fatto solo: l'apertura avvia in modalità.)

## Decisioni prese
- Modalità = **"Group Prediction"** (motore di predizione, non semplice chat di gruppo).
- Gli agenti includono **Anima** (la coscienza di WhyEd) tra gli 11.
- Divisione modelli: **Groq** = voci veloci degli agenti; **Gemini ×2** = gestione/sintesi (predizione) + rete di fallback.
- Chiavi e segreti SOLO in Cloudflare + `.dev.vars` (gitignored), mai nel repo.
