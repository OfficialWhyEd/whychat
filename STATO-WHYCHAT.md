# Stato WhyChat — audit STORICO completo (dall'inizio, 15→23 giugno)

> Ricostruito rileggendo **ogni** messaggio dai transcript reali di tutte le sessioni WhyChat
> (20260615, 20260620, 20260621×2, sessione corrente). Non a memoria.
> Aggiornato: 2026-06-23.

**Legenda:** ✅ fatto · ⚠️ parziale / da verificare a fondo · ❌ NON fatto

---

## A. FONDAMENTA (sessioni 15–20 giugno)

### Identità / intelligenza / modelli
- ✅ WhyChat = "anima digitale" di WhyEd, chatbot tipo Claude su Pages + Cloudflare Worker.
- ✅ Catena modelli con **fallback**: Groq (Llama 3.3) + più chiavi Groq, fallback a Gemini. Sempre una risposta disponibile.
- ✅ **Deep thinking**: ragionamento mostrato (ReasoningPanel, shimmer).
- ✅ **Reasoning adattivo**: Groq orchestra, decide quanto ragionare, **"Rispondi Ora"** dopo ~6-7s, risposta finale in parallelo al ragionamento.
- ✅ **Memoria/identità/KV** per ogni utente anche senza nome + **bootstrap** stile openclaw (senza nominarlo). Usabile dal telefono in remoto.
- ⚠️ **"Intelligente come Mythos/Fable", connesso al mondo, sa che ore sono, usa i tool in modo intelligente**: parziale — da rivedere la qualità delle risposte (→ task #15).

### Modalità
- ✅ Modalità multiple (Chat, Canvas, Deep, Apprendimento, OnlyType, Group, WhyEarth, WhyEntropy, WhyMusic, WhyEcosystem) con **icona modalità** e **chat salvata per modalità** nella sidebar.
- ✅ **OnlyType**: chat continuabile, decide se usare solo Groq o anche il ragionamento.
- ⚠️ **OnlyType (cuore originale)**: "disegni qualcosa + descrizione → lui CAPISCE il disegno e lo CREA (sito/SVG/equazione/idea di gioco)". All'inizio funzionava meglio. Da riverificare che il riconoscimento del disegno + creazione sia all'altezza. Animazione di uscita del foglio all'invio: da verificare.
- ⚠️ **WhyEarth**: toggle voli/terremoti ci sono; ma "chat collegata al globo" (chiedi → punta il posto, immagini, zoom), togliere i pallini brutti, qualità mobile → **da sistemare** (beta).
- ❌/⚠️ **WhyEntropy**: "ancora a caso" — da rendere significativo/funzionante.
- ⚠️ **Group Prediction (stile Mirofish)**: agenti con personalità/parametri propri. **Ricerca online degli agenti in tempo reale: NON trovata** ❌. Agenti che discutono tra loro e decidono quale agente attivare: da verificare.
- ⚠️ **WhyEcosystem**: simulazioni natura — da verificare stato.
- ❌ **WhyMusic**: analisi/produzione traccia in profondità — solo UI, manca il motore audio reale (fuori scope attuale).

### Voce / effetti
- ✅ **TTS Edge** `it-IT-ElsaNeural` (veloce, via Worker /api/tts + fallback browser).
- ✅ **Bordo barra reattivo al TTS** (metallico) + **particelle reagiscono all'audio**.
- ✅ Tasto voce automatica **solo in WhyMusic**; play per-messaggio ovunque.
- ✅ **Jump-to-bottom** liquid glass metallico.

### UI storica
- ✅ **Openers** simmetrici, sempre diversi, legati alle modalità.
- ✅ **Error/404** centrato e curato (ErrorScreen).
- ⚠️ **Logo / Wordmark "WhyChat"**: è il punto **più contestato** di sempre. Richiesto: font variabile (FPA Variable / `Loverine.otf`), effetto **scritta che si compone** (la linea scrive la parola, entra→si ferma→si riscrive), **ease in/out morbido Pixar**, titolo **vivo** (si muove/ingrandisce), mantenendo l'effetto attuale, "senza tagli di maschere strani". → **DA RIVERIFICARE E PROBABILMENTE RIFARE PER BENE.**
- ⚠️ **Adattamento mobile/tablet**: storicamente "si sovrappone tutto"; nella chat normale da telefono alcune scritte si sovrappongono. Da riverificare ora.
- ⚠️ **Tendine (dropdown)**: su mobile si chiudono troppo istantaneamente — serve animazione di chiusura.
- ⚠️ **Azioni/tool visibili** (bash, websearch/webkimi) con design impeccabile "come un agente openclaw/Claude Code che fa vedere cosa fa": parziale.

---

## B. SESSIONE CORRENTE (21–23 giugno) — già fatto
- ✅ Allegati: graffetta, ogni file, video con anteprima, multi-file, ZIP spacchettato, nome file, X non tagliata.
- ✅ Composer: icone lucide allineate/simmetriche, testo allineato a MODALITÀ, placeholder allineato al cursore, niente scatto post-animazione, animazioni "Hello Apple" (icona molleggia al cambio modalità), barra solida su telefono stretto.
- ✅ **Liquid glass identico Apple**: mappa-lente (niente seam) + aberrazione cromatica + specular bordo alto. Particelle dietro si rifrangono.
- ✅ Tempo di risposta in secondi esatti.
- ✅ Tessera tecnica (ProtocolBadge) aggiornata; skill taste (voto 9/10).
- ✅ Domande a scelta multipla cliccabili.
- ✅ Sidebar: stagger d'entrata conversazioni.
- ✅ **IP**: repo PRIVATO `whychat-core` col secret-sauce; rimosso dal repo pubblico a HEAD.

---

## ❌ DA FARE — lista operativa (priorità)
1. ❌ **Opener STATICO** (#35 quadrato rosso): l'intro + i consigli sotto "WhyChat" non devono fare lo **slide** d'entrata, devono essere **statici**. → in lavorazione adesso.
2. ❌ **Suggerimenti dinamici personalizzati** (in basso, "aiutami a iniziare…"): il primo generale, il secondo entra **dopo un ritardo** deciso da WhyChat in base alla persona; WhyChat decide **se** mostrarli.
3. ⚠️ **Logo/Wordmark**: rifare l'effetto scritta-che-si-compone col font giusto, ease in/out, vivo, senza tagli.
4. ⚠️ **WhyEarth**: chat↔globo (punta i luoghi, immagini, zoom), togliere pallini brutti, fix mobile.
5. ⚠️ **WhyEntropy**: renderlo sensato/funzionante.
6. ⚠️ **Group Prediction**: ricerca online degli agenti + discussione tra agenti.
7. ⚠️ **OnlyType**: riconoscimento disegno→creazione; animazione uscita foglio; tendine chiusura mobile.
8. ⚠️ **Mobile/tablet**: sovrapposizioni nella chat normale; tendine chiusura troppo istantanea.
9. ❌ **Trademark / copyright / license / protocolli ufficiali** + offuscamento codice (oltre al repo privato già fatto) + **purge storia git pubblica** (force-push, serve OK).
10. ❌ **Benchmark finale** vs altri assistenti.
11. ⚠️ **Qualità modello/risposte** (come Mythos/Fable).

> Nota: i punti ⚠️ vanno verificati uno per uno dal vivo prima di dichiararli fatti. Questo file è la fonte di verità: si aggiorna man mano.
