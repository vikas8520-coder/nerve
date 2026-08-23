# Hermes Agent CLI Guide with Nerve Integration

Complete guide for using Hermes Agent CLI with Nerve AI router, including commands, scripts, and workflows.

## 🚀 Quick Start

```bash
# Start Nerve (if not running)
nerve serve --daemon

# Run Hermes Agent with Nerve integration
hermes-fallback "Your prompt here" coding
```

## 📋 Basic Hermes Agent Commands

### Interactive Mode
```bash
# Start Hermes Agent in interactive mode
hermes

# Start Hermes Agent in a specific directory
hermes /path/to/project

# Continue the last session
hermes -c

# Resume a specific session
hermes -r <session_id>
```

### One-Shot Mode (Non-Interactive)
```bash
# Single prompt and exit
hermes -z "Your prompt"

# Single prompt with specific model
hermes -z "Your prompt" --model auto/best-coding

# Single prompt with specific provider
hermes -z "Your prompt" --provider nerve
```

### Model Selection
```bash
# Use specific model
hermes -z "Your prompt" --model opus

# Use Nerve model directly
hermes -z "Your prompt" --model auto/best-coding

# Use Nerve 2M context model
hermes -z "Your prompt" --model openrouter/x-ai/grok-4.20
```

### Provider Selection
```bash
# Use specific provider
hermes -z "Your prompt" --provider nerve

# Use OpenRouter provider
hermes -z "Your prompt" --provider openrouter
```

### Reasoning Effort
```bash
# Low effort (faster, less thorough)
hermes -z "Your prompt" --reasoning low

# Medium effort (default)
hermes -z "Your prompt" --reasoning medium

# High effort (slower, more thorough)
hermes -z "Your prompt" --reasoning high

# Extra high effort
hermes -z "Your prompt" --reasoning xhigh

# Maximum effort
hermes -z "Your prompt" --reasoning max

# Ultra effort (highest)
hermes -z "Your prompt" --reasoning ultra
```

## 🤖 Nerve-Specific Commands

### Using Nerve Models Directly
```bash
# Best coding model (1M context)
hermes -z "Write Python code" --model auto/best-coding

# Best reasoning model (1M context)
hermes -z "Analyze this problem" --model auto/best-reasoning

# Best chat model (1M context)
hermes -z "What's the weather?" --model auto/best-chat

# 2M context models for large tasks
hermes -z "Large code analysis" --model openrouter/x-ai/grok-4.20
hermes -z "Large code analysis" --model openrouter/pareto-code
hermes -z "Large code analysis" --model openrouter/auto-beta
```

### Available Nerve Models
| Model | Context | Best For |
|-------|---------|----------|
| `auto/best-coding` | 1M | Coding tasks |
| `auto/best-reasoning` | 1M | Complex reasoning |
| `auto/best-chat` | 1M | General chat |
| `auto/best-fast` | 1M | Fast responses |
| `openrouter/x-ai/grok-4.20` | 2M | Large coding tasks |
| `openrouter/pareto-code` | 2M | Large code optimization |
| `openrouter/auto-beta` | 2M | General large tasks |
| `gemini/gemini-2.5-flash` | 1M | Fast multimodal |
| `gemini/gemini-2.5-pro` | 1M | Advanced multimodal |

## 🔄 Fallback Script Commands

### Basic Usage
```bash
# Automatic fallback for coding tasks
hermes-fallback "Write a function to parse JSON" coding

# Automatic fallback for reasoning tasks
hermes-fallback "Analyze this architecture" reasoning

# Automatic fallback for chat tasks
hermes-fallback "Explain this concept" chat
```

### How Fallback Works
The `hermes-fallback` script automatically tries models in this order:

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
# Opens normal Hermes if no prompt provided
hermes-fallback
```

## 🛠️ Configuration Commands

### Check Current Configuration
```bash
# View current settings
hermes config

# View current model
hermes model

# View fallback providers
hermes fallback
```

### Change Default Model
```bash
# Interactive model selection
hermes model

# Set specific model
hermes config set model.default auto/best-coding

# Set specific provider
hermes config set model.provider nerve
```

### Configure Native Fallback
```bash
# View current fallback chain
hermes fallback

# Add fallback provider
hermes fallback add

# Remove fallback provider
hermes fallback remove

# Clear all fallback providers
hermes fallback clear
```

### Test Nerve Connection
```bash
# Test if Nerve is running
curl http://localhost:20128/v1/models

# Test Hermes with Nerve
hermes -z "Test" --model auto/best-coding

# Check Hermes configuration
hermes config
```

## 📊 Common Workflows

### Workflow 1: Quick Coding Task
```bash
# Use fallback for automatic model selection
hermes-fallback "Write a Python function to sort a list" coding
```

### Workflow 2: Large Code Analysis
```bash
# Use 2M context model directly for large files
hermes -z "Analyze this entire codebase" --model openrouter/x-ai/grok-4.20 --reasoning high
```

### Workflow 3: Debugging with Fallback
```bash
# Let fallback handle model selection automatically
hermes-fallback "Debug this error: TypeError in line 45" coding
```

### Workflow 4: Interactive Session with Nerve
```bash
# Start interactive session (uses default Nerve model)
hermes

