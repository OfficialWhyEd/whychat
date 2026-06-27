# WhyChat — DESIGN.md

Design system reale, estratto dal codice. Dark cinematic, un solo accento caldo.

## Strategia colore: **Committed** (dark, drenched-leaning)
Superficie quasi-nera, un'unica famiglia calda (cremisi → ember → ambra) che porta l'identità. Niente secondo accento freddo. Niente arcobaleno.

## Token colore (CSS vars in `src/index.css`)
| Ruolo | Var | Valore |
|---|---|---|
| Sfondo (void) | `--color-void` | `#0a0908` (off-black tinto caldo, mai `#000`) |
| Sfondo elevato | `--color-void2` | `#100d0b` |
| Testo primario | `--color-paper` | `#f2efe9` (mai `#fff`) |
| Testo medio | `--color-dim` | `#c9c4bb` |
| Testo debole | `--color-faint` | `#8a8378` |
| Linea | `--color-line` | `rgba(242,239,233,0.08)` |
| Linea forte | `--color-line2` | `rgba(242,239,233,0.14)` |
| **Accento (signal)** | `--color-signal` | `#c94b25` cremisi |
| Accento soft | `--color-signal-soft` | `#e0673f` ember |
| Accento chiaro | `--color-ember` | `#f0a36a` ambra |

**Regola:** l'accento cremisi resta ≤ ~15% della superficie (bottoni primari, stati attivi, hover). Tutto il resto è neutro caldo. **Per dati multi-categoria** (dashboard) usare una rampa DENTRO la famiglia calda (brick→cremisi→arancio→ocra→oro), mai viola/teal/lime/blu.

## Tipografia
| Uso | Font |
|---|---|
| Body / UI | **Outfit** (`--font-sans`) |
| Display / titoli serif | **DM Serif Display** / **Fraunces** (`--font-display`) |
| Logo | **Loverine** corsivo (`--font-logo`) |
| Mono / label tecniche / numeri | **JetBrains Mono** (`--font-mono`) |
| Accento corsivo in-prosa | DM Serif italic (`.serif-i`) |

- Gerarchia per scala + peso (≥1.25 tra step). Label tecniche in mono uppercase tracking-wide.
- Numeri (dashboard/contatori) sempre mono.

## Materiali
- **Glass:** scuro frosted SOLIDO (`rgba(16,11,8,0.5)` + `blur` + ring inset + sheen). **NIENTE glass WebGL che campiona lo sfondo** sugli input: sbianca a "crema" al resize (rimosso dal composer).
- **Bordi:** hairline (`--color-line`), stato attivo `signal/30`.
- Ombre tinte verso il caldo, mai glow neon.

## Motion
- Ease-out esponenziale (`[0.22,1,0.36,1]`) per entrate; ease-in per uscite. Niente bounce/elastic.
- Spring (`stiffness 480, damping 34`) per liste/accenti (es. accento chat attiva con `layoutId`).
- Animare solo `transform`/`opacity`. Mai layout properties.

## Pattern componenti
- **Liste editoriali** (Hero openers, sidebar): righe separate da bordi hairline, NON griglie di card. Hover: testo→paper, freccia che entra, accento ember.
- **Cards** solo dove l'elevazione comunica gerarchia. Mai card annidate.
- **Mode menu:** lista con icona lucide (stroke 1.7) + label + tag (`beta`/`∞`) a destra.
- **Composer:** glass solido, ring che si accende quando "armato", pill modalità, send button "liquid metal".

## Bandi (oltre alle leggi impeccable)
- Niente `#000`/`#fff`, niente emoji illustrative, niente light/cream bg, niente AI-purple, niente side-stripe come accento, niente gradient-text sui titoli grossi.
- Il "wordmark gigante" dell'opener è l'effetto PARTICELLE (firma del brand), non gradient-text: ammesso come momento identitario, non come template.
