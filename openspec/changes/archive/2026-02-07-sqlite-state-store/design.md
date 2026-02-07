## Context

Autokestra a implémenté un modèle d'exécution avec machine d'état (PENDING/RUNNING/WAITING/SUCCESS/FAILED/CANCELLED) et des structures de données pour Execution, TaskRun, et Attempt. Actuellement, tout est en mémoire : à chaque redémarrage, l'état est perdu. Pour atteindre les objectifs de crash-safety et de déterminisme, il faut persister cet état dans une base de données.

Contraintes clés :

- Runtime Bun + TypeScript, monolithe modulaire (`packages/engine`).
- Hardware modeste (2 CPU / 4GB RAM) : SQLite offre un excellent ratio performance/simplicité pour v0.1.
- CLI-first : les commandes `execution list|logs|inspect` doivent interroger le store.
- Extensibilité future : migration vers PostgreSQL en production (v0.2) → conception d'une abstraction état/store.
- Crash-safety : transactions ACID, récupération déterministe des exécutions interrompues.

État actuel :

- Machine d'état implémentée dans `packages/engine/src/execution` (types, modèles, transitions).
- Scheduler et worker pool créent/modifient des exécutions en mémoire.
- Aucune persistance → pas de reprise après crash.

## Goals / Non-Goals

**Goals:**

- Persister workflows, executions, task runs, attempts, et outputs dans SQLite.
- Fournir une interface abstraite (StateStore) permettant de basculer vers PostgreSQL plus tard.
- Système de migrations incrémentales avec détection de version et rollback.
- Récupération automatique des exécutions RUNNING/PENDING au démarrage (crash recovery).
- Indexes optimisés pour les requêtes CLI fréquentes (list, lookup by ID, filter by status/date).
- Transactions garantissant la cohérence lors des transitions d'état multiples (ex: execution + task runs).
- Configuration : chemin DB, retention des logs, WAL mode.

**Non-Goals:**

- Implémentation PostgreSQL complète dans ce change (seulement l'abstraction).
- Sharding, réplication, ou haute disponibilité (monolithe v0.1).
- Stockage d'artifacts volumineux (fichiers, blobs) : outputs stockés inline pour commencer, optimisations futures.
- GUI d'administration de la DB.
- Recherche full-text ou requêtes complexes analytiques (pas dans v0.1).

## Decisions

- **SQLite via better-sqlite3**
  - Décision : utiliser `better-sqlite3` (binding Node/Bun, synchrone, performant).
  - Rationale : Bun supporte bien `better-sqlite3`; API synchrone simplifie les transactions; performances excellentes pour workload local.
  - Alternative : Bun native `bun:sqlite` → rejeté (moins mature, moins d'écosystème migrations).

- **Interface abstraite StateStore**
  - Décision : définir une interface TypeScript `StateStore` avec méthodes CRUD pour workflows/executions/task runs/attempts; implémenter `SQLiteStateStore`.
  - Rationale : facilite migration future vers PostgreSQL; découplage du code métier; testabilité (mocks).
  - Alternative : couplage direct SQLite → rejeté (rigide, migration coûteuse).

- **Schéma relationnel normalisé**
  - Décision : tables `workflows`, `executions`, `task_runs`, `attempts`, `outputs` avec clés étrangères et indexes.
  - Rationale : cohérence relationnelle, requêtes JOIN efficaces, intégrité référentielle.
  - Alternative : JSON blob par execution → rejeté (difficile à requêter, pas d'indexes sur champs).

- **Migrations avec numéros de version séquentiel**
  - Décision : migrations dans `migrations/` numérotées (001_initial.sql, 002_add_retry_fields.sql), table `schema_version` pour tracking.
  - Rationale : standard, simple, rollback via down migrations.
  - Alternative : ORM avec auto-migration (TypeORM, Prisma) → rejeté (overhead, complexité, perte de contrôle).

- **WAL mode activé par défaut**
  - Décision : activer Write-Ahead Logging (WAL) pour meilleures performances en écriture/lecture concurrente.
  - Rationale : WAL améliore concurrency et crash recovery; faible overhead disque.
  - Alternative : mode journal classique → rejeté (lockage plus agressif).

- **Transactions explicites pour transitions d'état**
  - Décision : wrappé toute transition d'execution + task runs dans une transaction DB.
  - Rationale : garantit atomicité (ex: si execution passe RUNNING → SUCCESS, tous les tasks doivent se finaliser ensemble).
  - Alternative : commits individuels → rejeté (risque d'incohérence).

- **Récupération crash : query au startup**
  - Décision : au démarrage du serveur, requêter executions en état RUNNING/PENDING et les marquer comme FAILED (avec reasonCode CRASH_RECOVERY) ou PENDING pour requeue.
  - Rationale : déterministe, observable (logs), évite executions zombies.
  - Alternative : heartbeat/lease → rejeté (complexité, pas nécessaire pour monolithe local).

- **Retention configurable (soft-delete ou purge)**
  - Décision : config `storage.retentionDays`; purge automatique des executions SUCCESS/FAILED/CANCELLED plus anciennes.
  - Rationale : évite croissance infinie du DB sur machine modeste.
  - Alternative : archivage externe → out of scope v0.1.

## Risks / Trade-offs

- **[Risk] Taille de la DB SQLite avec outputs volumineux** → Mitigation : limite de taille output inline (ex: 10MB); si dépassé, erreur ou stockage externe (v0.2).
- **[Risk] Migrations forward-only cassent rollback** → Mitigation : tester down migrations; doc explicite; préférer additive changes.
- **[Risk] Concurrency SQLite limitée (un writer à la fois)** → Mitigation : acceptable pour v0.1 (hardware modeste); WAL améliore; migration PG en v0.2 si nécessaire.
- **[Risk] Corruption DB en cas de crash brutal** → Mitigation : WAL + journaling SQLite robuste; backup config recommandé en prod; tests de crash recovery.
- **[Risk] Requêtes CLI lentes si volume élevé** → Mitigation : indexes sur (workflowId, executionId, state, createdAt); LIMIT par défaut; pagination.

## Migration Plan

- Étape 1 : Introduire interface `StateStore` et types de persistence dans `packages/engine/src/storage`.
- Étape 2 : Implémenter `SQLiteStateStore` avec schéma initial (migration 001).
- Étape 3 : Adapter scheduler et worker pool pour appeler `StateStore.save()` à chaque transition.
- Étape 4 : Ajouter récupération crash au startup du serveur.
- Étape 5 : Adapter CLI (`execution list|logs|inspect`) pour interroger le store.
- Rollback : si échec critique, réversion possible en désactivant persistence (config flag); données perdues mais système fonctionnel en mode "in-memory" temporaire (requires code path).

## Open Questions

- Format exact des outputs : JSON inline vs références externes (déterminé par tests de performance).
- Stratégie de backup automatique SQLite : snapshots périodiques ou manuel user (doc seulement v0.1).
- Faut-il persister les logs ligne par ligne ou par batch (batch + flush au terminal/crash pour perf).
