# WhyChat — Roadmap intelligente (dall'inizio alla fine)

> Stato dettagliato di TUTTO il fatto: vedi `STATO-FASE4.md`.
> Qui c'è solo **ciò che manca**, sequenziato in modo intelligente (per valore + dipendenze).
> Si spedisce un pezzo alla volta: build verde + screenshot prima di "fatto".

## 🔧 Fatto in questa sessione (sintesi)
Chat Minimap · Dashboard UI + log modalità · ragionamento contestuale · Sidebar Claude Desktop · Pannello Artifact Claude Desktop · OnlyType chat continuabile · WhyEarth immagine luogo · **allegati ogni-file LETTI davvero** (immagini/video/PDF/testo/codice/html) · **ZIP spacchettato** · multi-file · FileChip stile Claude · barra mobile solida · WhyChat consapevole dei file · WhyEcosystem (orient. vert/oriz + download + consigli AI, già completo).

---

## ▶️ ORDINE INTELLIGENTE

### FASE 0 — Sblocchi (prima di tutto)
- **0.1 — 21st.dev MCP** ✅ collegata (`magic`, scope utente). **Serve riavviare la sessione** perché i tool si carichino → poi prendo i componenti da solo, niente più copia-incolla.
- **0.2 — 🔒 Cloudflare KV** (azione di Edo, 1 min). Sblocca in un colpo: tracciamento reale utenti + dati dashboard + **memoria/dreaming/soul/identity per-utente**. Token `Workers KV Storage:Edit` → `security add-generic-password -U -s cloudflare-kv-token -a whyed -w 'TOKEN'` → "fatto".

### FASE 1 — Intelligenza conversazionale (no-KV, alto valore)
- **1.1 — Bottone "Rispondi Ora"** durante il ragionamento (dopo ~6-7s) + **adaptive reasoning in chat** (WhyChat decide DA SOLO quanto ragionare) + reasoning↔risposta in parallelo (stile DeepSeek). *S2 L5047/5135.*
- **1.2 — HoverPreview** agganciato ai link/risultati di ricerca (il componente c'è, va connesso). *FASE3.*

### FASE 2 — Group Prediction completo
- **2.1 — UI multi-agente vera**: bolle per agente, "sta scrivendo…", ritardi realistici, card predizione. *backend già pronto.*
- **2.2 — Ricerca online per OGNI agente** in tempo reale. *S1 L11697.*
- **2.3 — (opz.) Memoria + auto-miglioramento** social-evolution → richiede **KV** (dopo 0.2).
- **2.4 — (opz.) Generazione dinamica agenti dal seed.**

### FASE 3 — Rifinitura & gusto (solidità)
- **3.1 — Transizioni entrata→uscita** modalità più curate. *nota IMG_9919.*
- **3.2 — Schermata errore 502/404 dedicata** centrata. *nota IMG_9886.* (oggi: retry+toast+ErrorScreen-su-crash).
- **3.3 — Barra "assurda" pass finale** (molto migliorata, manca il pass dedicato). *S1 L11057.*
- **3.4 — Voce: toggle solo in WhyMusic** vs globale — decisione. *S3 L3061.* (play per-messaggio già c'è).
- **3.5 — Audit solidità mobile** su tutte le modalità (niente wrap/spostamenti). *priorità di Edo.*

### FASE 4 — Modalità più profonde
- **4.1 — WhyEntropy: opera "geometria sacra" nativa** (sfera + spirale aurea, cremisi/ambra) a sinistra. *S1 L14600.* (conversabilità già fatta).
- **4.2 — WhyMusic: produrre/risistemare** una traccia, non solo analizzarla. *S3 L13.*

### FASE 5 — Le grandi (architettura / decisioni di Edo)
- **5.1 — Skill/plugin/connettori/MCP/CLI per ogni utente** (ognuno i suoi). *FASE3 CAPS.* Richiede KV + sandbox + design.
- **5.2 — Offuscamento codice / IP / trademark** → decisione: worker in repo privato? *S2 L5318.*
- **5.3 — Voli live realtime** su WhyEarth → account OpenSky (OAuth). *S1 L10569.*
- **5.4 — (opz.) Mascotte 3D Spline** — solo se la rivuoi (oggi: solo la scritta).
- **5.5 — docx/xlsx** — non letti nativamente da Gemini (servirebbe conversione lato server).

### FASE 6 — Finale
- **6.1 — Benchmark** WhyChat vs gli altri "come le grandi aziende". *S1 L14600 — l'ULTIMO step, sua parola.*

---

## Principio
Aggiungere, non sostituire. Mostrare il lavoro. Verificare prima di "fatto". Non perdere niente.
Termometro: i task multi-sessione (memoria/tracking, group, modalità profonde) si chiudono solo dopo lo sblocco KV — per quello la **FASE 0** viene prima.
