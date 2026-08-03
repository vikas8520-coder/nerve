---
title: "Integracje CLI — skieruj dowolne CLI do kodowania na Nerve"
version: 3.8.40
lastUpdated: 2026-06-28
---

# Integracje CLI

Nerve dostarcza rodzinę poleceń `setup-*`, które konfigurują CLI do
kodowania (Codex, Claude Code, OpenCode, Cline, …) tak, by używało Nerve jako backendu —
narzędzie rozmawia z **jednym** endpointem, a Nerve kieruje ruch do właściwego providera z
auto-fallbackiem. Każde polecenie odczytuje **aktualny** katalog modeli z działającego
Nerve (lokalnego lub zdalnego) i zapisuje plik konfiguracyjny narzędzia na **Twojej**
maszynie. Klucz API jest odwoływany przez zmienną środowiskową wszędzie tam, gdzie narzędzie
to obsługuje. Polecenia zapisujące lokalny plik środowiska narzędzia są opisane poniżej.

Są też dwa launchery — `nerve launch` (Claude Code) oraz
`nerve launch-codex` (Codex) — które uruchamiają CLI z wstrzykniętym właściwym env,
bez zapisywania jakiejkolwiek konfiguracji.

Jednorazową, ręczną konfigurację bazową dwóch najbogatszych integracji znajdziesz w
szczegółowych przewodnikach per narzędzie:

- [Konfiguracja Claude Code](./CLAUDE-CODE-CONFIGURATION.md)
- [Konfiguracja Codex CLI](./CODEX-CLI-CONFIGURATION.md)
- [Tryb zdalny](./REMOTE-MODE.md) — steruj zdalnym Nerve (VPS / Tailnet) z laptopa

---

## Tabela główna

Każde polecenie respektuje **aktywny kontekst** (ustawiany przez `nerve connect`, zob.
[Tryb zdalny](./REMOTE-MODE.md)) albo jawne flagi `--remote <url> --api-key <key>`.
„Lokalnie vs zdalnie” poniżej oznacza: bez flag celuje w `http://localhost:20128`;
z `--remote` (lub aktywnym kontekstem zdalnym) pobiera katalog z tego
serwera i zapisuje konfigurację lokalnie.

| Polecenie                  | Narzędzie                    | Co zapisuje                                                                                                                              | Kluczowe flagi                                                                                    | Lokalnie vs zdalnie |
| -------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------- |
| `nerve setup-codex`    | OpenAI Codex CLI             | `~/.codex/<name>.config.toml` — jeden profil na kompatybilny model tekstowy (`codex --profile <name>`)                                   | `--remote` `--api-key` `--only` `--dry-run` `--port` `--codex-home`                               | Oba                 |
| `nerve setup-claude`   | Claude Code                  | `~/.claude/profiles/<name>/settings.json` — jeden profil na dopasowany model (`CLAUDE_CONFIG_DIR`)                                       | `--remote` `--api-key` `--only` `--dry-run` `--port` `--claude-home`                              | Oba                 |
| `nerve setup-opencode` | OpenCode (openai-compatible) | `~/.config/opencode/opencode.json` — provider `nerve` z każdym modelem z katalogu (`opencode -m nerve/<model>`)                  | `--remote` `--api-key` `--only` `--model` `--dry-run` `--port`                                    | Oba                 |
| `nerve setup-cline`    | Cline                        | `~/.cline/data/{globalState,secrets}.json` (tryb CLI) + wypisuje ustawienia rozszerzenia VS Code                                         | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--cline-dir`                       | Oba                 |
| `nerve setup-kilo`     | Kilo Code                    | `~/.local/share/kilo/auth.json` (CLI) + scala `kilocode.*` do VS Code `settings.json`, jeśli istnieje                                    | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--auth-path` `--vscode-settings`   | Oba                 |
| `nerve setup-continue` | Continue / `cn` CLI          | `~/.continue/config.yaml` — modele `provider: openai`, klucz przez `${{ secrets.NERVE_API_KEY }}`                                    | `--remote` `--api-key` `--only` `--dry-run` `--port` `--config-path`                              | Oba                 |
| `nerve setup-cursor`   | Cursor                       | Nic — wypisuje kroki w aplikacji (konfiguracja Cursor to nieprzezroczysty SQLite)                                                        | `--remote` `--api-key` `--only` `--port`                                                          | Oba                 |
| `nerve setup-roo`      | Roo Code                     | `~/.nerve/roo-settings.json` (dokument importu) + ustawia `roo-cline.autoImportSettingsPath`, jeśli istnieje VS Code `settings.json` | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--import-path` `--vscode-settings` | Oba                 |
| `nerve setup-crush`    | Crush                        | `~/.config/crush/crush.json` — provider `openai-compat`, klucz przez `$NERVE_API_KEY`                                                | `--remote` `--api-key` `--only` `--dry-run` `--port` `--config-path`                              | Oba                 |
| `nerve setup-goose`    | Goose                        | `~/.config/goose/config.yaml` (`GOOSE_PROVIDER`/`OPENAI_HOST`/`GOOSE_MODEL`) + wypisuje przepis env                                      | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path`                     | Oba                 |
| `nerve setup-aider`    | Aider                        | `~/.aider.conf.yml` (`openai-api-base` + `model: openai/<id>`) + wypisuje przepis env                                                    | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path`                     | Oba                 |
| `nerve setup-qwen`     | Qwen Code                    | `~/.qwen/settings.json` — tablica V4 `modelProviders.openai` + `NERVE_API_KEY` w `~/.qwen/.env`                                      | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path` `--env-path`        | Oba                 |
| `nerve launch`         | Claude Code                  | Nic — uruchamia `claude` z wstrzykniętymi `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN`                                                    | `--remote` `--api-key` `--token` `--profile` `--port`                                             | Oba                 |
| `nerve launch-codex`   | OpenAI Codex CLI             | Nic — uruchamia `codex` z providerem `nerve` wstrzykniętym przez flagi `-c`                                                          | `--remote` `--api-key` `--profile` (`-p`) `--port`                                                | Oba                 |

