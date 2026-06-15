# WhyChat — l'anima digitale di WhyEd

> La coscienza di [Edoardo Porcu (@whyed)](https://github.com/OfficialWhyEd) resa codice.
> Un assistente che pensa, crea e parla come lui — disponibile a chiunque.

**WhyChat** non è un chatbot sul CV di WhyEd. È la sua parte più profonda: il modo di
ragionare, la voce, l'estetica, il "Why". Un assistente completo (come Claude o GPT) ma
con una sola anima — quella di Edoardo. Ti aiuta su qualsiasi cosa, con la sua testa.

🔮 **Live:** https://officialwhyed.github.io/whychat/

---

## Com'è fatto

```
Browser ──▶ GitHub Pages (sito statico)
                │  fetch
                ▼
        Cloudflare Worker  ◀── le API key vivono SOLO qui (secret)
         ├─ Groq      → chat in streaming (voce di WhyChat)
         ├─ Gemini    → pensiero profondo (∞)
         └─ KV        → memoria viva + report privato /vault
```

- **Frontend:** Vite · React · TypeScript · Tailwind v4 · design dark cinematic,
  liquid glass, effetto inchiostro reattivo al puntatore, chat in streaming continua.
- **Backend:** un Cloudflare Worker che fa da proxy AI sicuro. Nessuna chiave nel sito.
- **Anima:** il system prompt (`worker/persona.ts`) distillato da 380+ sessioni, due
  paper neuropsicologici, il CV e il portfolio di WhyEd.

## Sicurezza

- Le API key (Groq, Gemini) e la passphrase admin sono **secret del Worker**, mai nella repo.
- CORS bloccato sulle sole origini consentite (protegge la quota AI).
- Rate limiting per IP, validazione e troncamento degli input.
- Le conversazioni vengono conservate (memoria viva) con IP **hashato**, mai in chiaro.
- I visitatori sono avvisati che le conversazioni possono essere salvate.

## Memoria & Vault

WhyChat ricorda cosa gli viene detto e da chi, scrivendolo nello storage KV del Worker.
Edoardo legge tutto dalla pagina privata **`/whychat/#vault`**, protetta da passphrase.

## Sviluppo

```bash
npm install
npm run dev            # sito su http://localhost:5173
npm run worker:dev     # Worker in locale (richiede .dev.vars con le chiavi)
```

### Deploy del Worker

```bash
export CLOUDFLARE_API_TOKEN=$(security find-generic-password -s cloudflare-workers-deploy-token -w)
npx wrangler kv namespace create MEMORY      # incolla l'id in wrangler.toml
printf '%s' 'gsk_...'  | npx wrangler secret put GROQ_API_KEY
printf '%s' 'AIza...'  | npx wrangler secret put GEMINI_API_KEY
printf '%s' 'passphrase-lunga-segreta' | npx wrangler secret put ADMIN_TOKEN
npx wrangler deploy
```

### Deploy del sito

`git push` su `main` → GitHub Actions builda e pubblica su Pages. Serve `.nojekyll`.

---

Costruito con [Claude Code](https://claude.com/claude-code) · parte del Why Ecosystem.
