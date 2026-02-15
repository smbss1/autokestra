## Context

Le moteur exécute déjà des plugins `core/*` via le runtime processus Bun, avec un contrat simple `action + input -> JSON output`. Les équipes veulent réutiliser des scripts JS/TS existants et des projets Node complets dans des workflows YAML, y compris depuis des dépôts Git privés. Cette capacité doit rester CLI-first, observable, et déterministe (timeouts, logs, résultats structurés), tout en laissant le contrôle d’exécution à l’utilisateur opérateur.

## Goals / Non-Goals

**Goals:**
- Introduire un plugin officiel `core/script` avec action `run`.
- Supporter deux modes source dans `core/script`: `local` et `inline`.
- Introduire un plugin officiel `core/git-source` pour la résolution Git public/privé.
- Supporter runtime utilisateur `bun`, `tsx`, et `auto`.
- Supporter mode projet `package.json` avec exécution conditionnelle `prestart -> start -> poststart`.
- Fournir un output structuré exploitable dans les tâches suivantes (phases, exit code, durée, stdout/stderr, erreurs catégorisées).

**Non-Goals:**
- Ajouter une UI de gestion des exécutions script.
- Introduire une politique de sandbox stricte ou liste blanche de commandes en v1.
- Gérer des orchestrations multi-repo avancées (mono-repo matrix, fan-out interne).

## Decisions

1. **Nouveau plugin `plugins/script` dans namespace `core`**
   - Rationale: cohérent avec `core/http` et `core/quittance`, déploiement simple sans modifier le DSL.
   - Alternative considérée: étendre un plugin existant (`http`, `console`) ; rejetée car mélange de responsabilités.

2. **Contrat d’entrée orienté source + mode**
   - `core/script.run` accepte `source` (`local|inline`), `projectMode`, `runtime`, `install`, `lifecycle`, `entry`, `args`, `env`, `timeoutMs`.
   - Rationale: garder `core/script` focalisé sur l’exécution de scripts/projets et séparer la récupération de code.
   - Alternative: conserver `git` dans `core/script` ; rejetée pour réduire le couplage.

3. **Plugin dédié `core/git-source` pour Git public/privé**
   - `core/git-source.checkout` gère clone/checkout/subdir + auth (`token`/`ssh`) et retourne un `workspacePath` local.
   - `core/script.run` n’implémente plus de logique Git.
   - Rationale: séparation des responsabilités et meilleure maintenabilité/sécurité.
   - Alternative: deux actions Git dans `core/script` ; rejetée pour éviter duplication des responsabilités.

4. **Sélection runtime `auto|bun|tsx`**
   - `auto`: préfère `bun` si disponible, sinon `tsx`.
   - `bun` et `tsx` explicitement supportés pour compatibilité hétérogène.
   - Alternative: Bun-only ; rejetée pour compatibilité Node/TypeScript plus large.

5. **Mode projet lifecycle explicite**
   - Si `projectMode=true` et `package.json` présent, exécuter `prestart`, `start`, `poststart` uniquement si script existe et drapeau correspondant actif.
   - Rationale: comportement attendu côté Node/npm lifecycle, sans échec inutile pour scripts absents.
   - Alternative: exiger `start` strictement ; rejetée pour réduire friction.

6. **Sécurité V1: contrôle utilisateur + garde-fous opérationnels**
   - Pas de liste blanche de commandes en v1.
   - Garde-fous: timeout obligatoire, logs phase par phase, redaction des secrets en logs, répertoire de travail isolé, sortie structurée.
   - Rationale: l’utilisateur opérateur doit garder la main, tout en conservant traçabilité et limites d’exécution.

7. **Plafond de sortie `stdout/stderr` dans l’output final**
   - L’output final retourne `stdout` et `stderr` plafonnés à une taille fixe par flux (v1: 1 MiB chacun), avec indicateur de troncature.
   - Rationale: éviter des payloads workflow trop volumineux tout en conservant un résultat exploitable.
   - Alternative: output non plafonné ; rejetée pour risques mémoire/performance.

8. **Pas de `startCommand` custom en v1**
   - Le mode projet reste strictement basé sur les scripts `prestart`, `start`, `poststart` de `package.json`.
   - Rationale: API plus simple et prévisible en v1.
   - Alternative: `startCommand` custom ; reportée en v2 si besoin confirmé.

9. **`install.enabled=false` est prioritaire**
   - Si `install.enabled=false`, la phase d’installation est toujours ignorée, même si un lockfile est présent.
   - Rationale: contrôle explicite et déterministe côté utilisateur.
   - Alternative: auto-install implicite selon lockfile ; rejetée pour éviter les effets de bord.

## Risks / Trade-offs

- **[Risque] Exécution de commandes arbitraires** → **Mitigation**: capacité explicitement assumée, documentation claire, timeout, journaux d’audit, exécution dans workspace temporaire.
- **[Risque] Fuite de secrets via stdout/stderr** → **Mitigation**: ne pas journaliser les valeurs d’inputs sensibles, limiter et tronquer logs, recommander secrets manager pour tokens/keys.
- **[Risque] Divergence runtime (`bun` vs `tsx`)** → **Mitigation**: output inclut runtime effectivement utilisé et commande résolue; mode `auto` déterministe.
- **[Risque] Auth SSH Git fragile (known_hosts)** → **Mitigation**: validation explicite des entrées SSH et messages d’erreur catégorisés (`GIT_AUTH_ERROR`).
- **[Risque] Interface inter-plugin (git-source -> script) mal alignée** → **Mitigation**: contrat stable sur `workspacePath` en sortie de `core/git-source`.
- **[Risque] Durées d’installation dépendances élevées** → **Mitigation**: phase `install` optionnelle et timeout configurable.

## Migration Plan

1. Ajouter le plugin `core/script` (manifest + index runtime) sans modifier les plugins existants.
2. Ajouter le plugin `core/git-source` (manifest + index runtime) pour cloner/checkout des repos.
3. Ajouter exemples YAML chaînés (`core/git-source.checkout` puis `core/script.run`) pour Git privé token/ssh, plus exemples `local` et `inline`.
3. Documenter schéma input/output et comportements lifecycle.
4. Déployer sans migration de données (aucun changement de persistence attendu).
5. Rollback: supprimer/retirer le plugin `core/script` des chemins plugins si incident.

## Open Questions

- Aucune pour v1.
