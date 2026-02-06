## Context

Autokestra vise des exécutions déterministes et crash-safe. Après le bootstrap (structure, config, CLI), le socle logique suivant est de formaliser le modèle d’exécution et la machine d’état (workflow executions, task runs/attempts). Sans ce contrat, les composants suivants (scheduler, worker pool, state store, observabilité) risquent de diverger et de produire des comportements non idempotents ou impossibles à reprendre.

Contraintes clés :

- Runtime Bun + TypeScript, monolithe strictement modulaire (`packages/engine` central).
- CLI-first : la machine d’état doit exposer des informations inspectables et des erreurs explicites.
- Crash-safety : transitions idempotentes et reprise possible après redémarrage.
- Extensibilité : actions exécutées via plugins; la machine d’état ne doit pas dépendre d’implémentations plugin spécifiques.

## Goals / Non-Goals

**Goals:**

- Définir une machine d’état exécution + tâche (states, transitions, invariants) et une API de transition pure.
- Définir un modèle de données minimal pour persister l’état (même si la persistance arrive plus tard), incluant `attempts`, timestamps et reason codes.
- Définir les primitives de contrôle du cycle de vie : cancel et timeout, et leurs effets sur l’exécution.
- Produire des diagnostics stables utilisables par la CLI (`execution inspect`, `execution cancel`).

**Non-Goals:**

- Implémenter la persistance SQLite/PG complète dans ce change (seulement le contrat et la structure).
- Implémenter le scheduler, le worker pool ou le runtime WASM.
- Définir un format final d’API HTTP publique.

## Decisions

- **Machine d’état explicite + transitions idempotentes**
  - Décision : implémenter une fonction de transition déterministe (type `transition(current, event) -> next`) avec invariants.
  - Rationale : facilite testabilité, crash-safety et replays; évite la logique “dispersée”.
  - Alternative : transitions ad-hoc partout dans le code → rejeté (difficile à raisonner, bug-prone).

- **Événements de transition (event-driven) plutôt que “setStatus”**
  - Décision : transitions déclenchées par des événements structurés (ex: `ExecutionStarted`, `TaskSucceeded`, `CancellationRequested`).
  - Rationale : explicite les causes, facilite audit/logging et reason codes.
  - Alternative : mutation directe de l’état → rejeté (perd l’intention/raison).

- **Séparation Execution vs TaskRun/Attempt**
  - Décision : modéliser au moins :
    - `Execution` (instance d’un workflow)
    - `TaskRun` (instance d’exécution d’une tâche)
    - `Attempt` (essai d’un TaskRun)
  - Rationale : supporte retry/backoff futur, timeouts par tâche, et inspection fine.

- **Reason codes et timestamps normalisés**
  - Décision : chaque transition terminale (SUCCESS/FAILED/CANCELLED) doit porter un `reasonCode` et des timestamps (created/started/ended) + `updatedAt`.
  - Rationale : diagnostics stables et exploitables en CLI/JSON.

- **WAITING comme état “bloqué” explicite**
  - Décision : conserver WAITING pour : dépendances non satisfaites, attente d’événement/trigger, backoff, ou ressource.
  - Rationale : évite d’abuser RUNNING/PENDING et clarifie l’inspection.

## Risks / Trade-offs

- **[Risk] Sur-spécification trop tôt** → Mitigation : viser un noyau minimal (contrat) et garder l’API extensible (reasonCode, metadata).
- **[Risk] Invariants incomplets → états incohérents** → Mitigation : tests table-driven sur transitions et propriétés (idempotence, terminality).
- **[Risk] Couplage avec futur state store** → Mitigation : définir une interface `ExecutionStore` séparée; transitions pures indépendantes du stockage.

## Migration Plan

- Étape 1 : Introduire les types d’état et modèles de données dans `packages/engine`.
- Étape 2 : Implémenter la fonction de transition + validateurs d’invariants.
- Étape 3 : Adapter la CLI (au minimum stubs) pour exposer `execution inspect`/`cancel` sur la structure.
- Rollback : les changements sont additifs; possibilité de garder une implémentation “in-memory” sans persistance.

## Open Questions

- Granularité des états TaskRun : faut-il aussi `SKIPPED`/`RETRYING` dès v0.1 ?
- Format exact des reason codes (enum vs string convention) et stabilité sur versions.
- Persistance : event-sourcing vs snapshot + history table (décision à prendre lors du state store).
