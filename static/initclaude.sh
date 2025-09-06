#!/bin/bash

# Claude and GitHub setup script
# Usage: curl -sSL https://renxida.github.io/initclaude.sh | bash

echo "Starting setup..."

# GitHub authentication first
echo "Authenticating with GitHub..."
gh auth login

# Clone stroop repo in background
echo "Cloning stroop repository in background..."
nohup gh repo clone stroop > ./git_clone_stroop.log 2>&1 &

# Install Claude CLI
echo "Installing Claude CLI..."
npm install -g @anthropic-ai/claude-code

# Initialize Claude in tmux window (for interactive setup)
echo "Starting Claude initialization in tmux..."
tmux new-window -n 'claude-init' 'claude'

# Wait a moment for user to complete init, then set permissions
echo "Once Claude initialization is complete, press Enter to configure permissions..."
read -r

# Create Claude settings directory if it doesn't exist
mkdir -p ~/.claude

# Write permissions to settings.json
cat > ~/.claude/settings.json << 'EOF'
{
  "permissions": {
    "allow": [
      "Read()",
      "Search()",
      "Edit()",
      "Write()",
      "Bash(*)"
    ]
  }
}
EOF

echo "Setup complete!"
echo "- GitHub authenticated"
echo "- Stroop repository cloning in background (check ./git_clone_stroop.log)"
echo "- Claude CLI installed and permissions configured"