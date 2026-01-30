#!/bin/bash
# Git Remote Setup Script - FIXED

if [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: GITHUB_TOKEN secret is not set!"
    exit 1
fi

git config --global user.email "digimun49@users.noreply.github.com"
git config --global user.name "digimun49"

# FIXED: Using hyphen instead of underscore (Digimun-Backup)
git remote set-url origin "https://digimun49:${GITHUB_TOKEN}@github.com/digimun49/Digimun-Backup.git" 2>/dev/null || \
git remote add origin "https://digimun49:${GITHUB_TOKEN}@github.com/digimun49/Digimun-Backup.git"

echo "Git configured with correct repo name!"
echo "Now run: git push -u origin main"
