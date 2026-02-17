## Context

Autokestra expose déjà un système de plugins core (`http`, `git-source`, `script`, `bash`) exécutés en mode process avec des contrats d’entrée/sortie JSON. Les workflows DevOps demandent fréquemment des opérations Docker (build/run) et Docker Compose (up/down), aujourd’hui couvertes par des scripts shell ad hoc.

Le changement ajoute deux plugins distincts (`core/docker` et `core/docker-compose`) pour éviter une surface API confuse et aligner la séparation conceptuelle entre moteur Docker et orchestration multi-services Compose.

## Goals / Non-Goals

**Goals:**
- Exposer des actions Docker natives via `core/docker.*` avec schémas typés et sorties déterministes.
- Exposer des actions Compose natives via `core/docker-compose.*` avec schémas typés et sorties déterministes.
- Uniformiser les résultats d’exécution (`success`, `exitCode`, `stdout`, `stderr`, `durationMs`, `timedOut`).
- Imposer explicitement l’usage de `@autokestra/plugin-sdk` depuis npmjs pour l’implémentation des plugins (pattern du plugin `bash`).

**Non-Goals:**
- Implémenter une abstraction complète de toutes les options CLI Docker/Compose.
- Gérer l’installation de Docker sur l’hôte.
- Introduire des capacités de sandbox supplémentaires dans ce changement.

## Decisions

### Décision 1: deux plugins séparés
- **Choix**: créer `core/docker` et `core/docker-compose` séparément.
- **Rationale**: API plus lisible, manifests plus simples, tests ciblés, meilleure découverte des actions côté workflow.
- **Alternative considérée**: un plugin unique `core/docker` avec actions `compose.*`; rejetée car elle mélange deux domaines et complexifie les schémas.

### Décision 2: MVP d’actions limité et explicite
- **Choix**: `core/docker` démarre avec `build` et `run`; `core/docker-compose` démarre avec `up` et `down`.
- **Rationale**: couvre les cas CI/CD majeurs sans surcharger la première itération.
- **Alternative considérée**: exposer des actions génériques `exec`; rejetée pour préserver la validation stricte des entrées.

### Décision 2.1: périmètre `docker run` au MVP (sans volumes)
- **Choix**: `docker run` MVP supporte `image + command/args + env + timeout` et n’expose pas de mapping de volumes hôte.
- **Rationale**: réduit fortement la surface d’attaque et simplifie la validation initiale.
- **Alternative considérée**: volumes dès le MVP; rejetée pour éviter des risques filesystem précoces.

### Décision 3: contrat de sortie uniforme
- **Choix**: toutes les actions retournent un format standard incluant code de sortie, sorties texte, durée, timeout, et `invokedCommand` optionnel.
- **Rationale**: facilite l’observabilité, la reprise d’erreur et la consommation downstream dans les workflows.

### Décision 4: SDK plugin via npmjs obligatoire
- **Choix**: les plugins MUST importer `@autokestra/plugin-sdk` comme dépendance npm (même style que `plugins/bash`).
- **Rationale**: contracte explicitement la dépendance publique du SDK, stabilise le pattern auteur plugin, évite les imports internes fragiles.
- **Alternative considérée**: imports workspace-only; rejetée car non représentatif d’une distribution plugin externe.

### Décision 5: support multi-fichiers Compose dès le MVP
- **Choix**: `core/docker-compose` accepte `files: string[]` (min 1) pour mapper `-f a -f b`.
- **Rationale**: usage fréquent en environnements réels, coût d’implémentation faible.

### Décision 6: stratégie de résolution Compose
- **Choix**: exécuter `docker compose` en priorité, puis fallback `docker-compose` si indisponible.
- **Rationale**: privilégie la commande moderne tout en restant compatible avec des hôtes existants.

### Décision 7: contrainte de sécurité de ce change
- **Choix**: plugins `docker` et `docker-compose` utilisables uniquement en mode workflow `trusted` dans ce change.
- **Rationale**: accès Docker hôte considéré privilégié; l’intégration fine d’une permission dédiée est traitée dans un changement séparé.

## Risks / Trade-offs

- **[Risque] Dépendance environnement Docker hôte** → **Mitigation**: erreurs explicites quand `docker`/`docker compose` est indisponible, documentation des prérequis.
- **[Risque] Variantes Compose (`docker compose` vs `docker-compose`)** → **Mitigation**: définir une stratégie de résolution binaire et la tester.
- **[Risque] Logs volumineux** → **Mitigation**: réutiliser la stratégie de troncature standard des plugins existants.
- **[Trade-off] Surface MVP limitée** → **Mitigation**: ajouter des actions supplémentaires dans un changement ultérieur guidé par usage réel.

## Migration Plan

1. Ajouter les nouveaux specs de capacité et la mise à jour `plugin-sdk-interface`.
2. Implémenter les deux plugins avec manifests et actions MVP.
3. Ajouter tests unitaires des validations d’entrée/sortie et du mapping d’erreur.
4. Inclure les plugins dans la liste d’inclusion image (`AUTOKESTRA_CORE_PLUGINS`) selon politique release.
5. Ajouter exemples de workflows et notes de troubleshooting.
6. Préparer un changement ultérieur pour une permission explicite `docker-host-access` si la politique sécurité l’exige.

Rollback: retirer les deux plugins de la liste de plugins core et supprimer les tâches workflow qui les consomment.

## Open Questions

- Aucun blocant pour ce change: les choix ci-dessus sont figés pour lancer l’implémentation.
