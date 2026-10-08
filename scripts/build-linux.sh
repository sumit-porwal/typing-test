#!/usr/bin/env bash
set -e

echo "========================================================"
echo "        KeyVibe Desktop - Linux App Builder             "
echo "========================================================"

# Auto-install dependencies on Debian/Ubuntu based distros
if command -v apt-get &> /dev/null; then
    echo "Installing required Linux GTK/WebKit dependencies..."
    sudo apt-get update
    sudo apt-get install -y \
        libwebkit2gtk-4.1-dev \
        build-essential \
        curl \
        wget \
        file \
        libxdo-dev \
        libssl-dev \
        libayatana-appindicator3-dev \
        librsvg2-dev \
        squashfs-tools
fi

# Verify Rust / Cargo
if ! command -v cargo &> /dev/null; then
    echo "Installing Rust toolchain..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

echo "Installing node dependencies..."
npm install

echo "Building frontend & Tauri Linux app (.deb & .AppImage)..."
npm run tauri:build

echo ""
echo "========================================================"
echo " [SUCCESS] Linux App Built Successfully! "
echo " Bundles located in: src-tauri/target/release/bundle/"
echo " - Debian/Ubuntu: .deb package"
echo " - Universal:     .AppImage package"
echo "========================================================"
