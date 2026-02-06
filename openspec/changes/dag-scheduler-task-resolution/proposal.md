## Why

Le moteur a besoin d’un scheduler capable de transformer un workflow (tâches + dépendances) en un plan d’exécution déterministe, puis de décider à chaque instant quelles tâches sont « runnable ». Sans cette brique, l’exécution reste implicite, difficile à reprendre après crash, et non fiable dès qu’on introduit DAG, retries et concurrence.

## What Changes

- Ajout d’une résolution de DAG à partir du DSL (`tasks` + `needs`) qui construit un graphe exécutable, valide les dépendances, et détecte les cycles.
- Ajout d’un calcul explicite des tâches « runnable » basé sur l’état d’exécution (tâches terminées, échouées, en cours) et les règles de retry/backoff.
- Ajout d’une boucle de scheduling (tick / event-driven) qui:
  - sélectionne des tâches runnable,
  - respecte des limites de concurrence (globale et/ou par exécution),
  - publie des unités de travail vers la file/worker pool.

## Capabilities

### New Capabilities
- `dag-task-graph-resolution`: Construire et valider un graphe de tâches depuis la définition YAML (ids, `needs`, détection de cycles, erreurs de résolution).
- `runnable-task-selection`: Déterminer de façon déterministe l’ensemble des tâches prêtes à être exécutées, à partir de l’état courant et des règles de retry.
- `scheduler-dispatch-loop`: Orchestrer l’itération de scheduling et le dispatch des tâches runnable vers des workers en respectant la concurrence et l’équité.

### Modified Capabilities

<!-- none (no existing specs yet) -->

## Impact

- `packages/engine`: nouveaux modules (ou extension) autour de la représentation du DAG, du calcul de runnable, et du scheduler.
- Modèle d’exécution: nécessite des lectures/écritures d’état atomiques (au minimum: états de tâches + transitions) pour rester crash-safe.
- Tests: ajout de tests unitaires sur la résolution de graphe (cycles, dépendances manquantes), et sur la sélection runnable (topologie, retries).
