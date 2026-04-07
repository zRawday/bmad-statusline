---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Universal progress tracking for bmad-statusline across all BMAD workflows'
session_goals: 'Discover mechanisms to detect phases/steps in free-file workflows, enrich signal early, make tracking universal without modifying existing skills'
selected_approach: 'ai-recommended'
techniques_used: ['first-principles-thinking', 'morphological-analysis', 'cross-pollination']
ideas_generated: [27]
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Fred
**Date:** 2026-03-29

---

## Récap final — Décisions prises

### Architecture hooks

On passe de 2 à 4 hooks + 1 nouveau :

| Hook | Rôle | Statut |
|------|------|--------|
| **UserPromptSubmit** | Workflow actif (`/bmad-`, `/gds-`, `/wds-`) | Existant, regex à élargir |
| **PostToolUse Read** | Projet (config.yaml), step courant (step files), story candidat (sprint-status) | Existant, regex à élargir |
| **PostToolUse Write** | Story confirmée (sprint-status, story file) | **Nouveau** |
| **PostToolUse Edit** | Story confirmée (sprint-status), story file updates | **Nouveau** |
| **SessionStart** (matcher "resume") | Touch .alive au resume de session | **Nouveau** |

### Détection workflow

- **Signal :** UserPromptSubmit, regex sur `/bmad-{name}`, `/gds-{name}`, `/wds-{name}`
- **Fix :** Élargir le regex de `/(bmad-[\w-]+)/` à `/((?:bmad|gds|wds)-[\w-]+)/`
- **Fix :** `skill.slice(5)` → slicer dynamiquement après le premier `-`
- **Fix :** Chemins hardcodés `'bmad-' + workflow` → utiliser le nom complet du skill

### Détection projet

- **Signal :** Read config.yaml → `tool_response.file.content` → parse `project_name`
- **Fix critique :** Scoper au `cwd` — ignorer tout Read en dehors du projet courant
  ```js
  if (!filePath.startsWith(payload.cwd)) return;
  ```

### Tracking step (progression)

- **Signal :** Read step file dans un dossier `steps*/`
- **Regex path élargi :** `steps(-[a-z])?/step-([a-z]-)?(\d+)-` (couvre steps/, steps-c/, steps-v/, step-v-01-*, etc.)
- **Sub-steps exclus :** `step-01b-*.md` ne matche pas (le `b` après le numéro exclut du regex `\d+-`)
- **Total calculé au premier Read** d'un step file (pas au lancement) → on compte les fichiers dans LE dossier parent de ce step, ce qui gère le multi-track (steps-c vs steps-v)
- **stepsCompleted :** Redondant avec le Read step file → on l'ignore

### Détection story

**Système de priorité avec verrouillage :**

| Priorité | Signal | Comportement |
|----------|--------|--------------|
| **1 (haute)** | Write/Edit sprint-status.yaml | Écrase toujours, même un verrou |
| **2** | Premier Read/Write story file | Verrouille — les suivants sont ignorés |
| **3** | Read sprint-status (candidat unique) | Seulement si rien d'autre n'a été set |

**Logique par workflow :**

| Workflow | Read story file = signal ? | Signal tôt | Signal confirmé |
|----------|----------------------------|------------|-----------------|
| **code-review** (bmad + gds) | **Oui** — premier Read verrouille | Premier Read story file | Write/Edit sprint-status |
| **dev-story** (bmad + gds) | **Oui** — premier Read verrouille | Premier Read story file | Write/Edit sprint-status |
| **create-story** (bmad + gds) | **Non** — lit la story précédente | Premier Write story file (filename) | Write/Edit sprint-status |
| **Tous les autres** | **Non** par défaut | — | — |

**Payloads utilisés :**

| Hook | Champ pour la story |
|------|---------------------|
| Read story file | `tool_input.file_path` → regex `\d+-\d+-[\w-]+\.md` sur le filename |
| Write story file | `tool_input.file_path` → même regex sur le filename |
| Write sprint-status | `tool_input.content` → parse YAML → trouver le story_key qui a changé de status |
| Edit sprint-status | `tool_input.new_string` → regex sur le changement de status |

### Compatibilité modules

| Module | Skills | Story tracking | Step tracking |
|--------|--------|----------------|---------------|
| **BMM** | 67 skills | Oui — sprint-status + story files | Oui — steps*/ |
| **GDS** | 35 skills | Oui — même système que BMM | Oui — steps*/ (sauf gds-code-review) |
| **WDS** | 12 skills | Non — pas de stories | Oui — steps*/ (multi-track) |
| **CIS** | ~10 skills | Non | Non — pas de steps |
| **TEA** | ~15 skills | Non | Oui — steps-c/, steps-v/, steps-e/ |

### Skills sans progression

~32 skills n'ont ni `steps/` ni stepsCompleted (create-story, dev-story, quick-dev, sprint-planning, sprint-status, correct-course, etc.). Pour ceux-là : **workflow + story + timer uniquement**. Pas de step tracking — décision assumée pour rester fiable.

### Format statusline

```
projet │ skill │ story │ x/x step-name │ timer
```

Exemples :
```
Toulou │ dev-story │ 1-3-user-auth │ 5/10 implement │ 12m30s
Toulou │ create-story │ │ │ 2m15s
Toulou │ create-prd │ │ 3/12 success │ 8m45s
Toulou │ dev-story │ 1-3-user-auth │ │ 45m12s
```

### Session resume

- Le `session_id` est **conservé** après un `claude --continue` / `claude --resume`
- Ajouter hook `SessionStart` matcher `"resume"` → touch `.alive-{sessionId}`
- **`ALIVE_MAX_AGE_MS` = 7 jours** (au lieu de 5 minutes) — les status files sont petits

### Bug trouvé

**cwd scoping** — Le hook ne vérifie pas que les fichiers lus sont dans le projet courant. Lire un `config.yaml` d'un autre dossier écrase le project name. Fix : vérifier `filePath.startsWith(payload.cwd)`.

### Points à valider avant implémentation

1. **Sub-agents** — Est-ce que les sub-agents (outil Agent) partagent le même `session_id` que le parent ? Si oui, leurs Reads pollueraient le state. À tester empiriquement.
