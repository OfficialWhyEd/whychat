# Accesso rapido al KV di WhyChat (memoria utenti)

> Apri questo file da GitHub sul telefono e tocca il link: vai dritto al KV.

## 🔗 Apri il KV (dashboard Cloudflare)

**[👉 APRI IL KV QUI](https://dash.cloudflare.com/23ba9989701c2051ec6b080558eb5c3c/workers/kv/namespaces)**

1. Tocca il link sopra.
2. Fai login **una volta** col tuo account Cloudflare (**edoardello@gmail.com** — se l'avevi creato con Google, tocca **"Sign in with Google"**, niente password da ricordare).
3. Si apre la lista dei namespace → tocca **MEMORY** → vedi tutte le chiavi → tocca una chiave per leggerne il valore.

Dopo il primo login il telefono resta loggato: la prossima volta il link apre il KV diretto.

> **Non ricordi la password Cloudflare?** Se NON hai usato Google: vai su `dash.cloudflare.com`, tocca **"Forgot your password?"**, ti arriva la mail per reimpostarla. Non esiste una password del KV separata: l'accesso è il login del tuo account Cloudflare.

## 📂 Cosa c'è dentro
- `mem:n:<nome>` → memoria di un utente che ha dato il nome (es. `{"name","notes":[...],"count","lastSeen"}`)
- `mem:v:<id>` → memoria di un utente anonimo (per dispositivo)
- `log:<data>:<id>` → log dei turni di conversazione

## 💻 Da computer (terminale, nella cartella WhyChat)
```bash
# lista chiavi
npx wrangler kv key list --namespace-id 38ac82d5c62e4f16b04f2f62187b3fea

# leggi un valore
npx wrangler kv key get "mem:n:edotest" --namespace-id 38ac82d5c62e4f16b04f2f62187b3fea
```

## ℹ️ Riferimenti
- Account Cloudflare: `edoardello@gmail.com` · Account ID `23ba9989701c2051ec6b080558eb5c3c`
- Namespace KV **MEMORY** ID: `38ac82d5c62e4f16b04f2f62187b3fea`
