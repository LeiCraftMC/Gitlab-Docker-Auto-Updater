#!/bin/bash

BIN_PATH="/usr/local/bin/gitlab-docker-auto-updater"

function install {
    # Determine the system architecture
    ARCH=$(uname -m)
    if [ "$ARCH" = "x86_64" ]; then
        ARCH="linux-x64"
    elif [ "$ARCH" = "aarch64" ]; then
        ARCH="linux-arm64"
    else
        echo "Unsupported architecture: $ARCH"
        exit 1
    fi

    # Fetch the latest release or pre-release version from GitHub API
    LATEST_RELEASE=$(curl -s https://api.github.com/repos/LeiCraftMC/Gitlab-Docker-Auto-Updater/releases | grep -E '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' | head -n 1)

    URL="https://github.com/LeiCraftMC/Gitlab-Docker-Auto-Updater/releases/download/${LATEST_RELEASE}/gitlab-docker-auto-updater-${LATEST_RELEASE}-${ARCH}"

    # Download the appropriate binary
    echo "Downloading Gitlab Docker Auto Updater version $LATEST_RELEASE for architecture $ARCH..."
    curl -L -o "$BIN_PATH" "$URL"

    if [ $? -eq 0 ]; then
        echo "Download completed successfully."
        chmod u+x "$BIN_PATH"
    else
        echo "Download failed. Please check your connection or the URL."
        exit 1
    fi
}

function main {

    if [ -f "$BIN_PATH" ]; then
        echo "Gitlab Docker Auto Updater is already installed."
        read -p "Do you want to reinstall or upgrade Gitlab Docker Auto Updater? (y/n): " reinstall_choice
        if [ "$reinstall_choice" != "y" ]; then
            echo "Installation aborted."
            exit 1
        fi
    fi

    install

    echo "Gitlab Docker Auto Updater has been installed successfully."
}

main