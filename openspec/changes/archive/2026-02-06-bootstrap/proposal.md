## Why

Le projet a besoin d’un socle exécutable et cohérent pour itérer vite sur le moteur (CLI-first) tout en gardant sécurité, déterminisme et maintenabilité. Le "Bootstrap" fixe les fondations (structure, config, CLI) pour éviter de multiplier les décisions ad-hoc dès les premières features.

## What Changes

- Mise en place d’une structure de repo/modularisation (core engine, server API, CLI, plugin SDK) et de conventions de développement (scripts Bun, lint/test, CI de base).
- Ajout d’un système de configuration serveur en YAML avec surcharge par variables d’environnement et validation d’erreurs explicites.
- Mise en place d’un squelette CLI conforme à l’arbre de commandes cible (server/workflow/execution/plugin/config), avec help, sortie JSON optionnelle pour les commandes list/describe, et codes de sortie déterministes.

## Capabilities

### New Capabilities

- `repo-structure-tooling`: Structure de projet, scripts (build/test/lint), conventions et CI minimale pour un workflow de dev reproductible.
- `config-loading-overrides`: Chargement de configuration YAML, surcharge via variables d’environnement, validation et messages d’erreurs.
- `cli-command-skeleton`: CLI initiale (parsing, help, format JSON, exit codes) et stubs des commandes principales.

### Modified Capabilities

<!-- None (no existing specs in this repo yet) -->

## Impact

- Nouveau layout de packages/modules (impact direct sur l’arborescence du code et les imports).
- Ajout de dépendances (ex: parser YAML, framework CLI) et d’outillage (lint/test).
- Contrat CLI public : noms de commandes, options `--json`, et sémantique des codes de sortie (à stabiliser tôt).
- Prépare l’intégration future des autres domaines (registry, scheduler, runtime WASM, storage) sans casser le socle.
