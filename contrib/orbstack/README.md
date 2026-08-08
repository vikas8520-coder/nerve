# OrbStack battery auto-pause for Nerve

Stops OrbStack (and the Nerve production containers) automatically when your Mac
switches to **battery**, and resumes it when you plug into **AC power**.

## Why

OrbStack's built-in `power.pause_in_sleep` only pauses the VM when the _Mac
sleeps_. That does **not** cover the case of running on battery while _awake_ —
which is exactly when OrbStack's VM was measured as the single biggest live
battery consumer on Vikas's machine. This automation closes that gap.

What we measured on an M5 Mac (idle laptop, 5-min samples):

| State                           | Idle drain |
| ------------------------------- | ---------- |
| Willow OFF + OrbStack OFF       | lowest     |
| Willow ON + OrbStack OFF        | ~12%/hr    |
| Willow OFF + OrbStack ON (idle) | ~36%/hr    |
| Willow ON + OrbStack ON (idle)  | ~12%/hr    |

Willow Voice contributes ~0% CPU and adds no measurable drain. The drain is the
dev/agent stack (OrbStack, Devin, Hermes gateway) — coincidentally ramped up
around the same time Willow was installed.

## Files

| File                                 | Purpose                                            |
| ------------------------------------ | -------------------------------------------------- |
| `nerve-orbstack-autopause.sh`        | The polling script (acts only on power transition) |
| `com.nerve.orbstack-autopause.plist` | launchd agent (runs the script every 60s)          |

## Install (one-time, per machine)

```bash
# 1. Put the script on the PATH (needs sudo — /usr/local/bin is root-owned)
sudo cp nerve-orbstack-autopause.sh /usr/local/bin/
sudo chmod 755 /usr/local/bin/nerve-orbstack-autopause.sh

# 2. Install + load the launchd agent
cp com.nerve.orbstack-autopause.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.nerve.orbstack-autopause.plist

# 3. (Optional) verify it's loaded
launchctl list | grep nerve.orbstack
```

The first run is a **no-op**: it records the current power state and only acts
when the source _changes_ (battery → AC or AC → battery).

## Behavior

- Polls every 60s; only acts on a power-source **transition** (no flapping).
- Skips silently if `orbctl` is missing or OrbStack isn't running.
- Respects `~/.nerve-autopause-disabled` — `touch` that file to turn it off
  without unloading the agent.
- Default mode stops the **whole OrbStack VM** on battery.

### Container-only mode

To leave the OrbStack VM running (for other workloads) and only stop/start the
Nerve containers (`nerve-prod`, `nerve-redis-prod`):

Edit the plist's `ProgramArguments` and add:

```xml
<key>EnvironmentVariables</key>
<dict>
    <key>PAUSE_CONTAINERS_ONLY</key>
    <string>1</string>
</dict>
```

then `launchctl unload` / `load` it again. (Nerve containers use
`restart: unless-stopped`, so they auto-return once the VM is up anyway.)

## Uninstall

```bash
launchctl unload ~/Library/LaunchAgents/com.nerve.orbstack-autopause.plist
rm ~/Library/LaunchAgents/com.nerve.orbstack-autopause.plist
sudo rm /usr/local/bin/nerve-orbstack-autopause.sh
```
