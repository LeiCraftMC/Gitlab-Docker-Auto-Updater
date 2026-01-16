#!/bin/bash

BIN_PATH="/usr/local/bin/gitlab-docker-auto-updater"

function delete_bin {
    rm -f "$BIN_PATH"
}

function main {

    if [[ ! -f "$BIN_PATH" ]]; then
        echo "Gitlab Docker Auto Updater is not installed."
        exit 1
    fi

    read -p "Are you sure you want to uninstall Gitlab Docker Auto Updater? (y/n): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "Uninstallation aborted."
        exit 1
    fi

    delete_bin

    echo "Gitlab Docker Auto Updater has been uninstalled successfully."
}

main