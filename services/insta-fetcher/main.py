"""
WhyInsta fetcher — il servizietto che il Worker WhyChat chiama per scaricare il
media di un link social (Instagram reel/post, e per estensione TikTok/YouTube).

Flusso: Worker → POST /fetch {url} → qui yt-dlp scarica il video → ritorno
{video_base64, mime, caption, title, uploader, duration}. Il Worker passa il
video a Gemini multimodale che lo GUARDA (trascrizione + scene + testo a schermo).

È l'UNICO pezzo di WhyInsta che gira fuori da Cloudflare, perché un Worker non
può scaricare un reel da solo (IG blocca IP datacenter / richiede login).

Sicurezza: opzionale FETCHER_SHARED_SECRET — se impostato, il Worker deve
mandare l'header `x-fetcher-secret` uguale, altrimenti 401. Tienilo allineato
al secret del Worker così nessun altro usa il tuo downloader.
"""

import base64
import os
import tempfile
import glob
from pathlib import Path

from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import yt_dlp

app = FastAPI(title="WhyInsta fetcher", version="1.0")

# Limite di sicurezza: oltre questo il Worker non riesce comunque a fare l'analisi
# inline con Gemini (~8MB di base64). Evita di scaricare film interi per sbaglio.
MAX_BYTES = int(os.environ.get("FETCHER_MAX_BYTES", str(12 * 1024 * 1024)))
SHARED_SECRET = os.environ.get("FETCHER_SHARED_SECRET", "")

# Domini ammessi: nessuno scarica a caso qualsiasi URL passi di qui.
ALLOWED_HOSTS = (
    "instagram.com",
    "instagr.am",
    "tiktok.com",
    "vm.tiktok.com",
    "youtube.com",
    "youtu.be",
)


class FetchReq(BaseModel):
    url: str


def _allowed(url: str) -> bool:
    u = url.lower()
    return u.startswith("http") and any(("//" + h in u) or ("." + h in u) or ("/" + h in u) for h in ALLOWED_HOSTS)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/fetch")
def fetch(req: FetchReq, x_fetcher_secret: str | None = Header(default=None)):
    if SHARED_SECRET and x_fetcher_secret != SHARED_SECRET:
        raise HTTPException(status_code=401, detail="bad secret")

    url = req.url.strip()
    if not _allowed(url):
        raise HTTPException(status_code=400, detail="host non supportato")

    with tempfile.TemporaryDirectory() as tmp:
        outtmpl = str(Path(tmp) / "media.%(ext)s")
        ydl_opts = {
            # Preferisci un mp4 piccolo: ≤720p, e comunque sotto MAX_BYTES.
            "format": f"best[ext=mp4][filesize<{MAX_BYTES}]/best[height<=720]/best",
            "outtmpl": outtmpl,
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "max_filesize": MAX_BYTES,
        }
        # Cookie opzionali per contenuti login-only (monta cookies.txt nel container).
        cookiefile = os.environ.get("FETCHER_COOKIES")
        if cookiefile and os.path.exists(cookiefile):
            ydl_opts["cookiefile"] = cookiefile

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
        except Exception as e:  # noqa: BLE001 — vogliamo un messaggio pulito al Worker
            raise HTTPException(status_code=422, detail=f"download fallito: {e}")

        files = sorted(glob.glob(str(Path(tmp) / "media.*")))
        if not files:
            raise HTTPException(status_code=422, detail="nessun media scaricato")
        path = files[0]
        size = os.path.getsize(path)
        if size == 0:
            raise HTTPException(status_code=422, detail="media vuoto")
        if size > MAX_BYTES:
            raise HTTPException(status_code=413, detail="media troppo pesante")

        with open(path, "rb") as f:
            data = f.read()

        ext = Path(path).suffix.lstrip(".").lower()
        mime = "video/mp4" if ext in ("mp4", "m4v", "mov") else f"video/{ext or 'mp4'}"

        return JSONResponse(
            {
                "video_base64": base64.b64encode(data).decode("ascii"),
                "mime": mime,
                "caption": (info.get("description") or "")[:2000],
                "title": (info.get("title") or "")[:300],
                "uploader": info.get("uploader") or info.get("channel") or "",
                "duration": info.get("duration") or 0,
            }
        )
