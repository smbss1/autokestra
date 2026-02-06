## Context

Aujourd’hui, le repo contient surtout les fondations (config/loader). Le moteur n’a pas encore de scheduler qui:
1) transforme un ensemble de tâches + dépendances (`needs`) en un graphe exécutable,
2) calcule de façon déterministe quelles tâches peuvent démarrer,
3) dispatch ces tâches vers un worker pool / file.

Ce change introduit ces briques de manière indépendante de l’implémentation exacte du stockage (SQLite puis PostgreSQL) et de l’orchestrateur de workers. La conception vise un cœur « pur » (algorithmes déterministes) autour duquel on branchera ensuite la persistance et l’exécution.

Contraintes clés:
- déterminisme (ordre stable, résultats reproductibles),
- crash-safety (pas de pertes d’unités de travail; reprise possible),
- extensible (futurs triggers, priorités, WAITING, dynamic fan-out, etc.).

## Goals / Non-Goals

**Goals:**
- Définir une représentation de DAG exécutable (nodes/edges) et la validation associée (IDs, dépendances, cycles).
- Définir un calcul de tâches « runnable » à partir du graphe et d’un état d’exécution (tâches terminées/en cours/échouées) avec un ordre de sortie stable.
- Définir un scheduler loop (tick ou event-driven) qui sélectionne un sous-ensemble de runnable en respectant des limites de concurrence.
- Établir des interfaces claires (résolution DAG / runnable / dispatch) pour permettre l’implémentation progressive.

**Non-Goals:**
- Implémenter un worker pool complet, isolation WASM, ou exécution réelle de plugins.
- Implémenter la persistance complète des exécutions et la reprise multi-process (ce change prépare les contrats; la persistance fine sera détaillée dans le change « execution-model-states »).
- Supporter des DAG dynamiques (création de tasks à runtime), des priorités avancées, ou une planification multi-tenant.

## Decisions

- **Représentation du graphe**
  - Choix: construire un `WorkflowGraph` en mémoire à partir de la définition workflow (liste de tâches). Chaque nœud est indexé par `taskId`. Chaque arête est orientée `dep -> task` (la tâche dépend de `dep`).
  - Rationale: facilite (a) validation, (b) topo-sort, (c) calcul de runnable par inspection des prédécesseurs.
  - Alternatives: exécuter directement sur la structure YAML (plus simple au début) → rejeté car rend validation/ordre/runnable plus difficiles et non centralisés.

- **Validation DAG (erreurs déterministes)**
  - Choix: valider:
    - unicité des `taskId`,
    - existence des `needs` (pas de dépendance vers un id absent),
    - absence de cycles (Kahn ou DFS),
    - absence d’auto-dépendance.
  - Rationale: échec tôt et explicite, indispensable pour éviter des exécutions inconsistantes.
  - Détail déterminisme: en cas de plusieurs nœuds éligibles (Kahn), utiliser un tri lexical sur `taskId` comme tie-breaker.

- **Calcul des tâches runnable (fonction pure)**
  - Choix: implémenter un `selectRunnableTasks(graph, executionState, now)` pur qui retourne une liste ordonnée (stable) des `taskId` runnable.
  - Rationale: testable, indépendant de la persistance et du dispatch.
  - Politique par défaut:
    - une tâche est runnable si elle n’est pas démarrée et si tous ses prédécesseurs sont en état terminal de succès,
    - une tâche dont un prédécesseur est en échec terminal est considérée non runnable (bloquée) tant qu’une règle de retry/compensation n’a pas été appliquée,
    - les retries d’une tâche échouée sont gérés via un champ d’état (tentatives restantes + prochain instant admissible / backoff) afin de rendre le runnable dépendant du temps.
  - Alternatives: « runnable » basé sur des événements uniquement (sans recalcul) → rejeté car plus fragile (risque de divergence) et moins simple à tester.

- **Boucle de scheduling et dispatch (interfaces)**
  - Choix: séparer en trois couches:
    1) `resolveWorkflowGraph(workflowDefinition) -> WorkflowGraph`
    2) `selectRunnableTasks(graph, state, now) -> taskIds[]`
    3) `dispatch(taskIds, limits) -> enqueued[]`
  - Le scheduler loop peut être:
    - event-driven (déclenché sur transitions d’état),
    - ou tick-based (intervalle régulier).
  - Rationale: le cœur algorithme reste identique; seul le déclencheur change.

- **Concurrence et équité**
  - Choix: limites de concurrence minimales:
    - `maxInFlightGlobal` (capacité worker pool),
    - `maxInFlightPerExecution` (éviter qu’une exécution monopolise tout).
  - Sélection: prendre la liste runnable ordonnée et tronquer selon les slots libres.
  - Alternatives: fairness avancée (round-robin multi-execution, priorités) → reporté.

## Risks / Trade-offs

- **[Risque] Divergence entre état et queue** → **Mitigation**: utiliser des transitions atomiques (réservation d’une tâche) et recalcul runnable idempotent.
- **[Risque] Starvation (tâches toujours repoussées)** → **Mitigation**: ordre stable + limites per-execution; ajouter fairness multi-execution ultérieurement.
- **[Risque] Coût CPU sur grands DAG** → **Mitigation**: graphe résolu une fois (cache par workflow version), incremental checks lors des transitions.
- **[Risque] Sémantique failure propagation ambiguë** → **Mitigation**: rendre la règle explicite dans les specs (bloqué vs annulé vs skipped) et la tester.

