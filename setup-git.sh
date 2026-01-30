#!/bin/bash
# Git Remote Setup Script
# This script configures git to use your GITHUB_TOKEN

if [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: GITHUB_TOKEN secret is not set!"
    echo "Please add your GitHub token in Replit Secrets first."
    exit 1
fi

# Configure git
git config --global user.email "digimun49@users.noreply.github.com"
git config --global user.name "digimun49"

# Set the remote URL with token
git remote set-url origin "https://digimun49:${GITHUB_TOKEN}@github.com/digimun49/Digimun_Backup.git" 2>/dev/null || \
git remote add origin "https://digimun49:${GITHUB_TOKEN}@github.com/digimun49/Digimun_Backup.git"

echo "Git configured successfully!"
echo "Now run: git push -u origin main"
