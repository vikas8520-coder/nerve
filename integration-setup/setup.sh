#!/bin/bash
# Nerve Integration Setup Script
# This script automatically configures Grok, OpenCode, and fallback scripts for seamless Nerve integration

set -e

echo "🚀 Nerve Integration Setup"
echo "============================"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if Nerve is running
print_info "Checking if Nerve is running..."
if curl -s http://localhost:20128/v1/models > /dev/null 2>&1; then
    print_success "Nerve is running on http://localhost:20128"
else
    print_warning "Nerve is not running. Please start Nerve first with: nerve serve --daemon"
    exit 1
fi

# Setup Grok configuration
print_info "Setting up Grok configuration..."
GROK_CONFIG="$HOME/.grok/config.toml"
GROK_DIR="$HOME/.grok"

if [ ! -d "$GROK_DIR" ]; then
    mkdir -p "$GROK_DIR"
    print_info "Created Grok config directory"
fi

# Backup existing config if it exists
if [ -f "$GROK_CONFIG" ]; then
    BACKUP_FILE="$GROK_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$GROK_CONFIG" "$BACKUP_FILE"
    print_info "Backed up existing Grok config to $BACKUP_FILE"
fi

# Copy new Grok config
cp "$(dirname "$0")/grok-config.toml" "$GROK_CONFIG"
print_success "Grok configuration updated"

# Setup OpenCode configuration
print_info "Setting up OpenCode configuration..."
OPENCODE_CONFIG="$HOME/.config/opencode/opencode.json"
OPENCODE_DIR="$HOME/.config/opencode"

if [ ! -d "$OPENCODE_DIR" ]; then
    mkdir -p "$OPENCODE_DIR"
    print_info "Created OpenCode config directory"
fi

# Backup existing config if it exists
if [ -f "$OPENCODE_CONFIG" ]; then
    BACKUP_FILE="$OPENCODE_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$OPENCODE_CONFIG" "$BACKUP_FILE"
    print_info "Backed up existing OpenCode config to $BACKUP_FILE"
fi

# Merge OpenCode config (need to preserve existing MCP and other settings)
print_info "Merging OpenCode configuration..."
if [ -f "$OPENCODE_CONFIG" ]; then
    # Use Python to merge JSON files
    python3 << EOF
import json

# Load existing config
with open('$OPENCODE_CONFIG', 'r') as f:
    existing_config = json.load(f)

# Load new nerve provider config
with open('$(dirname "$0")/opencode-config.json', 'r') as f:
    nerve_config = json.load(f)

# Merge nerve provider into existing providers
if 'provider' not in existing_config:
    existing_config['provider'] = {}
existing_config['provider']['nerve'] = nerve_config['provider']['nerve']

# Set default model to nerve
existing_config['model'] = nerve_config['model']

# Write merged config
with open('$OPENCODE_CONFIG', 'w') as f:
    json.dump(existing_config, f, indent=2)
EOF
else
    cp "$(dirname "$0")/opencode-config.json" "$OPENCODE_CONFIG"
fi
print_success "OpenCode configuration updated"

# Setup fallback scripts
print_info "Setting up fallback scripts..."
BIN_DIR="$HOME/.local/bin"

if [ ! -d "$BIN_DIR" ]; then
    mkdir -p "$BIN_DIR"
    print_info "Created bin directory"
fi

# Copy and make executable
cp "$(dirname "$0")/grok-fallback" "$BIN_DIR/grok-fallback"
chmod +x "$BIN_DIR/grok-fallback"
print_success "Grok fallback script installed"

cp "$(dirname "$0")/opencode-fallback" "$BIN_DIR/opencode-fallback"
chmod +x "$BIN_DIR/opencode-fallback"
print_success "OpenCode fallback script installed"

# Verify Grok models
print_info "Verifying Grok configuration..."
if command -v grok &> /dev/null; then
    echo "Available Grok models:"
    grok models
    print_success "Grok configuration verified"
else
    print_warning "Grok CLI not found. Install it from: https://github.com/xai-org/grok"
fi

# Verify OpenCode models
print_info "Verifying OpenCode configuration..."
if command -v opencode &> /dev/null; then
    echo "Available OpenCode models (nerve models only):"
    opencode models | grep "nerve/"
    print_success "OpenCode configuration verified"
else
    print_warning "OpenCode CLI not found. Install it from: https://opencode.ai"
fi

# Setup Claude Code configuration
print_info "Setting up Claude Code configuration..."
CLAUDE_CONFIG="$HOME/.claude/settings.json"
CLAUDE_DIR="$HOME/.claude"

if [ -d "$CLAUDE_DIR" ]; then
    # Backup existing config if it exists
    if [ -f "$CLAUDE_CONFIG" ]; then
        BACKUP_FILE="$CLAUDE_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$CLAUDE_CONFIG" "$BACKUP_FILE"
        print_info "Backed up existing Claude Code config to $BACKUP_FILE"
    fi

    # Update Claude Code config to use Nerve
    # Update the base URL to point to Nerve
    python3 << EOF
import json

try:
    with open('$CLAUDE_CONFIG', 'r') as f:
        config = json.load(f)
    
    # Update or add env section for Nerve
    if 'env' not in config:
        config['env'] = {}
    
    config['env']['ANTHROPIC_BASE_URL'] = 'http://localhost:20128/v1'
    config['env']['ANTHROPIC_MODEL'] = 'auto/best-coding'
    config['env']['ANTHROPIC_AUTH_TOKEN'] = ''
    config['model'] = 'auto/best-coding'
    
    with open('$CLAUDE_CONFIG', 'w') as f:
        json.dump(config, f, indent=2)
    
    print("Claude Code configuration updated")
except Exception as e:
    print(f"Error updating Claude Code config: {e}")
EOF

    print_success "Claude Code configuration updated"
else
    print_warning "Claude Code directory not found. Install Claude Code from: https://claude.ai/code"
fi

# Setup Claude Code fallback script
print_info "Setting up Claude Code fallback script..."
cp "$(dirname "$0")/claude-fallback" "$BIN_DIR/claude-fallback"
chmod +x "$BIN_DIR/claude-fallback"
print_success "Claude Code fallback script installed"

# Verify Claude Code
print_info "Verifying Claude Code configuration..."
if command -v claude &> /dev/null; then
    print_success "Claude Code CLI found and configured"
else
    print_warning "Claude Code CLI not found. Install it from: https://claude.ai/code"
fi

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "You can now use Nerve models with:"
echo "  • Grok: grok (interactive) or grok-fallback \"prompt\" (with fallback)"
echo "  • OpenCode: opencode (interactive) or opencode-fallback \"prompt\" (with fallback)"
echo "  • Claude Code: claude (interactive) or claude-fallback \"prompt\" (with fallback)"
echo ""
echo "Available models:"
echo "  • nerve-best: Best coding model (1M context)"
echo "  • nerve-reasoning: Best reasoning model (1M context)"
echo "  • nerve-chat: Best chat model (1M context)"
echo "  • nerve-2m: 2M context window for large tasks"
echo "  • nerve-grok: Grok 4.20 with 2M context"
echo "  • nerve-pareto: Pareto Code with 2M context"
echo ""
echo "The fallback system will automatically switch models if one fails!"
echo ""