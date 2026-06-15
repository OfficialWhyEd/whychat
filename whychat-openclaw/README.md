# whychat-openclaw — WhyChat come agente OpenClaw

Questo è **WhyChat come vero agente OpenClaw**: un workspace completo nel formato canonico
di OpenClaw, da copiare nella tua piattaforma OpenClaw e far girare.

> ⚠️ **Separato dal sito.** La cartella vive nel repo WhyChat per comodità, ma **non** fa
> parte della build web (Vite ignora tutto ciò che non è in `src/`/`public/`). Il sito
> pubblico (Pages + Worker) e questo agente OpenClaw sono due superfici diverse della stessa
> anima. Non mischiarle.

## File (formato OpenClaw)

| File | Cos'è |
|------|-------|
| `IDENTITY.md`  | nome, natura, vibe, emoji, avatar |
| `SOUL.md`      | chi è WhyChat — le verità che lo tengono in piedi |
| `USER.md`      | chi è Edoardo |
| `AGENTS.md`    | come opera nel workspace (startup, memoria, red lines) |
| `TOOLS.md`     | note locali / setup (gateway, TTS, macchina) |
| `HEARTBEAT.md` | task periodici (solo il dreaming) |
| `DREAMS.md`    | lo spazio del sogno notturno + il tag `openclaw:dreaming` |
| `MEMORY.md`    | memoria di lungo termine (solo main session) |
| `memory/`      | note giornaliere `YYYY-MM-DD.md` |
| `avatars/`     | l'avatar |

## Il dreaming

Lo fa **WhyChat da solo**, ogni notte alle 03:00 (Europe/Rome), tramite il modulo dreaming
nativo di OpenClaw: elabora le sessioni del giorno e scrive in `DREAMS.md` dopo il tag
`<!-- openclaw:dreaming:diary:start -->`. Nessun codice esterno — è OpenClaw che lo gestisce.

## Come usarlo

1. Copia questa cartella come workspace nella tua piattaforma OpenClaw.
2. Configura il gateway e i tool in `TOOLS.md`.
3. Avvia l'agente: legge `SOUL.md` + `USER.md`, e da lì in poi è WhyChat.