# During session, you can switch models
# Hermes supports model switching in interactive mode
```

### Workflow 5: High-Effort Complex Task
```bash
# Use high reasoning effort with fallback
hermes-fallback "Complex refactoring with edge cases" coding --reasoning high
```

### Workflow 6: Batch Processing
```bash
# Process multiple files with fallback
for file in *.py; do
    hermes-fallback "Review and fix bugs in $file" coding
done
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

### Hermes Agent Issues
```bash
# Check Hermes version
hermes --version

# Run Hermes doctor
hermes doctor

# Check configuration
hermes config

# Edit configuration
hermes config edit

# View logs
hermes logs
```

### Model Issues
```bash
# Test specific model
hermes -z "Test" --model auto/best-coding

# Test with verbose output
hermes -z "Test" --model auto/best-coding --debug

# Check available models (via Nerve)
curl http://localhost:20128/v1/models | python3 -m json.tool

# List available providers
hermes model
```

### Port Issues
```bash
# Check if Nerve is on correct port
curl http://localhost:20128/v1/models

# Fix wrong port in Hermes config
hermes config edit
# Change providers.nerve.api to http://localhost:20128/v1
```

## 🎯 Performance Tips

### For Speed (Quick Tasks)
```bash
# Use low effort with fast model
hermes-fallback "Quick question" chat --reasoning low
```

### For Quality (Complex Tasks)
```bash
# Use high effort with fallback
hermes-fallback "Complex analysis" reasoning --reasoning high
```

### For Large Context (Big Files)
```bash
# Use 2M context model directly
hermes -z "Analyze large codebase" --model openrouter/x-ai/grok-4.20
```

### For Reliability (Important Tasks)
```bash
# Use fallback to ensure completion
hermes-fallback "Critical bug fix" coding --reasoning high
```

### For Maximum Quality
```bash
# Use ultra reasoning effort
hermes -z "Most complex task" --reasoning ultra --model openrouter/x-ai/grok-4.20
```

## 🎯 Best Practices

### 1. Use Fallback for Unknown Task Size
```bash
# Let the script choose the right model
hermes-fallback "Your task here" coding
```

### 2. Use Direct Model for Known Large Tasks
```bash
# If you know it's a large task, specify 2M model
hermes -z "Analyze entire project" --model openrouter/x-ai/grok-4.20
```

### 3. Combine with Reasoning Effort
```bash
# High effort with fallback for best results
hermes-fallback "Complex refactoring" coding --reasoning high
```

### 4. Use Interactive Mode for Conversations
```bash
# For back-and-forth discussions
hermes
```

### 5. Use One-Shot Mode for Scripts/Automation
```bash
# For automated tasks
hermes -z "Generate documentation" --model auto/best-coding
```

### 6. Leverage Native Fallback
```bash
# Configure Hermes native fallback for automatic provider switching
hermes fallback add
# Select alternative providers like ollama or openrouter
```

### 7. Use Skills for Specialized Tasks
```bash
# Load specific skills for the session
hermes -z "Task" --skills github-auth,code-review
```

## 📚 Quick Reference

### Common Commands
```bash
hermes                          # Interactive mode
hermes -z "prompt"             # One-shot mode
hermes-fallback "prompt" task  # With automatic fallback
hermes --model <model>         # Specific model
hermes --provider <provider>   # Specific provider
hermes --reasoning <level>     # Reasoning level
hermes config                  # View configuration
hermes fallback                # View fallback chain
```

### Nerve Models
```bash
auto/best-coding               # 1M context, coding
auto/best-reasoning            # 1M context, reasoning  
auto/best-chat                 # 1M context, chat
auto/best-fast                 # 1M context, fast
openrouter/x-ai/grok-4.20      # 2M context, Grok 4.20
openrouter/pareto-code         # 2M context, Pareto
openrouter/auto-beta           # 2M context, Auto
gemini/gemini-2.5-flash        # 1M context, fast multimodal
gemini/gemini-2.5-pro          # 1M context, advanced multimodal
```

### Task Types for Fallback
```bash
coding                         # Programming tasks
reasoning                      # Complex analysis
chat                           # General conversation
```

### Reasoning Levels
```bash
none                           # No reasoning
minimal                        # Minimal reasoning
low                            # Low reasoning
medium                         # Medium reasoning (default)
high                           # High reasoning
xhigh                          # Extra high reasoning
max                            # Maximum reasoning
ultra                          # Ultra reasoning (highest)
```

## 🔗 Related Resources

- [Nerve Documentation](https://github.com/vikas8520-coder/nerve)
- [Hermes Agent Documentation](https://github.com/nousresearch/hermes)
- [Nerve Dashboard](http://localhost:20128)
- [Integration Setup README](./README.md)

## 🌟 Why Hermes Agent is Recommended

**Hermes Agent Advantages:**
- **Full Model Discovery**: Automatically discovers all available Nerve models
- **Native Fallback Support**: Built-in provider fallback system
- **Rich Feature Set**: Skills, plugins, MCP servers, personalities
- **Multi-Platform**: Works with Telegram, Discord, Slack, WhatsApp
- **Advanced Configuration**: Fine-grained control over behavior
- **Active Development**: Regular updates and improvements

**Best For:**
- Power users who want maximum control
- Complex workflows requiring specialized skills
- Multi-platform AI agent deployment
- Advanced reasoning and tool usage

---

**Tip**: Start with `hermes-fallback` for most tasks - it automatically handles model selection so you don't have to think about it. For complex tasks requiring maximum quality, use `--reasoning ultra` with a 2M context model!