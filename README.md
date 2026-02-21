# Character Image Studio

A free, open-source web interface for the [NeukoAI Character Image Studio](https://github.com/NeukoAI/agent-skills/tree/main/character-image-studio) API.

Create AI characters from a single image and generate them in any scene — all from your browser.

> **This project is not affiliated with NeukoAI.** It's built for people who want to try the Character Image Studio API without setting up AI agents or writing code.

---

## What It Does

| Step | Action | Cost |
|------|--------|------|
| **1. SetChar** | Upload any image of your character → AI generates 20 reference images (different angles, poses, lighting) | ~200 credits |
| **2. Generate** | Pick a saved character + describe a scene → AI generates your character in that scene | 10 credits |

Characters are saved locally. Generate as many images as you want.

---

## Quick Start

### Windows
**Double-click `start.bat`**

### macOS
**Double-click `start.command`**

### Linux
```bash
chmod +x start.sh
./start.sh
```

Both launchers do the same thing:
- Install Python automatically if not found (asks for confirmation)
- Create a virtual environment, install dependencies
- Start the server and open `http://localhost:5777` in your browser

First launch → click **Create New Account** (no email, instant). **Save your credentials** — the Client Secret is shown only once.

---

## How It Works

1. You upload an image and give your character a name
2. The app sends the image to the NeukoAI API, which generates 20 reference images from different angles
3. These references are downloaded and saved in a local `characters/` folder
4. When you generate, the app sends the references + your scene prompt to the API
5. The result is displayed and saved to your local gallery

**All data stays on your machine.** Credentials are stored in a local `user_credentials.json` file. Nothing is sent anywhere except the NeukoAI API.

---

## Project Structure

```
cis/
├── app.py                 # Flask backend — proxies requests to NeukoAI API
├── start.bat              # Windows launcher (auto-installs Python if needed)
├── start.command          # macOS launcher (double-click to run)
├── start.sh               # Linux/macOS launcher (auto-installs Python if needed)
├── requirements.txt       # Python dependencies (Flask, Requests, Pillow)
├── .gitignore
├── static/
│   ├── css/style.css      # UI styles (dark theme, glass-morphism)
│   └── js/app.js          # Frontend logic (vanilla JS, no frameworks)
└── templates/
    └── index.html         # Single-page app template
```

**Created at runtime (not in repo):**
- `user_credentials.json` — your account credentials (auto-created on first login)
- `characters/` — downloaded reference images for your characters
- `venv/` — Python virtual environment (created by `start.bat`)

---

## Credits & Payments

- Credits are purchased through **Stripe** (secure, industry-standard)
- Pricing is loaded live from the API — no markup, no hidden fees
- ~200 credits for character creation (20 images × 10 credits each)
- 10 credits per generated image

---

## Tech Stack

- **Backend:** Python / Flask 3.1 — lightweight API proxy
- **Frontend:** Vanilla HTML/CSS/JS — no build step, no frameworks
- **API:** [NeukoAI Character Image Studio](https://github.com/NeukoAI/agent-skills)
- **Images:** Stored locally, base64 upload (no external hosting needed)
- **Compression:** Pillow for images >4MB

---

## FAQ

**Q: Is this official NeukoAI software?**
No. This is an independent, open-source project that uses the public NeukoAI API.

**Q: Do I need to know how to code?**
No. Double-click `start.bat` and use the web interface. Python installs automatically if needed.

**Q: Where is my data stored?**
Everything is local — credentials in `user_credentials.json`, characters in `characters/`, gallery in browser localStorage.

**Q: Can I use this on Mac/Linux?**
Yes — run `./start.sh`. It works the same as `start.bat` on Windows.

**Q: How do I move to another computer?**
Copy your `user_credentials.json` file. Log in with your Client ID + Client Secret.

---

## Links

- [NeukoAI Agent Skills (source API)](https://github.com/NeukoAI/agent-skills)
- [Character Image Studio API Docs](https://github.com/NeukoAI/agent-skills/tree/main/character-image-studio)

## License

MIT
