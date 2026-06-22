# WhyChat — Lista definitiva: cosa è fatto e cosa no (verificata nel codice)

> Rianalizzati **ogni singolo messaggio** (Parte1 cronologia), **ogni media + le 3 note a mano lette dalle foto** (Parte2 + IMG_9886/9918/9919), psicologia (Parte3), TODO (Parte4), FASE3-DA-FARE, INDICE — e controllato nel codice reale.
> ✅ fatto e verificato · 🟡 parziale/da rifinire · ❌ non fatto · 🔒 bloccato (serve token KV di Edo)
> `[S# Lxxxx]` = riga del transcript da cui nasce la richiesta.

## ✅ FATTO (verificato)
- **Logo "WhyChat"** scritta unita, ease in/out, entra→ferma→esce→ricomincia, **senza tagli di maschera**, font Loverine, shimmer mantenuto. `[S1 L6478 · L9888 · S2 L10795 · S3 L3023]` → DiaText + Loverine.otf
- **Sidebar identica a Claude Desktop** (nota IMG_9918): recente in cima, gruppi per data (Oggi/Ieri/…), **rename inline**, nuova-chat sempre pulita senza overlay. `[S2 L10795 · S3 L3061]`
- **Pannello Artifact identico a Claude Desktop** (nota IMG_9918): agganciato a destra, split chat|artifact, title bar ricarica/apri-in-scheda/chiudi. `[S2 L10795]`
- **OnlyType**: foglio bianco, disegno = prompt, puntatore-pennello, uscita fuori dal disegno, foglio che si chiude con animazione, motion-blur del placeholder, **ORA chat continuabile multi-turno** con artifact resi bene. `[S1 L3552 · S2 L2661 · L4930]`
- **Persistenza ogni conversazione di ogni modalità** + icona-modalità in sidebar (nota IMG_9919, il task che attraversava tutto il corpus). `[S1 L5987 · L13510 · S3 L3061]`
- **Domande iniziali** simmetriche, sempre diverse, legate alle modalità. `[S1 L5987]`
- **Una chat continua nella sua modalità** (non cambia se cambi menu). `[S1 L5987]`
- **Deep Thinking**: reasoning visibile stile ChatGPT/Claude + la "W che pensa". `[S1 L7544 · L9960]`
- **"Sto ragionando" mostra il TEMA** della domanda, non frasi generiche. `[FASE3 · S1 L7544]`
- **Azioni-agente visibili** (bash/tool, timeline stile Claude Code) → AgentPlanning. `[S2 L5239]`
- **Plan Mode** suggerita su task complessi, se accetti pianifica. `[S3 L13]`
- **Group Prediction** (motore MiroFish): 11 agenti con personalità/parametri propri, regista + ReportAgent. `[S1 L6242/6321/6397]` — backend
- **WhyEarth**: globo, toggle terremoti/voli, chat collegata, pin sul luogo, **+ immagine del luogo** (Wikipedia). Design originale ripristinato (aggiunto, non sostituito). `[S1 L10569 · L14600 · L14856]`
- **WhyEntropy** conversabile a tema (spiritualità/psicologia/neuroscienze/economia) + geometria. `[S1 L14600]`
- **WhyMusic**: analisi traccia nei minimi dettagli. `[S3 L13]`
- **WhyEcosystem**: simulazioni di natura (volpi/conigli, selezione, mutazione) + download. `[FASE3]`
- **TTS Edge it-IT** su ogni messaggio (come OpenClaw). `[S2 L10017]`
- **Reattività audio→visiva**: particelle + bordi del testo bot reattivi al TTS, metallico. `[S2 L10229 · S3 L2453]`
- **Tolta la luce centrale** orrida. `[S3 L2453]`
- **Jump-to-bottom** liquid-glass (l'auto-scroll non strappa la lettura). `[S1 L13198]`
- **Tasto arancione / liquid metal send** corretto, "il resto" liquid glass ai bordi. `[S1 L13002 · S2 L10739]`
- **Animazione di ogni icona** (Hello-Apple per le icone), triggerabile. `[S2 L10795]` → AnimatedIcon
- **Fallback API a cascata**: Groq ×6 + Gemini ×2, sempre ultimo modello, risposta mai fallita. `[S1 L5773 · L12110 · S2 L5318]`
- **Real-time** (sa data/ora) + **ricerca web** (toggle + auto). `[S2 L2191]`
- **Upload IMMAGINI nella barra** → WhyChat le vede (vision). `[nota IMG_9919]`
- **Chat Minimap** (puntini, pin artifact, jump in chat lunghe). `[FASE3]`
- **Dashboard tracciamento** UI (aggregata per-utente, modalità, paesi). `[FASE3 CAPS]`
- Effetti 21st.dev: DotLoader, ProgressiveFluxLoader, TextInertia, ShiningText, AnimatedCounter, HoverPreview, DiaText, GlowCard, ProtocolBadge (W), YouTubeEmbed, SilkTrails → tutti creati.

## 🟡 PARZIALE (da rifinire)
- **Transizioni entrata→uscita** delle modalità (nota IMG_9919): presenti, da curare di più. `[S2 L4930]`
- **Adaptive reasoning**: /api/reason c'è e decide, ma manca il **bottone "Rispondi Ora"** dopo 6-7s. `[S2 L5047/5097/5135]`
- **Tastino play TTS per-messaggio SOLO in WhyMusic**: ora la voce è un toggle globale, non il play sotto ogni messaggio limitato a WhyMusic. `[S3 L3061]`
- **Group Prediction UI** multi-agente (bolle, "sta scrivendo…") + ricerca online per OGNI agente. `[S1 L11697]`
- **Barra composer** "assurda": rifinita molto, ma manca un pass completo. `[S1 L11057 · L12219]`
- **Schermata errori 404/502** centrata dedicata: c'è ErrorScreen (crash) + retry/toast sugli errori API, ma non una pagina 502 dedicata. `[S1 L9481 · nota IMG_9886]`
- **HoverPreview** dei link/immagini nelle risposte: componente pronto, da agganciare alle ricerche.

## ❌ NON FATTO
- **Upload VIDEO nella barra** (nota IMG_9919: "immagini – video ecc"). Immagini fatte, video no.
- **Offuscamento/camuffamento codice** + trademark/IP (repo pubblico): da decidere (worker → repo privato?). `[S2 L5318 · FASE3 CAPS]`
- **Skill/plugin/connettori/MCP/CLI per ogni utente** (ognuno implementa i suoi). `[FASE3 CAPS]` — grande, da progettare
- **Benchmark finale** vs gli altri "come le grandi aziende". `[S1 L14600]` — è l'ULTIMO step
- **Mascotte/logo 3D Spline** fluttuante: poi hai scelto solo la scritta WhyChat, quindi accantonato. `[FASE3]`
- **Voli in tempo reale** animati su WhyEarth: serve account OpenSky FREE (OAuth2) — bloccato senza.

## 🔒 BLOCCATO — serve la KV (solo tu puoi, 1 minuto)
Tutto **già scritto** nel worker, spento finché non esiste il namespace KV:
- **Tracciamento reale di ogni utente** (ogni richiesta, modalità, nome, info) → la dashboard si riempie. `[FASE3 CAPS]`
- **Memoria / Dreaming / Soul / Identity per-utente reale**, influenzati da chi entra. `[FASE3 CAPS]`
→ Token Cloudflare con `Workers KV Storage:Edit` → `security add-generic-password -U -s cloudflare-kv-token -a whyed -w 'TOKEN'` → dimmi "fatto".
