# Nerve Integration Setup

Seamless integration of Nerve AI router with popular terminal AI assistants (Grok, OpenCode, Claude Code, Hermes, etc.) with automatic model fallback for flawless coding.

## 🚀 Quick Start

```bash
# 1. Make sure Nerve is running
nerve serve --daemon

# 2. Run the setup script
cd integration-setup
./setup.sh
```

That's it! The setup script will automatically configure everything.

## 📋 What This Setup Provides

### ✅ Grok Integration
- **6 Nerve models** configured with proper context windows (1M and 2M tokens)
- **Automatic fallback** when models hit token limits or fail
- **Default model**: `nerve-grok` (Grok 4.20 with 2M context)

### ✅ OpenCode Integration  
- **6 Nerve models** configured as direct provider
- **Automatic fallback** system for seamless operation
- **Default model**: `nerve/openrouter/x-ai/grok-4.20`

### ✅ Claude Code Integration
- **Nerve endpoint** configured to use local Nerve router
- **Auto model selection** with `auto/best-coding` as default
- **Automatic fallback** script for seamless operation
- **Default model**: `auto/best-coding` via Nerve

### ✅ Fallback Scripts
- **`grok-fallback`**: Automatic model switching for Grok
- **`opencode-fallback`**: Automatic model switching for OpenCode
- **`claude-fallback`**: Automatic model switching for Claude Code
- **Zero manual intervention** when models fail

## 🎯 Available Models

### 1M Context Window Models
- **`nerve-best`**: Best coding model via Nerve router
- **`nerve-reasoning`**: Best reasoning model via Nerve router  
- **`nerve-chat`**: Best chat model via Nerve router

### 2M Context Window Models (for large tasks)
- **`nerve-2m`**: 2M context window via OpenRouter auto-beta
- **`nerve-grok`**: Grok 4.20 with 2M context
- **`nerve-pareto`**: Pareto Code with 2M context

## 📖 Usage

### Interactive Mode (Normal Usage)
```bash
# Grok interactive TUI
grok

# OpenCode interactive TUI  
opencode

# Claude Code interactive TUI
claude
```

### Fallback Mode (Automatic Model Switching)
```bash
# Grok with automatic fallback
grok-fallback "Write a Python function to parse JSON" coding
grok-fallback "Analyze this problem" reasoning
grok-fallback "What's the weather?" chat

# OpenCode with automatic fallback
opencode-fallback "Debug this code" coding
opencode-fallback "Explain this architecture" reasoning

# Claude Code with automatic fallback
claude-fallback "Write a Python function to parse JSON" coding
claude-fallback "Analyze this problem" reasoning
claude-fallback "What's the weather?" chat
```

## 🔧 How the Fallback System Works

1. **Primary model** is tried first (e.g., `nerve-best` for coding)
2. **If it fails** (token limits, errors, timeout), automatically switches to next model
3. **Continues trying** models in priority order until one succeeds
4. **Reports which model** worked for transparency
5. **Zero manual intervention** required

### Fallback Order for Coding Tasks
1. `nerve-best` (1M context) 
2. `nerve-2m` (2M context)
3. `nerve-grok` (2M context)
4. `nerve-pareto` (2M context)

## 🛠️ Manual Configuration

If you prefer to configure manually instead of using the setup script:

### Grok Configuration
Copy `grok-config.toml` to `~/.grok/config.toml`

### OpenCode Configuration  
Merge `opencode-config.json` into `~/.config/opencode/opencode.json`

### Claude Code Configuration
Update `~/.claude/settings.json` to include:
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:20128/v1",
    "ANTHROPIC_MODEL": "auto/best-coding",
    "ANTHROPIC_AUTH_TOKEN": ""
  },
  "model": "auto/best-coding"
}
```

### Fallback Scripts
Copy `grok-fallback`, `opencode-fallback`, and `claude-fallback` to `~/.local/bin/` and make executable:
```bash
chmod +x ~/.local/bin/grok-fallback
chmod +x ~/.local/bin/opencode-fallback
chmod +x ~/.local/bin/claude-fallback
```

## 🐛 Troubleshooting

### Nerve Not Running
```bash
# Start Nerve
nerve serve --daemon

# Check status
nerve status
```

### Models Not Showing in Grok
```bash
# Restart Grok or reload config
grok models
```

### Models Not Showing in OpenCode
```bash
# Restart OpenCode or reload config
opencode models
```

### Claude Code Not Connecting to Nerve
```bash
# Check Claude Code settings
cat ~/.claude/settings.json

# Ensure ANTHROPIC_BASE_URL points to http://localhost:20128/v1
# Ensure model is set to auto/best-coding or similar Nerve model
```

### Claude Code OAuth Issues
```bash
# Re-authenticate Claude Code
claude auth

# Or use API key mode
claude --settings '{"env": {"ANTHROPIC_API_KEY": "your-key"}}'
```

### Port Already in Use
```bash
# Stop Nerve
nerve stop

# Start again
nerve serve --daemon
```

## 📊 Context Window Details

Nerve provides models with various context windows:

- **1M tokens** (1,048,576): Standard models for most tasks
- **1.05M tokens** (1,050,000): Some specialized models  
- **1.31M tokens** (1,310,720): DeepSeek models
- **2M tokens** (2,000,000): Premium models for large context

The fallback system automatically uses the appropriate model based on your task size.

## 🎯 Why This Integration?

### Before This Setup
- ❌ Manual model switching when hitting token limits
- ❌ Errors breaking your workflow
- ❌ Complex configuration required
- ❌ No context window optimization

### After This Setup
- ✅ Automatic model fallback when limits hit
- ✅ Seamless workflow without interruptions
- ✅ One-command setup
- ✅ Optimized context windows (1M and 2M)
- ✅ Works across multiple AI assistants

## 🔗 Related Resources

- **Nerve Documentation**: https://github.com/vikas8520-coder/nerve
- **Grok CLI**: https://github.com/xai-org/grok
- **OpenCode**: https://opencode.ai
- **Claude Code**: https://claude.ai/code
- **Nerve Dashboard**: http://localhost:20128 (when running)

## 📝 Notes

- The setup script backs up existing configurations before modifying them
- Fallback scripts work with or without arguments (interactive mode vs fallback mode)
- All configurations use the local Nerve instance at `http://localhost:20128/v1`
- The integration is designed to be "set and forget" - once configured, it just works

## 🤝 Contributing

If you improve this setup or add support for other AI assistants, please contribute back to the Nerve repository!

---

**Made with ❤️ for seamless AI-powered development**