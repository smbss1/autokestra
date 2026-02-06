## Why

Pour exécuter des workflows de manière déterministe et crash-safe, Autokestra doit disposer d’un modèle d’exécution explicite (workflow execution + task runs) et d’une machine d’état avec transitions idempotentes. On le fait maintenant car toutes les futures briques (scheduler, worker pool, persistance, logs/inspect) dépendent d’un contrat d’états clair et stable.

## What Changes

- Définition d’un modèle de données d’exécution (execution, task run/attempts) et des états supportés : PENDING, RUNNING, WAITING, SUCCESS, FAILED, CANCELLED.
- Spécification d’une machine d’état avec transitions autorisées, invariants, et horodatage.
- Spécification des règles d’idempotence/crash-safety (rejouabilité, reprise après redémarrage).
- Spécification des primitives de cancellation et timeouts au niveau exécution et tâche.
- Standardisation des diagnostics d’état (reason codes / messages) pour CLI `execution inspect` et logs.

## Capabilities

### New Capabilities
- `execution-state-machine`: Contrat d’états, transitions autorisées, invariants et idempotence.
- `execution-data-model`: Modèle de données pour executions et task runs/attempts (champs, clés, contraintes).
- `execution-lifecycle-controls`: Contrôles de cycle de vie (cancel, timeout) et propagation/effets sur les états.

### Modified Capabilities
<!-- None (no existing specs yet) -->

## Impact

- Ajout de types/structures dans `packages/engine` pour représenter les états et transitions.
- Impacts futurs sur le state store (SQLite/PG) pour persister l’historique et permettre la reprise.
- Ajustements attendus côté CLI pour exposer `execution inspect|cancel` avec codes de sortie déterministes.
