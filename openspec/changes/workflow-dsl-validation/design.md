## Context

Autokestra dispose maintenant d’un socle (repo/outillage, config, CLI). La prochaine étape est de définir un DSL de workflow (YAML) et un pipeline de validation robuste pour garantir des exécutions déterministes, éviter les erreurs de modélisation (DAG invalide) et réduire la surface d’attaque (YAML malformé, valeurs dangereuses, fuites de secrets).

Contraintes clés :

- Runtime Bun + TypeScript, monorepo `packages/*`.
- CLI-first : le DSL doit être facilement validable via CLI (à minima en interne pour `workflow apply`).
- Sécurité by-default : pas de secrets dans le YAML, validation stricte, messages d’erreur exploitables.
- Extensibilité : tasks plugin-driven via `type: <namespace>/<plugin>.<action>`.

## Goals / Non-Goals

**Goals:**

- Définir un modèle de données TypeScript pour le Workflow DSL (workflow, trigger, tasks, retry, DAG dependencies).
- Spécifier une stratégie de validation (syntaxique + sémantique) avec diagnostics détaillés et chemins de champs.
- Établir une approche de compatibilité/évolution du DSL (versioning, tolérance aux champs inconnus, extension plugins).
- Préparer l’intégration CLI (validation avant enregistrement/exécution) sans implémenter l’exécution complète.

**Non-Goals:**

- Implémenter le scheduler, l’exécution complète des tâches, ou l’orchestration worker pool dans ce change.
- Définir l’ensemble des plugins et leurs schémas d’inputs/outputs (seulement les mécanismes d’extension/validation).
- Ajouter une UI ou une expérience low-code.

## Decisions

- **YAML → AST typé → validation multi-étapes**
  - Décision : séparer le parsing YAML (structure brute) de la normalisation vers un AST typé, puis exécuter des validations.
  - Rationale : permet des messages d’erreur plus précis, un modèle stable, et une validation sémantique (DAG) au-delà du schéma.
  - Alternative : valider directement l’objet YAML sans normalisation → rejeté (diagnostics plus pauvres, logique dispersée).

- **Valibot comme moteur principal de validation du schéma**
  - Décision : utiliser Valibot pour les validations de structure/types/ranges/enums, et compléter par des validations sémantiques custom.
  - Rationale : cohérence avec la validation config déjà en place, erreurs structurées (`issues`) exploitables.
  - Alternative : Zod / Ajv → rejeté pour rester cohérent et minimiser la surface de dépendances.

- **Validation sémantique dédiée (DAG) en plus du schéma**
  - Décision : implémenter des checks dédiés :
    - IDs uniques
    - `needs` référence des task IDs existants
    - pas de cycles dans le graphe
    - topological order possible
  - Rationale : un schéma ne suffit pas à garantir un DAG valide.

- **Contrat minimal de `type` pour les tasks (plugin-driven)**
  - Décision : `type` suit un format strict `namespace/plugin.action`.
  - Rationale : évite ambiguïtés, facilite routing vers plugin registry/SDK.
  - Alternative : type libre → rejeté (erreurs tardives, surface d’attaque plus large).

- **Secrets interdits dans le DSL**
  - Décision : valider que certains champs ne peuvent pas contenir des secrets (au minimum interdire une section `secrets:` et documenter l’injection runtime).
  - Rationale : réduit le risque de fuite (VCS, logs).
  - Alternative : permettre secrets inline → rejeté (incompatible security model).

- **Évolution du DSL via version explicite (optionnelle) et tolérance contrôlée**
  - Décision : prévoir un champ `apiVersion`/`version` (optionnel au départ) et une stratégie : champs inconnus refusés par défaut, mais possibilité de whitelister via extensions plugin.
  - Rationale : garantit compatibilité et sécurité.

## Risks / Trade-offs

- **[Risk] DSL trop rigide et bloquant pour l’adoption** → Mitigation : versioning + extension points; permettre des champs `metadata` et `labels`.
- **[Risk] Validation sémantique incomplète (cycles corner cases)** → Mitigation : tests table-driven + property tests ciblés (plus tard) + algorithme topo standard.
- **[Risk] Couplage fort à Valibot** → Mitigation : isoler la validation derrière une interface `validateWorkflow()` et préserver les types en sortie.
- **[Risk] Plugins non disponibles au moment de la validation** → Mitigation : séparer validation “core DSL” (structure + DAG) de validation “plugin schema” (optionnelle/late-bound).