Uwagi o flagach (zweryfikowane w źródle poleceń):

- `--remote <url>` — pobierz katalog ze zdalnego Nerve (nadpisuje `--port`
  i aktywny kontekst). `--api-key <key>` podaje poświadczenie dla tego
  serwera (domyślnie zmienna env `NERVE_API_KEY` albo token aktywnego kontekstu).
- `--only <patterns>` — podłańcuchy rozdzielone przecinkami; zachowaj tylko ID modeli, które pasują
  (np. `--only glm,kimi`). Dostępne w `setup-codex`, `setup-claude`,
  `setup-opencode`, `setup-continue`, `setup-cursor`, `setup-crush`.
- `--dry-run` — wypisz dokładnie to, co zostałoby zapisane, bez ruszania
  systemu plików. Dostępne w każdym poleceniu `setup-*` **oprócz** `setup-cursor`
  (które nigdy nie zapisuje pliku).
- `--model <id>` — wymagane (lub wybierane interaktywnie) dla narzędzi bez
  auto-odkrywania modeli: Cline, Kilo, Roo, Goose, Qwen, Aider. Te narzędzia
  przyjmują też `--yes` do uruchomień nieinteraktywnych (wtedy wymaga `--model`).
  `setup-opencode` przyjmuje `--model`, by ustawić domyślny model najwyższego poziomu.
- `--port <port>` — lokalny port Nerve (domyślnie `20128`, ignorowany gdy ustawione `--remote`).
  Obecne we wszystkich `setup-*` i obu launcherach.
- Oba launchery (`launch`, `launch-codex`) przyjmują `--profile <name>`, by wybrać
  profil zapisany przez `setup-claude` / `setup-codex`, plus argumenty przekazywane do
  leżącego poniżej binarium `claude` / `codex`.

> `setup-opencode` to **lekka, openai-compatible** integracja OpenCode.
> Jest też bogatsza integracja wtyczkowa — `nerve setup opencode` — która
> instaluje `@nerve/opencode-plugin`. To różne polecenia; tabela
> powyżej dokumentuje `setup-opencode`.

---

## Użycie lokalne

Przy Nerve działającym na `localhost:20128` wystarczy uruchomić polecenie setup dla swojego
narzędzia. Katalog jest pobierany z lokalnego serwera.

```bash
# Codex: write a profile per matched model into ~/.codex/
nerve setup-codex
codex --profile glm52            # use a generated profile

# Claude Code: write per-model profiles, then launch one
nerve setup-claude
nerve launch --profile glm52

# OpenCode: write the openai-compatible provider with all catalog models
nerve setup-opencode
export NERVE_API_KEY=sk-...  # referenced via {env:NERVE_API_KEY}, never on disk
opencode -m nerve/glm/glm-5.2 "..."

# Tools without auto-discovery need an explicit model:
nerve setup-aider --model glm/glm-5.2
nerve setup-qwen --model qwen/qwen3.8-max-preview

# Preview without writing anything:
nerve setup-continue --dry-run
```

Uruchomienie bez zapisywania jakiejkolwiek konfiguracji (tylko wstrzykiwanie env):

```bash
nerve launch                 # Claude Code → local Nerve
nerve launch-codex           # Codex CLI → local Nerve
nerve launch-codex --profile glm52
```

---

## Użycie zdalne

