## Context

Le scheduler (change séparé) produit des work items à exécuter et doit connaître la capacité disponible pour respecter `maxConcurrentTasks`. Actuellement, il n’existe pas de composant « worker pool » local:
- capable de bufferiser les tâches (queue),
- d’exécuter en parallèle (concurrence configurable),
- de faire respecter la backpressure,
- de supporter cancellation + timeouts,
- et de garantir un arrêt propre (shutdown) sans fuite de ressources.

Dans v0.1, la cible est un mode **single-node** et **single-process**: tout tourne dans le même process Bun. Le design doit rester compatible avec une future séparation (process workers / remote queue) en isolant les interfaces.

## Goals / Non-Goals

**Goals:**
- Définir une queue locale avec capacité et sémantique de backpressure déterministe.
- Définir un worker pool local avec:
  - concurrence configurable,
  - tracking d’in-flight,
  - exécution de work items via un exécuteur abstrait,
  - primitives de shutdown (graceful + force).
- Définir cancellation/timeouts (par tâche et par exécution) et leurs effets sur les états finaux.
- Fournir des interfaces claires pour brancher la persistance/état (réservation, transitions) sans les implémenter complètement ici.

**Non-Goals:**
- Exécuter réellement des plugins WASM (c’est le runtime plugin).
- Implémenter une queue persistée/distribuée.
- Implémenter un modèle complet de retry/backoff (c’est une concern scheduler/state machine).
- Garantir une isolation forte (process-level) à ce stade; on vise une isolation logique minimale.

## Decisions

- **Queue in-memory bornée, FIFO**
  - Choix: une queue in-memory avec capacité fixe (configurable) et ordre FIFO.
  - Rationale: simple, déterministe, suffisant pour v0.1 single-node.
  - Alternatives: queue non bornée (rejetée: OOM), priorité (reportée).

- **Backpressure via échec explicite ou attente**
  - Choix: exposer une API d’enqueue qui permet soit:
    - `tryEnqueue` (retourne false si plein),
    - et/ou `enqueue` qui attend (promise) jusqu’à un slot disponible.
  - Rationale: permet au scheduler d’appliquer sa propre stratégie (skip tick, attendre event, etc.).

- **Worker pool basé sur « slots »**
  - Choix: le pool a une taille `concurrency`, et un compteur `inFlight`. Chaque slot consomme un work item, exécute via `TaskExecutor`, puis publie la complétion.
  - Rationale: modèle classique, facile à tester.

- **Contrat d’exécution via interface `TaskExecutor`**
  - Choix: `TaskExecutor.execute(workItem, signal)` retourne une promise (success/failure) et respecte `AbortSignal`.
  - Rationale: sépare worker pool vs logique d’exécution (plugin runtime plus tard).
  - Alternatives: exécution inline dans le worker pool (rejetée: couplage fort).

- **Cancellation/timeouts via AbortController**
  - Choix: utiliser `AbortController`/`AbortSignal` pour propager cancellation et timeouts.
  - Rationale: primitives standard, compatibles fetch + APIs.
  - Timeout: wrapper qui abort après deadline; cancellation explicite idem.

- **Idempotence et anti double-dispatch**
  - Choix: le worker pool doit accepter des work items identifiés (executionId + taskId + attempt) et ne pas exécuter deux fois le même work item si re-submis (au moins dans le process).
  - Rationale: protège contre ticks répétés et bugs; la garantie stronger sera portée par l’état/persistance.

- **Shutdown**
  - Choix: deux modes:
    - graceful: arrêter de consommer la queue, attendre les in-flight jusqu’à un timeout,
    - force: abort tous les in-flight.
  - Rationale: nécessaire pour CLI/server stop propre.

## Risks / Trade-offs

- **[Risque] Fuites de ressources (timers, promises pendantes)** → **Mitigation**: centraliser timeouts, nettoyer handlers, tests de shutdown.
- **[Risque] Deadlocks (enqueue await + scheduler)** → **Mitigation**: fournir `tryEnqueue` et documenter les usages; tests de saturation.
- **[Risque] Cancellation incomplète si l’exécuteur ignore AbortSignal** → **Mitigation**: contrat explicite + tests; wrappers côté executor.
- **[Risque] Incohérence état vs in-memory pool lors crash** → **Mitigation**: design interface pour réservation + transitions; crash-safety réelle traitée par state store.

## Migration Plan

- Introduire les interfaces (`TaskQueue`, `TaskExecutor`, `WorkerPool`) et une implémentation in-memory.
- Intégrer progressivement avec scheduler (dispatch) et état (réservation/transition), en gardant un harness/test-only au début.
- Ajouter knobs de config (capacité queue, concurrency, timeouts) via la config existante.

## Open Questions

- Sémantique exacte quand une tâche est CANCELLED: doit-on interrompre instantanément ou laisser terminer si near-complete?
- Granularité des timeouts (par task vs global execution) et priorités entre eux.
- Interface minimale de « state store » requise pour réserver/commit le dispatch de manière atomique.
