# Roadmap – Milestones & Epics (à partir du PRD)

Objectif : transformer le PRD en **milestones livrables** et en **epics découpables en issues**. Pas de GUI en v1, CLI-first.

---

## Conventions

- **Milestone** = incrément produit “shippable” (taggable, release notes, upgrade path).
- **Epic** = capacité majeure livrable, découpée en stories/tasks.
- **DoD (Definition of Done)** minimal pour chaque epic :
  - Spécification + schémas validés
  - Tests/fixtures pertinents
  - Logs/metrics minimales
  - Documentation CLI + exemples YAML

---

## Milestone 0 — Bootstrap (fondations repo & DX)

**But** : rendre le projet exécutable localement et automatiser la qualité.

### Epics

### E0.1 — Structure monorepo & conventions

- Livrables : structure packages (core/cli/sdk), conventions de versioning, scripts bun, CI lint/test.
- Critères : `bun test`/`bun lint` OK en CI; templates de contributions.

### E0.2 — Configuration & override env

- Livrables : lecture de config YAML (cf. PRD §10), override via variables d’environnement.
- Critères : mêmes settings disponibles en fichier + env; erreurs de config explicites.

### E0.3 — CLI skeleton

- Livrables : arbre de commandes (server/workflow/execution/plugin/config) avec help, exit codes déterministes.
- Critères : `--json` disponible sur commandes list/describe; codes d’erreur stables.

---

## Milestone v0.1 — Core engine + CLI + YAML + WASM + SQLite

**But** : exécuter des workflows YAML déterministes via CLI, avec persistance SQLite et plugins WASM (sandbox), sur une seule machine.

### Epics (v0.1)

### E1.1 — Workflow DSL & validation

- Portée : parsing YAML, schéma (id, enabled, trigger, tasks), graph/`needs`, templates basiques.
- Livrables : validateur strict + messages d’erreur, loader de workflows, registry local.
- Critères : workflows invalides rejetés; DAG détecte cycles; exécution reproductible.

### E1.2 — Modèle d’exécution & états

- Portée : états PENDING/RUNNING/WAITING/SUCCESS/FAILED/CANCELLED, transitions idempotentes.
- Livrables : machine d’état, règles de transition, horodatage, attempts.
- Critères : transitions crash-safe; reprise cohérente après redémarrage.

### E1.3 — Scheduler DAG & résolution des tâches

- Portée : déterminer tâches “runnable” selon `needs`, fan-in/fan-out.
- Livrables : planificateur, stratégie simple (FIFO/priorité), limites de concurrence.
- Critères : respecte `maxConcurrentWorkflows` et `maxConcurrentTasks`.

### E1.4 — Worker pool local

- Portée : pool d’exécuteurs en process (ou threads) avec backpressure.
- Livrables : queue, cancellation, timeouts, isolation par exécution.
- Critères : pas de fuite de ressources; arrêt propre.

### E1.5 — Persistance SQLite (state store)

- Portée : stockage workflows, executions, tasks, logs, outputs (cf. PRD §5.1 / §6.1).
- Livrables : migrations, DAO/repositories, indexes, transactions.
- Critères : reprise après crash; aucune corruption; perf acceptable sur machine modeste.

### E1.6 — Plugin runtime (sandbox) + SDK v1

- Portée : exécuter des actions plugin; protocole d’IO (inputs/outputs), erreurs.
- Livrables : runtime (process/docker), API host minimal (logger, clock, env virtuel).
- Critères : pas d’exécution de code natif non approuvé; limites de mémoire/CPU configurables.

### E1.7 — Permissions v1 (deny by default)

- Portée : modèle de permissions (network allowlist, fs virtualisé, env explicite).
- Livrables : enforcement runtime, déclaration dans `plugin.yaml`.
- Critères : accès refusé par défaut; audit log minimal sur refus.

### E1.8 — Secrets manager v1 (local encrypted)

- Portée : pas de secrets dans YAML; injection runtime; scope strict.
- Livrables : store local chiffré + provider env, CLI `config set`/`secrets` (si retenu).
- Critères : secrets jamais persistés en clair; masquage dans logs.

### E1.9 — Observabilité & debuggabilité (logs/inspect)

- Portée : logs structurés, suivi d’exécution, `execution logs|inspect`.
- Livrables : corrélation (workflowId/executionId/taskId), niveaux, export JSON.
- Critères : diagnostiquer un échec sans instrumentation externe.

### E1.10 — Server API v1 (minimal)

- Portée : serveur HTTP (Hono/Bun) pour status, apply/list workflows, list executions.
- Livrables : endpoints read-mostly, auth basique (token) si nécessaire.
- Critères : compatible automation; pas de GUI.

### DoD v0.1 (release)