Skieruj dowolne polecenie setup na zdalne Nerve przez `--remote` + `--api-key`.
Katalog jest pobierany ze zdalnego serwera; konfiguracja jest zapisywana na Twojej lokalnej maszynie.

```bash
# OpenCode against a remote VPS, keep only glm/kimi models
nerve setup-opencode --remote http://192.168.0.15:20128 --api-key oma_live_xxx \
  --only glm,kimi
opencode -m nerve/glm/glm-5.2 "..."   # export NERVE_API_KEY first

# Codex profiles from a remote catalog
nerve setup-codex --remote http://192.168.0.15:20128 --api-key oma_live_xxx

# Launch a CLI straight against the remote
nerve launch       --remote http://192.168.0.15:20128 --api-key oma_live_xxx
nerve launch-codex --remote http://192.168.0.15:20128 --api-key oma_live_xxx
```

Zamiast podawać `--remote`/`--api-key` za każdym razem, zaloguj się raz i pozwól, by
**aktywny kontekst** dostarczał je automatycznie:

```bash
nerve connect 192.168.0.15        # mints a scoped token, stores the context
nerve setup-codex                 # ← now uses the remote catalog
nerve setup-opencode              # ← same
nerve launch                      # ← Claude Code against the remote
```

Zobacz [Tryb zdalny](./REMOTE-MODE.md) o kontekstach, zakresach i zarządzaniu tokenami.

---

## Konwencje Base URL (które narzędzia chcą `/v1`)

Nerve udostępnia powierzchnię OpenAI pod `/v1`, powierzchnię Anthropic w root,
oraz natywną powierzchnię Gemini pod `/v1beta`. Każda integracja jest podpięta w formie, jakiej
oczekuje jej narzędzie (zweryfikowane w źródle poleceń):

| Integracja                                                                 | Zapisywany Base URL | `/v1`?                                      |
| -------------------------------------------------------------------------- | ------------------- | ------------------------------------------- |
| `setup-cline` (`openAiBaseUrl`)                                            | root                | Nie — Cline dopina `/v1/chat/completions`   |
| `setup-goose` (`OPENAI_HOST`)                                              | root                | Nie — Goose dopina ścieżkę                  |
| `setup-aider` (`OPENAI_API_BASE`)                                          | root                | Nie — LiteLLM dopina `/v1/chat/completions` |
| `setup-kilo`, `setup-roo`, `setup-continue`, `setup-crush`, `setup-cursor` | z `/v1`             | Tak                                         |
| `setup-claude` (`ANTHROPIC_BASE_URL`), `launch`                            | root                | Nie — Claude Code dopina `/v1/messages`     |
| `setup-codex`, `launch-codex` (`model_providers.nerve.base_url`)       | z `/v1`             | Tak                                         |
| `setup-qwen` (`modelProviders.openai[].baseUrl`)                           | z `/v1`             | Tak                                         |

---

## Zachowanie natywnych zależności przy aktualizacji: `--include=optional`

Gdy aktualizujesz przez `nerve update` (po potwierdzeniu albo z `--apply`),
Nerve uruchamia instalację z wbudowanym `--include=optional`:

```bash
npm install -g nerve@latest --include=optional
```

To **nie** jest flaga, którą przekazujesz do `nerve update` — updater zawsze ją stosuje.
Gwarantuje, że `optionalDependencies` (`better-sqlite3`, `keytar`,
`tls-client`, stos SLM LLMLingua) przetrwają aktualizację nawet gdy w konfiguracji npm
masz `omit=optional`, co w przeciwnym razie po cichu usunęłoby natywny sterownik SQLite
i powiązanie z keyringiem OS. Podgląd dokładnego polecenia bez zastosowania:

```bash
nerve update --dry-run
# [DRY RUN] Would run: npm install -g nerve@latest --include=optional
```

Inne flagi `nerve update` (zweryfikowane w źródle): `--check` (exit 1, jeśli
nieaktualne), `--apply` (instalacja bez monitu), `--changelog`, `--no-backup`,
`--yes`.

---

## Zobacz też

- [Konfiguracja Claude Code](./CLAUDE-CODE-CONFIGURATION.md) — głębszy przewodnik Claude Code
- [Konfiguracja Codex CLI](./CODEX-CLI-CONFIGURATION.md) — jednorazowa konfiguracja bazowa `[model_providers.nerve]`
- [Tryb zdalny](./REMOTE-MODE.md) — konteksty, tokeny dostępu ze scope, sterowanie zdalnym serwerem
- [Referencja narzędzi CLI](../reference/CLI-TOOLS.md) — pełny katalog obsługiwanych narzędzi + strony dashboardu
- [Przewodnik instalacji](./SETUP_GUIDE.md) — metody instalacji i onboarding przy pierwszym uruchomieniu
