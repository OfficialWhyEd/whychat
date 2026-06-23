# Stato WhyChat — audit completo richieste (rilettura messaggio per messaggio)

> Ricostruito rileggendo **ogni** messaggio della sessione dal transcript reale, non a memoria.
> Aggiornato: 2026-06-23.

**Legenda:** ✅ fatto · ⚠️ da verificare/parziale · ❌ NON fatto

---

## 1. OnlyType / sheet
- ⚠️ **#6** — La chat in OnlyType deve poter **continuare** (non una risposta singola) e gli **artifacts** vanno visualizzati bene. → *Da verificare che sia una chat continuabile e non un singolo prompt→risposta.*

## 2. Upload file / allegati
- ✅ **#8** — Simbolo **graffetta** al posto dell'immagine; ogni tipo di file importabile.
- ✅ **#9** — Video caricabili **con anteprima**; **più file insieme**; tolta la scritta "WhyChat vede".
- ✅ **#10** — Anteprima/chip per pdf/html/md/testo e altri file (FileChip).
- ✅ **#12** — Mostrato il **nome file**; la **X** di rimozione non viene più tagliata (dentro l'angolo).
- ✅ **#14** — Legge tutti i file: immagini, frame video, PDF, testo/codice.
- ✅ **#15** — **ZIP** accettato e spacchettato; WhyChat sa di poterli maneggiare (behavior.ts).

## 3. Barra composer (la cosa più importante)
- ✅ **#7** — Su mobile i toggle diventano solo-icona così invio non va a capo. ⚠️ *Da verificare dal vivo con cerca+plan aperti insieme su telefono stretto.*
- ✅ **#13 / #29 / #30 / #32** — Icone rifatte (lucide qualità Claude), **allineate e simmetriche**, niente più scritta storta (PR #60, #61, #62).
- ✅ **#29/#32** — Testo allineato all'icona MODALITÀ (parte più a destra) (PR #62). Misurato ≤0.5px.
- ✅ **#34** — **Placeholder** allineato al cursore (prima il placeholder restava a sinistra) (PR #63).
- ✅ **#30/#35** — Niente più **scatto post-animazione** del cerca; animazioni coerenti (PR #61).
- ✅ **#29/#32** — **Animazioni tipo "Hello Apple"**: il simbolo MODALITÀ molleggia ad ogni cambio modalità (PR #62).
- ✅ **#32** — Metodo reale per accorgersi se è storto: screenshot + **misure pixel** via puppeteer (non più "a occhio").

## 4. Liquid glass (texture identica Apple)
- ✅ **#38/#40** — Liquid glass **rimesso** sulla barra (l'avevo tolto: errore) con tecnica esistente, non da zero (PR #67).
- ✅ — **Mappa-lente** (niente seam) + **aberrazione cromatica** RGB sul bordo (PR #68). Le particelle dietro si vedono e si rifrangono.
- ⚠️ **#38** — "Letteralmente identico Apple": base fatta; manca eventuale **specular/glint** più marcato per spingerlo oltre (task #11). Da confermare se per te è già "identico".

## 5. Opener / schermata iniziale
- ✅ **#35/#41** — La **scritta dei consigli** non viene più tagliata su mobile/tastiera (PR #69).
- ✅ **#35** — Il sottotitolo non **rimbalza** più al cambio parola (resta fermo/solido) (PR #66).
- ⚠️ **#35** — L'elemento del "quadrato rosso" che si muoveva: credo sia il sottotitolo (sistemato). *Da confermare con la tua immagine che è quello.*

## 6. Tempo di risposta
- ✅ **#35/#36** — Mostrato in **secondi esatti** non arrotondati (`0,72s`, `1,36s`) (PR #65).

## 7. Memoria / identità / intelligenza
- ✅ **#21** — KV usabile **dal telefono in remoto** in tempo reale (attivato e verificato cross-device).
- ✅ **#22/#24** — Memoria per ogni utente **anche senza nome**; ricorda; **bootstrap** iniziale come "agente openclaw" senza nominarlo, con spiegazione dei vantaggi di WhyChat.
- ✅ **#22** — **TTS**: niente più ripetizioni/sovrapposizioni; tasto voce solo in WhyMusic; play per-messaggio ovunque.
- ✅ **#22** — Immagini **salvate e rivedibili**, contesto immagine mantenuto nei follow-up.
- ⚠️ **#22/#24** — "Più intelligente, mantenere più contesto, non stupido" + studiare struttura **Claude Desktop/Mobile/browser** e replicarla: parziale, lavoro continuo (→ task #15).

## 8. UI varie
- ✅ **#19** — Simboli centrati con animazioni al trigger (composer + header + azioni chat).
- ✅ **#24** — **Tessera tecnica** (ProtocolBadge in basso a sinistra) aggiornata e impeccabile.
- ✅ **#24** — Skill **taste** usata per il voto estetico (9/10) + quick wins applicati.
- ✅ **#16/#17/#32** — Uso dell'**MCP/API 21st.dev** e ricerca su internet/GitHub invece di reinventare (memoria salvata: [[feedback-riusa-codice-esistente]]).
- ✅ **#16/#22** — Domande a **scelta multipla** cliccabili (`[[SCELTE:]]`).

---

## ❌ COSE NON FATTE (da fare)
1. ❌ **#28** — **Camuffare/offuscare il codice** e spostare il worker col "secret sauce" su repo **privato** (ottica imprenditoriale, non perderlo mai). → task #14
2. ❌ **#30** — **Benchmark finale** vs altri assistenti (~30% del rimanente). → task #13
3. ❌ **#38** — **Sidebar**: animazioni/effetti di apertura-chiusura. → task #12
4. ❌ **#22/#24/#38** — **Migliorare il modello/risposte** finché non è "perfetto" + replicare struttura Claude Desktop/Mobile/browser. → task #15

## ⚠️ DA VERIFICARE (probabilmente fatto, ma confermare)
- ⚠️ **#6** — OnlyType: chat **continuabile** + artifacts ben visualizzati. → nuovo task
- ⚠️ **#7** — Su telefono stretto: cerca + plan + invio tutti **solidi** in riga. → nuovo task
- ⚠️ **#35** — Qual è l'elemento esatto del **"quadrato rosso"** (serve immagine).
- ⚠️ **#38** — Liquid glass "**identico** Apple": ti basta così o lo spingo (specular/aberrazione più forti)? → task #11
