# Claude Code CLI Guide with Nerve Integration

Complete guide for using Claude Code CLI with Nerve AI router, including commands, scripts, and workflows.

## 🚀 Quick Start

```bash
# Start Nerve (if not running)
nerve serve --daemon

# Run Claude Code with Nerve integration
claude-fallback "Your prompt here" coding
```

## 📋 Basic Claude Code Commands

### Interactive Mode
```bash
# Open Claude Code in interactive mode
claude

# Open Claude Code in a specific directory
claude /path/to/project

# Continue the last conversation
claude -c

# Resume a specific session
claude -r <session-id>
```

### Print Mode (Non-Interactive)
```bash
# Single prompt and exit
claude -p "Your prompt"

# Print response in JSON format
claude -p "Your prompt" --output-format json

# Print response in streaming JSON
claude -p "Your prompt" --output-format stream-json
```

### Model Selection
```bash
# Use specific model
claude -p "Your prompt" --model opus

# Use Nerve model directly
claude -p "Your prompt" --model auto/best-coding

# Use Nerve 2M context model
claude -p "Your prompt" --model openrouter/x-ai/grok-4.20
```

### Effort Levels
```bash
# Low effort (faster, less thorough)
claude -p "Your prompt" --effort low

# Medium effort (default)
claude -p "Your prompt" --effort medium

# High effort (slower, more thorough)
claude -p "Your prompt" --effort high

# Extra high effort
claude -p "Your prompt" --effort xhigh

# Maximum effort
claude -p "Your prompt" --effort max
```

## 🤖 Nerve-Specific Commands

### Using Nerve Models Directly
```bash
# Best coding model (1M context)
claude -p "Write Python code" --model auto/best-coding

# Best reasoning model (1M context)
claude -p "Analyze this problem" --model auto/best-reasoning

# Best chat model (1M context)
claude -p "What's the weather?" --model auto/best-chat

# 2M context models for large tasks
claude -p "Large code analysis" --model openrouter/x-ai/grok-4.20
claude -p "Large code analysis" --model openrouter/pareto-code
claude -p "Large code analysis" --model openrouter/auto-beta
```

### Available Nerve Models
| Model | Context | Best For |
|-------|---------|----------|
| `auto/best-coding` | 1M | Coding tasks |
| `auto/best-reasoning` | 1M | Complex reasoning |
| `auto/best-chat` | 1M | General chat |
| `openrouter/x-ai/grok-4.20` | 2M | Large coding tasks |
| `openrouter/pareto-code` | 2M | Large code optimization |
| `openrouter/auto-beta` | 2M | General large tasks |

## 🔄 Fallback Script Commands

### Basic Usage
```bash
# Automatic fallback for coding tasks
claude-fallback "Write a function to parse JSON" coding

# Automatic fallback for reasoning tasks
claude-fallback "Analyze this architecture" reasoning

# Automatic fallback for chat tasks
claude-fallback "Explain this concept" chat
```

### How Fallback Works
The `claude-fallback` script automatically tries models in this order:

**For coding:**
1. `auto/best-coding` (1M context)
2. `openrouter/pareto-code` (2M context)
3. `openrouter/x-ai/grok-4.20` (2M context)
4. `openrouter/auto-beta` (2M context)

**For reasoning:**
1. `auto/best-reasoning` (1M context)
2. `openrouter/x-ai/grok-4.20` (2M context)
3. `openrouter/auto-beta` (2M context)

**For chat:**
1. `auto/best-chat` (1M context)
2. `openrouter/auto-beta` (2M context)
3. `openrouter/x-ai/grok-4.20` (2M context)

### Interactive Mode with Fallback
```bash
# Opens normal Claude Code if no prompt provided
claude-fallback
```

## 📝 Common Workflows

### Workflow 1: Quick Coding Task
```bash
# Use fallback for automatic model selection
claude-fallback "Write a Python function to sort a list" coding
```

### Workflow 2: Large Code Analysis
```bash
# Use 2M context model directly for large files
claude -p "Analyze this entire codebase" --model openrouter/x-ai/grok-4.20 --effort high
```

### Workflow 3: Debugging with Fallback
```bash
# Let fallback handle model selection automatically
claude-fallback "Debug this error: TypeError in line 45" coding
```

