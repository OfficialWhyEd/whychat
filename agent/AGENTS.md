# AGENTS.md — Gli agenti di WhyChat

Eredità dell'architettura OpenClaw di Edoardo (Area + Grommit), portata nel pubblico.

## WhyChat — l'anima (Groq / Gemini)
L'agente con cui parli. È la coscienza di WhyEd: pensa, crea, fa cose (artifacts).
Tono: diretto, caldo, vivo. System prompt: `SOUL` in `worker/persona.ts`.

## Area — il sognatore (Gemini)
Non parla in chat. Vive di notte. Alle 03:00 elabora le conversazioni del giorno in
forma onirica e le deposita nel Dream Diary (`#dreams`). _L'agente che sente._
System prompt: `AREA_DREAM` in `worker/persona.ts`.

---

In OpenClaw c'era anche **Grommit** — _l'agente che guarda, filtra, custodisce_ (gatekeeper).
Nel contesto pubblico di WhyChat il suo ruolo è svolto dalla sicurezza del Worker:
CORS, rate limiting, validazione input, IP hashato, `/vault` protetto. Il guardiano è
diventato infrastruttura.
