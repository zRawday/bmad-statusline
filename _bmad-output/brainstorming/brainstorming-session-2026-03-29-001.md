---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Récupérer les infos de statut BMAD sans friction LLM — extraction passive via hook'
session_goals: 'Éliminer les halts permissions, le temps LLM perdu en I/O, trouver des mécanismes automatiques'
selected_approach: 'ai-recommended'
techniques_used: ['first-principles-thinking']
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Fred
**Date:** 2026-03-29

## Session Overview

**Topic:** Récupérer les informations de statut BMAD sans dépendre du LLM pour écrire les fichiers status.

**Problème:** L'approche Phase 1 demandait au LLM d'écrire un fichier JSON de statut à chaque changement de workflow/step. Cela causait :
- Des halts de permissions à chaque écriture
- Du temps LLM perdu à lire configs et écrire du JSON
- De la friction dans chaque workflow BMAD

**Objectif:** Zéro friction LLM — extraction 100% passive.

## Technique : First Principles Thinking

### Sources de données identifiées

Deux écosystèmes contiennent les données nécessaires :

**Claude Code :**
- Fichiers JSONL de session (chaque tool call loguée)
- Hooks (events PreToolUse/PostToolUse avec données structurées)
- Statusline stdin (session_id fourni)

**BMAD :**
- Fichiers skill/workflow (`skills/bmad-{name}/workflow.md`) — structure prédictible
- Fichiers step (`steps/step-XX-*.md`) — nommage prédictible
- Fichiers story (`stories/*.md`) — slug dans le nom de fichier
- config.yaml — project_name
- Frontmatter structuré dans tous les fichiers

### Insight clé

Le LLM, dans son fonctionnement normal, **lit déjà** tous les fichiers dont on a besoin pour dériver le statut. Un hook `PostToolUse` sur `Read` peut observer ces lectures passivement et en extraire toutes les informations nécessaires.

## Décisions prises

### Approche retenue : Hook passif unique sur PostToolUse Read

Un seul hook ciblé sur les événements `Read` observe passivement les lectures du LLM et en dérive le statut complet.

**Flow :** Hook PostToolUse → écrit status file → Reader existant → ccstatusline

### Champs supprimés (vs Phase 1)

| Champ | Raison |
|---|---|
| **agent** | Pas dans le frontmatter, extraction non fiable depuis la prose |
| **request** | Nécessiterait le LLM pour résumer le prompt |
| **document** | Signal ambigu — plusieurs fichiers édités par session |
| **step.completed** | Redondant — si l'agent Read step N, il a complété N-1 |

### Widgets finaux (8 individuels + composites)

| Widget | Source passive | Fiabilité |
|---|---|---|
| **project** | `config.yaml` lu une fois | Rock solid |
| **workflow** | Path du Read sur `skills/bmad-{name}/` | Rock solid |
| **step current + name** | Path du Read sur `step-XX-*.md`, nom parsé du fichier | Rock solid |
| **step total** | `fs.readdirSync` sur `steps/` du skill actif | Rock solid |
| **next step + name** | Dérivé : current + 1 dans le listing steps/ | Rock solid |
| **progressbar** | (current - 1) / total → `▰▰▱▱▱` | Rock solid |
| **timer** | `started_at` → now, calculé par le reader à chaque appel | Fluide selon refresh rate ccstatusline |
| **story** | Slug parsé du nom de fichier story | Rock solid |

### Signaux du hook — v2 (post-spike)

**Insight clé :** Le Read seul cause des faux positifs (un agent peut lire un workflow.md ou une story comme simple référence). Le **Skill** est le vrai signal d'intention — c'est lui qui indique l'entrée dans un workflow.

| Event | Détection | Action |
|---|---|---|
| **Skill** `bmad-{name}` | `tool_input.skill` matche `bmad-*` | Set `workflow` actif (source de vérité) |
| Read `steps/step-XX-*.md` | Path matche le workflow actif | Set `step.current`, `step.name`, dériver `next`, `completed = current - 1` |
| Read `stories/*.md` | Workflow actif est `create-story`, `dev-story` ou `code-review` | Set `story` (slug du filename) |
| Tout autre Read | — | **Ignoré** |

**Logique de discrimination :**
- Le Skill pose le contexte (workflow actif)
- Les Read ne sont traités que s'ils correspondent au workflow actif
- La story n'est trackée que dans les 3 workflows où elle a du sens

### Spike de validation (2026-03-29)

Hook PostToolUse testé empiriquement sur cette session. Résultats :

**Payload Read confirmé :**
- `tool_input.file_path` — chemin complet ✓
- `tool_response.file.content` — contenu entier du fichier (bonus : parsing possible sans I/O) ✓
- `session_id` — top-level ✓

**Payload Skill confirmé (second spike) :**
- `tool_name` = `"Skill"` ✓
- `tool_input.skill` = nom exact du skill (ex: `"bmad-help"`) ✓
- `tool_response.commandName` = nom du skill ✓
- Matcher `"Skill"` fonctionne — le premier spike n'avait simplement pas déclenché de Skill

**Aucun point bloquant — les deux signaux (Skill + Read) sont validés empiriquement.**

### Garde-fous

- **Check `_bmad/`** au premier event : si le dossier n'existe pas dans le projet, le hook ignore silencieusement (support multi-projets, y compris non-BMAD)
- **Hook ciblé** : matcher sur `Read|Skill`, pas de déclenchement sur Bash/Grep/Edit
- **Silent failure** : retourne vide en cas d'erreur, pas de crash

### Architecture inchangée

- Le **reader** (`bmad-sl-reader.js`) reste quasi identique
- Seul le **writer** change : passe du LLM au hook
- Le **format du status file** reste le même (JSON dans `~/.cache/bmad-status/`)
- L'**install** ajoute le hook dans `settings.json` en plus des widgets ccstatusline

### Limitation connue

- **Timer** : la fluidité dépend du refresh rate de ccstatusline, pas de nous