- Lancer le serveur + appliquer un workflow YAML + exécuter sur trigger simple.
- SQLite par défaut, sans dépendance externe.
- Plugins WASM exécutables avec permissions “deny by default”.

---

## Milestone v0.2 — Registry plugins + PostgreSQL + Webhooks + Retry policies

**But** : rendre le moteur utilisable en prod light : registry, DB prod, triggers web, retry/backoff.

### Epics (v0.2)

### E2.1 — Plugin registry & install

- Portée : types de registry (HTTP officiel, GitHub repo, URL directe), versions immuables.
- Livrables : CLI `plugin install|list|remove`, checksums, cache.
- Critères : install reproductible; vérification checksum; rollback simple.

### E2.2 — Signatures & supply-chain (optionnel v0.2, recommandé)

- Portée : signatures optionnelles, trust store.
- Livrables : format de signature, validation à l’installation.
- Critères : échec explicite si signature requise et invalide.

### E2.3 — Persistance PostgreSQL

- Portée : backend PG (prod), migrations, compat modèle SQLite.
- Livrables : driver, pool, tests d’intégration (si infra dispo), doc.
- Critères : compat fonctionnelle; performance correcte; reprise OK.

### E2.4 — Trigger Webhook

- Portée : trigger webhook (path/method), validation payload, auth.
- Livrables : routing, sécurité (anti-abuse), mapping input -> execution.
- Critères : endpoints stables; erreurs 4xx/5xx déterministes.

### E2.5 — Retry & backoff

- Portée : policies (max, exponential/linear), retryable errors, jitter.
- Livrables : moteur de retry par task, persistance attempts.
- Critères : retries déterministes; pas de boucle infinie; observabilité claire.

### E2.6 — Hardening sécurité v0.2

- Portée : mitigations PRD §14 (SSRF, leakage, YAML injection).
- Livrables : validations, allowlists, sanitization templating, audit logs.
- Critères : tests de sécurité basiques; documentation des limites.

### DoD v0.2 (release)

- Webhook trigger en prod, retries configurables, PG support.
- Registry plugin utilisable avec checksums.

---

## Milestone v1.0 — Production hardening + stabilité + compatibilité

**But** : stabilité et garanties, compat descendante, opérationnel en prod (toujours monolith modulaire).

### Epics (v1.0)

### E3.1 — Backward compatibility & versioning DSL

- Portée : stratégie de version de DSL, dépréciations, migrations.
- Livrables : champ `apiVersion`/`dslVersion` (si retenu), validateurs multi-versions.
- Critères : workflows v0.x continuent de tourner; messages de dépréciation.

### E3.2 — Performance & limites (2 CPU / 4GB)

- Portée : benchmarks, limites mémoire/CPU WASM, tuning concurrency.
- Livrables : profils, docs sizing, paramètres.
- Critères : objectifs de latence/throughput définis + atteints sur machine cible.

### E3.3 — Opérations & déploiement

- Portée : Docker image officielle, config prod, healthchecks.
- Livrables : endpoints `/healthz`, `/readyz`, signals shutdown.
- Critères : déploiement reproductible; upgrade path.

### E3.4 — Observabilité avancée

- Portée : métriques (Prometheus/OpenTelemetry), traces (si possible), logs structurés.
- Livrables : exporter metrics, corrélation, doc.
- Critères : diagnostiquer perf + erreurs; SLOs de base.

### E3.5 — Sécurité & threat model “production”

- Portée : durcissement permissions, sandbox escape mitigations, audit trails.
- Livrables : guide sécurité, options “locked down”, rotation secrets.
- Critères : checklist sécurité; tests E2E sur scénarios PRD §14.

### E3.6 — Ecosystème plugins “community-ready”

- Portée : guide dev plugin, templates, compat runtime.
- Livrables : `plugin init`, pipeline build/sign/publish, docs.
- Critères : un plugin exemple “hello-world” + un plugin réseau avec allowlist.

### DoD v1.0 (release)

- Compat stable, docs d’exploitation, durcissement sécurité, observabilité solide.

---

## Mapping rapide PRD → Epics

- CLI-first : E0.3, E1.9, E2.1
- YAML DSL : E1.1
- Scheduler/DAG : E1.3
- Worker pool : E1.4
- WASM plugins + permissions : E1.6, E1.7
- SQLite/PG : E1.5, E2.3
- Webhooks : E2.4
- Retry/backoff : E2.5
- Secrets : E1.8
- Security threat model : E1.7, E2.6, E3.5
- Observability : E1.9, E3.4

---

## Suggestion de labels GitHub (optionnel)

- `milestone:v0.1`, `milestone:v0.2`, `milestone:v1.0`
- `epic:E1.6-wasm-runtime`
- `area:cli|engine|scheduler|storage|plugins|security|observability`
- `type:feature|bug|chore|docs|test`
