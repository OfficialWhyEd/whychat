# WhyChat — Roadmap & stato

Tracciamento vivo. **Niente si perde. Pushare SEMPRE dopo ogni batch.**
Bar di qualità: tutto allineato, simmetrico, un unico eco visivo — preciso, sinuoso, fatto bene. Mobile/tablet inclusi.

## ✅ Fatto e LIVE (pushato + Worker deployato)
- OnlyType: puntatore-pennello stile Photoshop.
- Robustezza chat: retry 502/503/504 + messaggi umani.
- Easing in/out su menu e cursore.
- Sidebar: tasto elimina non sovrapposto; collassabile/chiudibile desktop+mobile; **stato persistente** (aperto/chiuso come l'hai lasciato).
- Deep thinking: ragionamento Gemini 2.5 (pannello ✦), thoughts persistiti.
- Hero: parola che cicla; placeholder barra che si auto-digita.
- Aperture: simmetriche, sempre diverse, legate alle modalità; avviano in modalità.
- **Logo FIRMA**: "WhyChat" disegnato a linea singola centrale (path-draw), si scrive→resta→si ritira→ricomincia. (rimosso Fraunces/Caveat-outline)
- **Allineamento**: particelle confinate all'area principale → allineate all'hero, si riallineano al toggle sidebar (niente più offset 268 fisso).
- Sicurezza: fix XSS markdown.
- AI robusta: 2ª chiave Gemini + catena fallback ×2 chiavi.
- Repo: link sito nella descrizione/About.

## 🟡 Group Prediction (beta) — motore stile MiroFish
Backend FATTO e live:
- 11 agenti con **personalità + parametri propri** (tratti, dominio, temperatura, assertività).
- Regista (`/api/group`): step1 sceglie chi parla; step2 l'agente parla coi SUOI parametri.
- ReportAgent (`/api/group/predict`): predizione finale (esito, confidenza, scenari) via Gemini ×2 + thinking.
- Fallback Groq→Gemini ×2 in ogni turno: non si blocca mai.

Da fare:
- [ ] **UI** modalità Group Prediction (adattare `ChatComponent`): bolle multi-agente, "sta scrivendo…", ritardi realistici, ingresso utente, card predizione. Tag `beta` nel menu.
- [ ] **Memoria + auto-miglioramento** (social evolution): richiede **KV** persistente. BLOCCO: token Cloudflare senza permesso KV → Edo deve abilitarlo.
- [ ] (Opz.) Generazione dinamica agenti dal seed.

## 🔴 DA FARE — repair UI generale (priorità ALTA)
- [ ] **Responsive mobile/tablet**: oggi "infimo", si sovrappone tutto → rifare per bene.
- [ ] Audit completo: tasti asimmetrici, sovrapposizioni, cose "bruttine" → sistemare tutte.
- [ ] **Simbolo modalità accanto a ogni conversazione** in sidebar + ogni chat ricorda la sua modalità (continua in quella).
- [ ] Aggiungere **poco poco** di effetto scie che seguono il mouse (sobrio, colori brand, poche scie).

## Decisioni prese
- Modalità = "Group Prediction" (motore di predizione).
- 11 agenti, incluso Anima (coscienza di WhyEd).
- Groq = voci veloci; Gemini ×2 = gestione/sintesi + fallback.
- Segreti SOLO in Cloudflare + `.dev.vars` (gitignored), mai nel repo.
- Da ora: cambi contenuti, niente stravolgimenti; push sempre; lista sempre aggiornata.
