#!/bin/bash

# Claude and GitHub setup script
# Usage: curl -sSL https://renxida.github.io/initclaude.sh | bash

# Create tmux windows for Claude setup
tmux new-window -n 'claude-setup' 'npm install -g @anthropic-ai/claude-code && claude'
tmux new-window -n 'gh-setup' 'gh auth login && gh repo clone stroop'

echo "Claude and GitHub setup windows created in tmux"
echo "Switch to 'claude-setup' window to complete Claude installation"
echo "Switch to 'gh-setup' window to authenticate with GitHub"