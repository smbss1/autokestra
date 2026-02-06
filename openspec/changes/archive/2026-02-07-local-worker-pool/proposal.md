## Why

Pour exécuter des tâches de manière fiable et déterministe, le moteur a besoin d’un worker pool local qui consomme des unités de travail, applique la backpressure, et supporte cancellation/timeouts. Sans ce composant, le scheduler ne peut pas réellement « faire avancer » une exécution ni garantir un arrêt propre.

## What Changes

- Ajout d’une file de tâches (in-memory) et d’un pool d’exécuteurs locaux (dans le même process) avec un contrôle de concurrence.
- Ajout de backpressure: pas de dispatch au-delà de la capacité, et mécanismes de signalement de saturation.
- Ajout d’un modèle minimal de lifecycle d’exécution de tâche: start, heartbeat optionnel, completion, failure, cancellation.
- Ajout de timeouts et cancellation (par tâche et par exécution), avec arrêt propre et libération de ressources.

## Capabilities

### New Capabilities
- `local-task-queue-backpressure`: Fournir une queue locale avec capacité, primitives d’enqueue/dequeue, et comportements de backpressure déterministes.
- `worker-pool-task-execution`: Exécuter des work items via un pool local (concurrence configurable), avec tracking d’in-flight et isolation minimale par exécution.
- `task-cancellation-timeouts`: Supporter cancellation et timeouts (déclenchement, propagation, et état final) sans fuite de ressources.

### Modified Capabilities

<!-- none (no existing specs yet) -->

## Impact

- `packages/engine`: ajout de modules worker pool/queue + interfaces de dispatch.
- Scheduler: intégration avec la capacité du worker pool (slots libres) pour respecter `maxConcurrentTasks`.
- Modèle d’état: nécessite au minimum des transitions de tâches (RUNNING/SUCCESS/FAILED/CANCELLED) et une manière de marquer une tâche “réservée/dispatchée” pour éviter les doublons.
- Tests: unitaires (queue/backpressure) + tests de concurrence/cancellation/timeouts.