### Workflow 4: Interactive Session with Nerve
```bash
# Start interactive session (uses default Nerve model)
claude

# During session, you can switch models
/model openrouter/x-ai/grok-4.20
```

### Workflow 5: Batch Processing
```bash
# Process multiple files with fallback
for file in *.py; do
    claude-fallback "Review and fix bugs in $file" coding
done
```

## 🛠️ Configuration Commands

### Check Current Configuration
```bash
# View current settings
cat ~/.claude/settings.json

# View Nerve-specific settings
grep -A 5 "ANTHROPIC" ~/.claude/settings.json
```

### Change Default Nerve Model
```bash
# Edit settings file
nano ~/.claude/settings.json

# Change ANTHROPIC_MODEL to your preferred model:
# "auto/best-coding" (default)
# "openrouter/x-ai/grok-4.20" (2M context)
# "openrouter/pareto-code" (2M context)
```

### Test Nerve Connection
```bash
# Test if Nerve is running
curl http://localhost:20128/v1/models

# Test Claude Code with Nerve
claude -p "Test" --model auto/best-coding
```

## 🔍 Troubleshooting Commands

### Check Nerve Status
```bash
# Check if Nerve is running
nerve status

# Check Nerve logs
nerve logs

# Restart Nerve
nerve restart
```

### Claude Code Issues
```bash
# Check Claude Code version
claude --version

# Run Claude Code doctor
claude doctor

# Check authentication
claude auth

# Use safe mode (disables customizations)
claude --safe-mode
```

### Model Issues
```bash
# Test specific model
claude -p "Test" --model auto/best-coding

# Test with verbose output
claude -p "Test" --model auto/best-coding --debug

# Check available models (via Nerve)
curl http://localhost:20128/v1/models | python3 -m json.tool
```

## 📊 Performance Tips

### For Speed (Quick Tasks)
```bash
# Use low effort with fast model
claude-fallback "Quick question" chat --effort low
```

### For Quality (Complex Tasks)
```bash
# Use high effort with fallback
claude-fallback "Complex analysis" reasoning --effort high
```

### For Large Context (Big Files)
```bash
# Use 2M context model directly
claude -p "Analyze large codebase" --model openrouter/x-ai/grok-4.20
```

### For Reliability (Important Tasks)
```bash
# Use fallback to ensure completion
claude-fallback "Critical bug fix" coding --effort high
```

## 🎯 Best Practices

### 1. Use Fallback for Unknown Task Size
```bash
# Let the script choose the right model
claude-fallback "Your task here" coding
```

### 2. Use Direct Model for Known Large Tasks
```bash
# If you know it's a large task, specify 2M model
claude -p "Analyze entire project" --model openrouter/x-ai/grok-4.20
```

### 3. Combine with Effort Levels
```bash
# High effort with fallback for best results
claude-fallback "Complex refactoring" coding --effort high
```

### 4. Use Interactive Mode for Conversations
```bash
# For back-and-forth discussions
claude
```

### 5. Use Print Mode for Scripts/Automation
```bash
# For automated tasks
claude -p "Generate documentation" --output-format json
```

## 📚 Quick Reference

### Common Commands
```bash
claude                          # Interactive mode
claude -p "prompt"             # Single prompt
claude-fallback "prompt" task  # With automatic fallback
claude --model <model>         # Specific model
claude --effort <level>        # Effort level
```

### Nerve Models
```bash
auto/best-coding               # 1M context, coding
auto/best-reasoning            # 1M context, reasoning  
auto/best-chat                 # 1M context, chat
openrouter/x-ai/grok-4.20      # 2M context, Grok 4.20
openrouter/pareto-code         # 2M context, Pareto
openrouter/auto-beta           # 2M context, Auto
```

### Task Types for Fallback
```bash
coding                         # Programming tasks
reasoning                      # Complex analysis
chat                           # General conversation
```

## 🔗 Related Resources

- [Nerve Documentation](https://github.com/vikas8520-coder/nerve)
- [Claude Code Documentation](https://claude.ai/code)
- [Nerve Dashboard](http://localhost:20128)
- [Integration Setup README](./README.md)

---

**Tip**: Start with `claude-fallback` for most tasks - it automatically handles model selection so you don't have to think about it!