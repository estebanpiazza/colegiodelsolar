"""
get_instagram_post.py
─────────────────────
Obtiene la URL del último post de @delsolarschool usando instaloader
y guarda instagram_latest.json en la raíz del repositorio.

GitHub Actions luego hace commit del JSON y Vercel redeploya automáticamente.

Uso manual:
    python tools/get_instagram_post.py

Credenciales Instagram (opcional, para evitar rate limiting):
    Definir como variables de entorno o en tools/.env:
        IG_USERNAME=tu_usuario
        IG_PASSWORD=tu_contraseña

Requisitos:
    pip install -r tools/requirements.txt
"""

import instaloader
import json
import os
import sys
import datetime
from pathlib import Path

# ──────────────────────────────────────────────────────────────
#  CONFIGURACIÓN
# ──────────────────────────────────────────────────────────────

INSTAGRAM_USER = "delsolarschool"

SCRIPT_DIR   = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_JSON  = PROJECT_ROOT / "instagram_latest.json"
ENV_FILE     = SCRIPT_DIR / ".env"


# ──────────────────────────────────────────────────────────────
#  HELPERS
# ──────────────────────────────────────────────────────────────

def load_env() -> dict:
    """Lee key=value de tools/.env y los combina con las variables del entorno."""
    env = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    # Las variables de entorno del sistema tienen precedencia (GitHub Secrets)
    for key in ("IG_USERNAME", "IG_PASSWORD"):
        if os.environ.get(key):
            env[key] = os.environ[key]
    return env


def log(msg: str):
    ts = datetime.datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


# ──────────────────────────────────────────────────────────────
#  OBTENER ÚLTIMO POST
# ──────────────────────────────────────────────────────────────

def fetch_latest_post(ig_user: str = "", ig_pass: str = "") -> dict:
    loader = instaloader.Instaloader(
        quiet=True,
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
        post_metadata_txt_pattern="",
    )

    if ig_user and ig_pass:
        log(f"Iniciando sesión como @{ig_user}...")
        loader.login(ig_user, ig_pass)

    log(f"Consultando perfil @{INSTAGRAM_USER}...")
    profile = instaloader.Profile.from_username(loader.context, INSTAGRAM_USER)
    post    = next(iter(profile.get_posts()))

    is_video  = post.is_video or getattr(post, "typename", "") in ("GraphVideo", "XDTGraphVideo")
    post_type = "reel" if is_video else "p"
    url       = f"https://www.instagram.com/{post_type}/{post.shortcode}/"
    caption   = (post.caption or "")[:200].replace("\n", " ")

    return {
        "url":       url,
        "shortcode": post.shortcode,
        "type":      post_type,
        "caption":   caption,
        "updated":   datetime.datetime.utcnow().isoformat() + "Z",
    }


# ──────────────────────────────────────────────────────────────
#  MAIN
# ──────────────────────────────────────────────────────────────

def main():
    env = load_env()

    # Leer JSON existente para preservarlo en caso de error
    existing = None
    if OUTPUT_JSON.exists():
        try:
            existing = json.loads(OUTPUT_JSON.read_text(encoding="utf-8"))
        except Exception:
            pass

    try:
        data = fetch_latest_post(
            ig_user=env.get("IG_USERNAME", ""),
            ig_pass=env.get("IG_PASSWORD", ""),
        )
    except Exception as e:
        log(f"ERROR al obtener el post: {e}")
        if existing:
            log(f"Manteniendo URL anterior: {existing.get('url', '—')}")
        # Salir con 0 para no fallar el workflow de GitHub Actions;
        # el JSON anterior sigue siendo válido.
        sys.exit(0)

    # Si el shortcode no cambió, actualizar solo el timestamp
    if existing and existing.get("shortcode") == data["shortcode"]:
        log(f"Sin cambios (mismo post: {data['url']}). Actualizando timestamp.")
        existing["updated"] = data["updated"]
        data = existing

    OUTPUT_JSON.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    log(f"JSON actualizado → {OUTPUT_JSON}")
    log(f"Post: {data['url']}")


if __name__ == "__main__":
    main()
