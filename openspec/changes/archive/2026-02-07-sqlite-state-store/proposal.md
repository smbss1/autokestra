## Why

Pour garantir des exécutions déterministes et crash-safe, Autokestra doit persister l'état des workflows, exécutions, tâches, et logs. SQLite offre une solution légère, zéro-dépendance, et performante pour le cas d'usage v0.1 (machine modeste, monolithe local), tout en posant les fondations pour une migration future vers PostgreSQL en production.

## What Changes

- Implémentation d'un state store SQLite persistant les workflows, exécutions, task runs, attempts, et outputs.
- Système de migrations de schéma avec versioning et rollback.
- Couche DAO/repository abstraite permettant de basculer entre SQLite et PostgreSQL ultérieurement.
- Indexes optimisés pour les requêtes fréquentes (list executions, lookup by ID, status queries).
- Transactions ACID pour garantir la cohérence lors des transitions d'état.
- API de reprise après crash : récupération des exécutions RUNNING/PENDING au redémarrage.
- Gestion de la rétention des logs et outputs avec purge configurable.

## Capabilities

### New Capabilities
- `state-store-interface`: Interface abstraite du state store (create/read/update/query workflows, executions, task runs).
- `sqlite-persistence`: Implémentation SQLite du state store avec schéma, connexion pooling, et transactions.
- `schema-migrations`: Système de migrations de base de données avec détection de version, application incrémentale, et rollback.
- `execution-recovery`: Logique de récupération des exécutions interrompues au démarrage du moteur (crash recovery).

### Modified Capabilities
<!-- None - this is foundational infrastructure -->

## Impact

- Ajout de dépendance SQLite (via `better-sqlite3` ou Bun native).
- Nouveau package ou module `packages/engine/src/storage` avec interfaces et implémentation SQLite.
- Intégration dans le scheduler et le worker pool pour persister les transitions d'état via le state store.
- Modifications dans l'engine pour charger/sauvegarder l'état des exécutions à chaque transition.
- CLI `workflow execution list|logs|inspect` doit interroger le state store SQLite.
- Configuration : ajout de paramètres `storage.type`, `storage.sqlite.path`, `storage.retentionDays` dans config.yaml.
- Tests d'intégration avec base SQLite temporaire pour valider crash recovery et migrations.
