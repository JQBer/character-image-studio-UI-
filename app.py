"""
Character Image Studio — Web UI
A retro-styled web interface for NeukoAI Character Image Studio API.
"""

import json
import os
import re
import shutil
import subprocess
import time
import webbrowser
import threading
from pathlib import Path

from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
import requests as http_requests

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────

API_BASE_URL = "https://api-imagegen.neuko.ai"
CONFIG_PATH = Path(__file__).parent / "user_credentials.json"
CHARACTERS_DIR = Path(__file__).parent / "characters"
PORT = 5777

app = Flask(
    __name__,
    static_folder="static",
    template_folder="templates",
)
CORS(app)


# ──────────────────────────────────────────────
# Credential helpers
# ──────────────────────────────────────────────

def load_credentials() -> dict:
    """Load saved credentials from disk."""
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def save_credentials(data: dict):
    """Persist credentials to disk."""
    existing = load_credentials()
    existing.update(data)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2)


def get_auth_header() -> dict:
    """Return Authorization header from stored token."""
    creds = load_credentials()
    token = creds.get("access_token", "")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def auto_login() -> dict | None:
    """Try to login with stored credentials. Returns token data or None."""
    creds = load_credentials()
    cid = creds.get("client_id")
    csecret = creds.get("client_secret")
    if not cid or not csecret:
        return None
    try:
        resp = http_requests.post(
            f"{API_BASE_URL}/api/v1/auth/login",
            json={"client_id": cid, "client_secret": csecret},
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json()
            save_credentials({"access_token": data["access_token"]})
            return data
    except Exception:
        pass
    return None


# ──────────────────────────────────────────────
# Routes — Pages
# ──────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# ──────────────────────────────────────────────
# Routes — Auth
# ──────────────────────────────────────────────

@app.route("/api/register", methods=["POST"])
def register():
    """Register a new account."""
    try:
        resp = http_requests.post(f"{API_BASE_URL}/api/v1/auth/register", timeout=15)
        if resp.status_code in (200, 201):
            data = resp.json()
            save_credentials({
                "client_id": data["client_id"],
                "client_secret": data["client_secret"],
            })
            # Immediately login
            login_resp = http_requests.post(
                f"{API_BASE_URL}/api/v1/auth/login",
                json={"client_id": data["client_id"], "client_secret": data["client_secret"]},
                timeout=15,
            )
            if login_resp.status_code == 200:
                login_data = login_resp.json()
                save_credentials({"access_token": login_data["access_token"]})
                return jsonify({
                    "success": True,
                    "client_id": data["client_id"],
                    "client_secret": data["client_secret"],
                    "message": data.get("message", "Account created!"),
                })
            return jsonify({
                "success": True,
                "client_id": data["client_id"],
                "client_secret": data["client_secret"],
                "message": "Registered but auto-login failed. Use these credentials to log in.",
            })
        else:
            return jsonify({"success": False, "error": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/login", methods=["POST"])
def login():
    """Login with client_id + client_secret."""
    body = request.json or {}
    client_id = body.get("client_id", "").strip()
    client_secret = body.get("client_secret", "").strip()
    if not client_id or not client_secret:
        return jsonify({"success": False, "error": "client_id and client_secret required"}), 400
    try:
        resp = http_requests.post(
            f"{API_BASE_URL}/api/v1/auth/login",
            json={"client_id": client_id, "client_secret": client_secret},
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json()
            save_credentials({
                "client_id": client_id,
                "client_secret": client_secret,
                "access_token": data["access_token"],
            })
            return jsonify({"success": True, "access_token": data["access_token"]})
        else:
            return jsonify({"success": False, "error": f"Login failed ({resp.status_code}): {resp.text}"}), resp.status_code
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/auto-login", methods=["POST"])
def try_auto_login():
    """Try auto-login with stored credentials."""
    result = auto_login()
    if result:
        creds = load_credentials()
        return jsonify({"success": True, "client_id": creds.get("client_id", "")})
    return jsonify({"success": False}), 401


@app.route("/api/me", methods=["GET"])
def me():
    """Get current user info."""
    try:
        resp = http_requests.get(f"{API_BASE_URL}/api/v1/auth/me", headers=get_auth_header(), timeout=10)
        if resp.status_code == 401:
            # Try auto-login
            if auto_login():
                resp = http_requests.get(f"{API_BASE_URL}/api/v1/auth/me", headers=get_auth_header(), timeout=10)
        return jsonify(resp.json()), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/credentials", methods=["GET"])
def get_credentials():
    """Return stored credentials (for display/export — secret is masked)."""
    creds = load_credentials()
    return jsonify({
        "client_id": creds.get("client_id", ""),
        "has_secret": bool(creds.get("client_secret")),
        "has_token": bool(creds.get("access_token")),
    })


@app.route("/api/export-credentials", methods=["GET"])
def export_credentials():
    """Export full credentials for backup."""
    creds = load_credentials()
    return jsonify({
        "client_id": creds.get("client_id", ""),
        "client_secret": creds.get("client_secret", ""),
    })


@app.route("/api/logout", methods=["POST"])
def logout():
    """Clear stored credentials."""
    if CONFIG_PATH.exists():
        CONFIG_PATH.unlink()
    return jsonify({"success": True})


# ──────────────────────────────────────────────
# Routes — Credits
# ──────────────────────────────────────────────

@app.route("/api/balance", methods=["GET"])
def balance():
    try:
        resp = http_requests.get(f"{API_BASE_URL}/api/v1/credits/balance", headers=get_auth_header(), timeout=10)
        if resp.status_code == 401:
            if auto_login():
                resp = http_requests.get(f"{API_BASE_URL}/api/v1/credits/balance", headers=get_auth_header(), timeout=10)
        return jsonify(resp.json()), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/pricing", methods=["GET"])
def pricing():
    try:
        resp = http_requests.get(f"{API_BASE_URL}/api/v1/credits/pricing", timeout=10)
        return jsonify(resp.json()), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/transactions", methods=["GET"])
def transactions():
    page = request.args.get("page", 1)
    limit = request.args.get("limit", 50)
    try:
        resp = http_requests.get(
            f"{API_BASE_URL}/api/v1/credits/transactions",
            headers=get_auth_header(),
            params={"page": page, "limit": limit},
            timeout=10,
        )
        if resp.status_code == 401:
            if auto_login():
                resp = http_requests.get(
                    f"{API_BASE_URL}/api/v1/credits/transactions",
                    headers=get_auth_header(),
                    params={"page": page, "limit": limit},
                    timeout=10,
                )
        return jsonify(resp.json()), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ──────────────────────────────────────────────
# Routes — Payments
# ──────────────────────────────────────────────

@app.route("/api/bundles", methods=["GET"])
def bundles():
    try:
        resp = http_requests.get(f"{API_BASE_URL}/api/v1/payments/bundles", timeout=10)
        return jsonify(resp.json()), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/checkout", methods=["POST"])
def checkout():
    body = request.json or {}
    try:
        resp = http_requests.post(
            f"{API_BASE_URL}/api/v1/payments/checkout",
            headers=get_auth_header(),
            json={"bundle_id": body.get("bundle_id")},
            timeout=15,
        )
        if resp.status_code == 401:
            if auto_login():
                resp = http_requests.post(
                    f"{API_BASE_URL}/api/v1/payments/checkout",
                    headers=get_auth_header(),
                    json={"bundle_id": body.get("bundle_id")},
                    timeout=15,
                )
        return jsonify(resp.json()), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/payment-status/<int:payment_id>", methods=["GET"])
def payment_status(payment_id):
    try:
        resp = http_requests.get(
            f"{API_BASE_URL}/api/v1/payments/status/{payment_id}",
            headers=get_auth_header(),
            timeout=10,
        )
        if resp.status_code == 401:
            if auto_login():
                resp = http_requests.get(
                    f"{API_BASE_URL}/api/v1/payments/status/{payment_id}",
                    headers=get_auth_header(),
                    timeout=10,
                )
        return jsonify(resp.json()), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ──────────────────────────────────────────────
# Routes — Characters (local storage)
# ──────────────────────────────────────────────

def _load_characters():
    """Load characters registry from disk."""
    reg = CHARACTERS_DIR / "registry.json"
    if reg.exists():
        try:
            with open(reg, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {"characters": []}


def _save_characters(data):
    """Save characters registry to disk."""
    CHARACTERS_DIR.mkdir(exist_ok=True)
    with open(CHARACTERS_DIR / "registry.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _scan_character_folders():
    """Scan characters/ for manually added folders and register them.
    
    Detects subfolders that contain image files but aren't in registry.json,
    and adds them automatically. Also refreshes local_files for existing entries.
    """
    if not CHARACTERS_DIR.exists():
        return
    
    IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'}
    data = _load_characters()
    chars = data.get("characters", [])
    known_slugs = {c.get("slug") for c in chars}
    changed = False

    for entry in CHARACTERS_DIR.iterdir():
        if not entry.is_dir():
            continue
        slug = entry.name
        if slug.startswith('.') or slug == '__pycache__':
            continue

        # Gather image files in this folder
        image_files = sorted([
            f.name for f in entry.iterdir()
            if f.is_file() and f.suffix.lower() in IMAGE_EXTS
        ])

        if not image_files:
            continue  # empty folder — skip

        if slug not in known_slugs:
            # New manually-added folder — register it
            display_name = slug.replace('-', ' ').replace('_', ' ').title()
            print(f"[SCAN] Found new character folder: {slug} ({len(image_files)} images)")
            char_entry = {
                "name": display_name,
                "slug": slug,
                "seed_url": "",
                "reference_urls": [],  # no remote URLs for manual imports
                "local_files": image_files,
                "reference_count": len(image_files),
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "local_dir": str(CHARACTERS_DIR / slug),
            }
            chars.append(char_entry)
            known_slugs.add(slug)
            changed = True
        else:
            # Existing entry — refresh local_files in case user added/removed images
            for c in chars:
                if c.get("slug") == slug:
                    old_files = c.get("local_files", [])
                    if sorted(old_files) != sorted(image_files):
                        print(f"[SCAN] Updated files for {slug}: {len(old_files)} → {len(image_files)}")
                        c["local_files"] = image_files
                        c["reference_count"] = max(len(image_files), len(c.get("reference_urls", [])))
                        changed = True
                    break

    if changed:
        data["characters"] = chars
        _save_characters(data)


def _download_character_images(slug, reference_urls):
    """Download reference images to characters/<slug>/ folder. Returns list of filenames."""
    char_dir = CHARACTERS_DIR / slug
    char_dir.mkdir(parents=True, exist_ok=True)
    local_files = []
    for i, url in enumerate(reference_urls):
        try:
            resp = http_requests.get(url, timeout=60, stream=True)
            if resp.status_code == 200:
                ct = resp.headers.get('content-type', '')
                ext = '.png'
                if 'jpeg' in ct or 'jpg' in ct:
                    ext = '.jpg'
                elif 'webp' in ct:
                    ext = '.webp'
                filename = f"ref_{i+1:02d}{ext}"
                filepath = char_dir / filename
                with open(filepath, 'wb') as f:
                    for chunk in resp.iter_content(8192):
                        f.write(chunk)
                local_files.append(filename)
        except Exception:
            pass
    return local_files


@app.route("/api/characters", methods=["GET"])
def list_characters():
    _scan_character_folders()  # auto-detect manually added folders
    return jsonify(_load_characters())


@app.route("/api/characters/rescan", methods=["POST"])
def rescan_characters():
    """Force rescan of characters/ folder and return updated list."""
    _scan_character_folders()
    data = _load_characters()
    return jsonify({"success": True, "characters": data.get("characters", []), "count": len(data.get("characters", []))})


@app.route("/api/characters", methods=["POST"])
def create_character_entry():
    body = request.json or {}
    name = body.get("name", "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    slug = re.sub(r'[^a-z0-9-]', '', name.lower().replace(' ', '-').replace('_', '-'))
    if not slug:
        slug = "char-" + str(int(time.time()))
    seed_url = body.get("seed_url", "")
    reference_urls = body.get("reference_urls", [])

    # Download images locally
    local_files = _download_character_images(slug, reference_urls)

    data = _load_characters()
    chars = data.get("characters", [])
    chars = [c for c in chars if c.get("slug") != slug]
    char_entry = {
        "name": name,
        "slug": slug,
        "seed_url": seed_url,
        "reference_urls": reference_urls,
        "local_files": local_files,
        "reference_count": len(reference_urls),
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "local_dir": str(CHARACTERS_DIR / slug),
    }
    chars.append(char_entry)
    data["characters"] = chars
    _save_characters(data)
    return jsonify({"success": True, "character": char_entry}), 201


@app.route("/api/characters/<slug>", methods=["GET"])
def get_character(slug):
    data = _load_characters()
    for c in data.get("characters", []):
        if c.get("slug") == slug:
            return jsonify(c)
    return jsonify({"error": "not found"}), 404


@app.route("/api/characters/<slug>", methods=["DELETE"])
def delete_character_entry(slug):
    data = _load_characters()
    data["characters"] = [c for c in data.get("characters", []) if c.get("slug") != slug]
    _save_characters(data)
    # Remove local image folder
    char_dir = CHARACTERS_DIR / slug
    if char_dir.exists():
        shutil.rmtree(char_dir, ignore_errors=True)
    return jsonify({"success": True})


@app.route("/api/characters/<slug>/images/<filename>")
def serve_character_image(slug, filename):
    """Serve locally stored reference images."""
    char_dir = CHARACTERS_DIR / slug
    if not char_dir.exists():
        return jsonify({"error": "not found"}), 404
    return send_from_directory(str(char_dir), filename)


@app.route("/api/characters/<slug>/open-folder", methods=["POST"])
def open_character_folder(slug):
    """Open the character's local image folder in file explorer."""
    char_dir = CHARACTERS_DIR / slug
    if char_dir.exists():
        try:
            if os.name == 'nt':
                os.startfile(str(char_dir))
            elif shutil.which('xdg-open'):
                subprocess.Popen(['xdg-open', str(char_dir)])
            elif shutil.which('open'):
                subprocess.Popen(['open', str(char_dir)])
            return jsonify({"success": True, "path": str(char_dir)})
        except Exception as e:
            return jsonify({"success": False, "error": str(e), "path": str(char_dir)})
    return jsonify({"error": "folder not found", "path": str(char_dir)}), 404


# ──────────────────────────────────────────────
# Routes — Image Generation
# ──────────────────────────────────────────────


def _get_local_refs_as_base64(slug, max_refs=15):
    """Read local reference images for a character and return as base64 data URIs.
    Used when a character has no remote reference_urls (manually imported)."""
    import base64 as b64mod
    data = _load_characters()
    char = None
    for c in data.get("characters", []):
        if c.get("slug") == slug:
            char = c
            break
    if not char:
        return []

    local_files = char.get("local_files", [])
    if not local_files:
        return []

    MIME_MAP = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp',
    }
    char_dir = CHARACTERS_DIR / slug
    result = []
    for fname in local_files[:max_refs]:
        fpath = char_dir / fname
        if not fpath.is_file():
            continue
        ext = fpath.suffix.lower()
        mime = MIME_MAP.get(ext, 'image/png')
        try:
            raw = fpath.read_bytes()
            b64 = b64mod.b64encode(raw).decode('ascii')
            data_uri = f"data:{mime};base64,{b64}"
            # Compress if too large (>4MB)
            data_uri = _compress_base64_image(data_uri)
            result.append(data_uri)
        except Exception as e:
            print(f"[BASE64] Error reading {fpath}: {e}")
    print(f"[BASE64] Converted {len(result)} local images for character '{slug}'")
    return result


@app.route("/api/generate/seed", methods=["POST"])
def generate_seed():
    body = request.json or {}
    try:
        resp = http_requests.post(
            f"{API_BASE_URL}/api/v1/generate/seed",
            headers=get_auth_header(),
            json={
                "prompt": body.get("prompt", ""),
                "aspect_ratio": body.get("aspect_ratio", "1:1"),
            },
            timeout=60,
        )
        if resp.status_code == 401:
            if auto_login():
                resp = http_requests.post(
                    f"{API_BASE_URL}/api/v1/generate/seed",
                    headers=get_auth_header(),
                    json={
                        "prompt": body.get("prompt", ""),
                        "aspect_ratio": body.get("aspect_ratio", "1:1"),
                    },
                    timeout=60,
                )
        # Pass through 402 (insufficient credits) and 429 (rate limit)
        if resp.status_code in (402, 429):
            try:
                return jsonify(resp.json()), resp.status_code
            except Exception:
                return jsonify({"error": f"HTTP {resp.status_code}"}), resp.status_code
        try:
            return jsonify(resp.json()), resp.status_code
        except Exception:
            return jsonify({"error": f"API returned non-JSON (HTTP {resp.status_code})"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/generate/create", methods=["POST"])
def generate_create():
    body = request.json or {}
    ref_urls = body.get("reference_image_urls", [])
    # If no remote URLs but a character_slug provided, use local images as base64
    char_slug = body.get("character_slug", "")
    if not ref_urls and char_slug:
        ref_urls = _get_local_refs_as_base64(char_slug)
        if not ref_urls:
            return jsonify({"error": "Character has no reference images (local or remote)"}), 400
    try:
        payload = {
            "prompt": body.get("prompt", ""),
            "reference_image_urls": ref_urls,
            "input_image_url": body.get("input_image_url", None),
        }
        resp = http_requests.post(
            f"{API_BASE_URL}/api/v1/generate/create",
            headers=get_auth_header(),
            json=payload,
            timeout=60,
        )
        if resp.status_code == 401:
            if auto_login():
                resp = http_requests.post(
                    f"{API_BASE_URL}/api/v1/generate/create",
                    headers=get_auth_header(),
                    json=payload,
                    timeout=60,
                )
        if resp.status_code in (402, 429):
            try:
                return jsonify(resp.json()), resp.status_code
            except Exception:
                return jsonify({"error": f"HTTP {resp.status_code}"}), resp.status_code
        try:
            return jsonify(resp.json()), resp.status_code
        except Exception:
            return jsonify({"error": f"API returned non-JSON (HTTP {resp.status_code})"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/generate/random", methods=["POST"])
def generate_random():
    body = request.json or {}
    ref_urls = body.get("reference_image_urls", [])
    # If no remote URLs but a character_slug provided, use local images as base64
    char_slug = body.get("character_slug", "")
    if not ref_urls and char_slug:
        ref_urls = _get_local_refs_as_base64(char_slug)
        if not ref_urls:
            return jsonify({"error": "Character has no reference images (local or remote)"}), 400
    try:
        payload = {
            "reference_image_urls": ref_urls,
            "character_description": body.get("character_description", ""),
        }
        resp = http_requests.post(
            f"{API_BASE_URL}/api/v1/generate/random",
            headers=get_auth_header(),
            json=payload,
            timeout=60,
        )
        if resp.status_code == 401:
            if auto_login():
                resp = http_requests.post(
                    f"{API_BASE_URL}/api/v1/generate/random",
                    headers=get_auth_header(),
                    json=payload,
                    timeout=60,
                )
        if resp.status_code in (402, 429):
            try:
                return jsonify(resp.json()), resp.status_code
            except Exception:
                return jsonify({"error": f"HTTP {resp.status_code}"}), resp.status_code
        try:
            return jsonify(resp.json()), resp.status_code
        except Exception:
            return jsonify({"error": f"API returned non-JSON (HTTP {resp.status_code})"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _compress_base64_image(data_url: str, max_bytes: int = 4_000_000) -> str:
    """If the base64 image is too large, compress it. Returns data URL."""
    import base64 as b64mod
    try:
        header, b64data = data_url.split(",", 1)
        img_bytes = b64mod.b64decode(b64data)
        size = len(img_bytes)
        print(f"[COMPRESS] Image size: {size} bytes ({size/1024/1024:.1f} MB)")
        if size <= max_bytes:
            return data_url  # no compression needed

        # Compress using PIL if available
        try:
            from PIL import Image
            import io
            img = Image.open(io.BytesIO(img_bytes))
            # Resize if very large
            max_dim = 2048
            if max(img.size) > max_dim:
                img.thumbnail((max_dim, max_dim), Image.LANCZOS)
                print(f"[COMPRESS] Resized to {img.size}")
            # Save as JPEG with quality reduction
            buf = io.BytesIO()
            img = img.convert("RGB")
            quality = 85
            img.save(buf, format="JPEG", quality=quality)
            while buf.tell() > max_bytes and quality > 30:
                quality -= 10
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=quality)
            compressed = buf.getvalue()
            print(f"[COMPRESS] Compressed: {len(compressed)} bytes (quality={quality})")
            b64 = b64mod.b64encode(compressed).decode()
            return f"data:image/jpeg;base64,{b64}"
        except ImportError:
            print("[COMPRESS] PIL not available, sending as-is (may be too large)")
            return data_url
    except Exception as e:
        print(f"[COMPRESS] Error: {e}")
        return data_url


@app.route("/api/generate/turnaround", methods=["POST"])
def generate_turnaround():
    body = request.json or {}
    seed_url = body.get("seed_image_url", "")
    prompts = body.get("prompts", [])
    ref_urls = body.get("reference_image_urls", [])

    print(f"[TURNAROUND] seed_image_url length: {len(seed_url)}, starts_with: {seed_url[:80] if seed_url else '(empty)'}")
    print(f"[TURNAROUND] prompts count: {len(prompts)}, ref_urls count: {len(ref_urls)}")

    # API accepts base64 data URLs directly — no external hosting needed
    # Just compress if over 4MB
    if seed_url.startswith("data:"):
        print("[TURNAROUND] Detected base64 seed image — checking size...")
        seed_url = _compress_base64_image(seed_url)
        print(f"[TURNAROUND] Final data URL length: {len(seed_url)} chars")

    payload = {
        "seed_image_url": seed_url,
        "prompts": prompts,
        "reference_image_urls": ref_urls,
    }

    # Retry logic for 502/504 gateway errors (API overloaded)
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            resp = http_requests.post(
                f"{API_BASE_URL}/api/v1/generate/turnaround",
                headers=get_auth_header(),
                json=payload,
                timeout=180,
            )
            print(f"[TURNAROUND] Attempt {attempt} — API response status: {resp.status_code}")
            print(f"[TURNAROUND] API response body: {resp.text[:500]}")

            if resp.status_code == 401:
                if auto_login():
                    resp = http_requests.post(
                        f"{API_BASE_URL}/api/v1/generate/turnaround",
                        headers=get_auth_header(),
                        json=payload,
                        timeout=180,
                    )
                    print(f"[TURNAROUND] Retry-auth response status: {resp.status_code}")
                    print(f"[TURNAROUND] Retry-auth response body: {resp.text[:500]}")

            # Retry on 502/504 gateway errors (API gateway overloaded, not a real failure)
            if resp.status_code in (502, 503, 504) and attempt < max_retries:
                wait = attempt * 10  # 10s, 20s
                print(f"[TURNAROUND] Got {resp.status_code} — retrying in {wait}s (attempt {attempt}/{max_retries})...")
                time.sleep(wait)
                continue

            try:
                return jsonify(resp.json()), resp.status_code
            except Exception:
                print(f"[TURNAROUND] Failed to parse JSON response: {resp.text[:500]}")
                # On last attempt, return error; otherwise retry
                if attempt < max_retries:
                    wait = attempt * 10
                    print(f"[TURNAROUND] Non-JSON response — retrying in {wait}s...")
                    time.sleep(wait)
                    continue
                return jsonify({"error": f"API returned non-JSON response (HTTP {resp.status_code}): {resp.text[:200]}"}), 502

        except http_requests.exceptions.Timeout:
            print(f"[TURNAROUND] Timeout on attempt {attempt}/{max_retries}")
            if attempt < max_retries:
                wait = attempt * 10
                print(f"[TURNAROUND] Retrying in {wait}s...")
                time.sleep(wait)
                continue
            return jsonify({"error": "API request timed out after multiple retries"}), 504

        except Exception as e:
            print(f"[TURNAROUND] Exception on attempt {attempt}: {e}")
            if attempt < max_retries:
                time.sleep(5)
                continue
            return jsonify({"error": str(e)}), 500

    return jsonify({"error": "All retry attempts failed"}), 502


# ──────────────────────────────────────────────
# Routes — Asset Status & Download
# ──────────────────────────────────────────────

@app.route("/api/asset/status/<generation_id>", methods=["GET"])
def asset_status(generation_id):
    try:
        resp = http_requests.get(
            f"{API_BASE_URL}/api/v1/asset/status/{generation_id}",
            headers=get_auth_header(),
            timeout=30,
        )
        if resp.status_code == 401:
            if auto_login():
                resp = http_requests.get(
                    f"{API_BASE_URL}/api/v1/asset/status/{generation_id}",
                    headers=get_auth_header(),
                    timeout=30,
                )
        # Pass 429 through to frontend for rate-limit backoff
        if resp.status_code == 429:
            print(f"[STATUS] {generation_id[:8]}... RATE LIMITED (429)")
            return jsonify({"error": "rate_limited"}), 429
        try:
            data = resp.json()
        except Exception:
            print(f"[STATUS] {generation_id[:8]}... non-JSON response (HTTP {resp.status_code}): {resp.text[:200]}")
            # Return a temporary-error marker so JS knows to retry
            return jsonify({"data": {"status": "pending"}, "_retry": True}), 200
        inner = data.get('data', data)
        status = inner.get('status', '?')
        print(f"[STATUS] {generation_id[:8]}... → {status}")
        return jsonify(data), resp.status_code
    except http_requests.exceptions.Timeout:
        print(f"[STATUS] {generation_id[:8]}... TIMEOUT")
        return jsonify({"data": {"status": "pending"}, "_retry": True}), 200
    except Exception as e:
        print(f"[STATUS] {generation_id[:8]}... ERROR: {e}")
        return jsonify({"data": {"status": "pending"}, "_retry": True}), 200


@app.route("/api/asset/download/<generation_id>", methods=["GET"])
def asset_download(generation_id):
    try:
        resp = http_requests.get(
            f"{API_BASE_URL}/api/v1/asset/download/{generation_id}",
            headers=get_auth_header(),
            timeout=30,
        )
        if resp.status_code == 401:
            if auto_login():
                resp = http_requests.get(
                    f"{API_BASE_URL}/api/v1/asset/download/{generation_id}",
                    headers=get_auth_header(),
                    timeout=30,
                )
        # Pass 429 (rate limit) and 409 (not ready) through to frontend
        if resp.status_code == 429:
            print(f"[DOWNLOAD] {generation_id[:8]}... RATE LIMITED (429)")
            return jsonify({"error": "rate_limited"}), 429
        if resp.status_code == 409:
            print(f"[DOWNLOAD] {generation_id[:8]}... NOT READY (409)")
            return jsonify({"error": "not_ready"}), 409
        try:
            data = resp.json()
        except Exception:
            print(f"[DOWNLOAD] {generation_id[:8]}... non-JSON response (HTTP {resp.status_code}): {resp.text[:200]}")
            return jsonify({"error": "temporary", "_retry": True}), 503
        print(f"[DOWNLOAD] {generation_id[:8]}... → HTTP {resp.status_code}, body: {str(data)[:200]}")
        return jsonify(data), resp.status_code
    except http_requests.exceptions.Timeout:
        print(f"[DOWNLOAD] {generation_id[:8]}... TIMEOUT")
        return jsonify({"error": "temporary", "_retry": True}), 503
    except Exception as e:
        print(f"[DOWNLOAD] {generation_id[:8]}... ERROR: {e}")
        return jsonify({"error": str(e), "_retry": True}), 503


# ──────────────────────────────────────────────
# Startup
# ──────────────────────────────────────────────

def open_browser():
    """Open browser after a short delay."""
    time.sleep(1.5)
    webbrowser.open(f"http://localhost:{PORT}")


if __name__ == "__main__":
    print(r"""
    ╔══════════════════════════════════════════════════╗
    ║   ★ CHARACTER IMAGE STUDIO ★                     ║
    ║   ─────────────────────────────────────────────   ║
    ║   Retro UI for NeukoAI Image Generation          ║
    ║   http://localhost:5777                           ║
    ╚══════════════════════════════════════════════════╝
    """)
    threading.Thread(target=open_browser, daemon=True).start()
    app.run(host="127.0.0.1", port=PORT, debug=False)
