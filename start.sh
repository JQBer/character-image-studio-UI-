#!/usr/bin/env bash
set -e

echo ""
echo "  ========================================"
echo "      Character Image Studio  -  Launcher"
echo "  ========================================"
echo ""

cd "$(dirname "$0")"

# ── Check for existing venv ──
if [ -f "venv/bin/python" ]; then
    echo "  [OK] Virtual environment found"
else
    # ── Find Python ──
    PYTHON=""
    if command -v python3 &>/dev/null; then
        PV=$(python3 --version 2>&1)
        echo "$PV" | grep -q "Python 3" && PYTHON="python3"
    fi
    if [ -z "$PYTHON" ] && command -v python &>/dev/null; then
        PV=$(python --version 2>&1)
        echo "$PV" | grep -q "Python 3" && PYTHON="python"
    fi

    if [ -z "$PYTHON" ]; then
        echo "  [!!] Python 3 not found on your system."
        echo ""
        echo "  Install it with your package manager:"
        echo ""
        echo "    Ubuntu/Debian:  sudo apt install python3 python3-venv python3-pip"
        echo "    Fedora:         sudo dnf install python3 python3-pip"
        echo "    Arch:           sudo pacman -S python python-pip"
        echo "    macOS:          brew install python3"
        echo ""
        read -p "  Would you like to try installing automatically? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if command -v apt &>/dev/null; then
                echo "  [..] Installing via apt..."
                sudo apt update && sudo apt install -y python3 python3-venv python3-pip
            elif command -v dnf &>/dev/null; then
                echo "  [..] Installing via dnf..."
                sudo dnf install -y python3 python3-pip
            elif command -v pacman &>/dev/null; then
                echo "  [..] Installing via pacman..."
                sudo pacman -S --noconfirm python python-pip
            elif command -v brew &>/dev/null; then
                echo "  [..] Installing via Homebrew..."
                brew install python3
            else
                echo "  [ERROR] Could not detect package manager."
                echo "  Please install Python 3.10+ manually and run this script again."
                exit 1
            fi

            # Re-check
            PYTHON=""
            command -v python3 &>/dev/null && PYTHON="python3"
            if [ -z "$PYTHON" ]; then
                echo "  [ERROR] Installation failed. Please install Python 3 manually."
                exit 1
            fi
            PV=$($PYTHON --version 2>&1)
            echo "  [OK] Installed: $PV"
        else
            echo "  Please install Python 3.10+ and run this script again."
            exit 1
        fi
    fi

    echo "  [OK] Found: $PV"
    echo "  [..] Creating virtual environment..."
    $PYTHON -m venv venv
    if [ $? -ne 0 ]; then
        echo "  [ERROR] Failed to create venv. On Debian/Ubuntu, try:"
        echo "    sudo apt install python3-venv"
        exit 1
    fi
    echo "  [OK] Virtual environment created"
fi

# ── Install dependencies ──
echo "  [..] Checking dependencies..."
venv/bin/pip install -q -r requirements.txt 2>/dev/null || {
    echo "  [..] Installing dependencies..."
    venv/bin/pip install flask requests flask-cors Pillow
}
echo "  [OK] Dependencies ready"

# ── Launch ──
echo ""
echo "  [>>] Starting Character Image Studio..."
echo "  [>>] Opening http://localhost:5777"
echo ""
echo "  ----------------------------------------"
echo "  Press Ctrl+C to stop the server"
echo "  ----------------------------------------"
echo ""

# Try to open browser
if command -v xdg-open &>/dev/null; then
    (sleep 1 && xdg-open "http://localhost:5777") &
elif command -v open &>/dev/null; then
    (sleep 1 && open "http://localhost:5777") &
fi

venv/bin/python app.py
