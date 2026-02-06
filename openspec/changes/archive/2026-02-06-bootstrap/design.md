## Context

Le projet démarre et a besoin d’un socle technique stable pour éviter des choix inconsistants dès les premières itérations. Le changement "bootstrap" couvre trois fondations : (1) structure + outillage, (2) configuration YAML + overrides env, (3) squelette CLI aligné sur la future surface publique.

Contraintes importantes : runtime Bun + TypeScript, CLI-first, pas de GUI en v1, sécurité/déterminisme comme principes, et un moteur modulaire (monolithe strictement modulaire).

## Goals / Non-Goals

**Goals:**

- Définir une structure de modules/packages claire (core engine / server / CLI / plugin SDK) sans sur-concevoir.
- Fournir un système de config unique (fichier YAML + overrides par variables d’environnement) avec validation et erreurs lisibles.
- Mettre en place une CLI ergonomique et scriptable : help, `--json` sur les commandes de listing/describe, et codes de sortie déterministes.
- Installer les garde-fous DX : scripts standard, lint/test, CI minimale, conventions.

**Non-Goals:**

- Implémenter les fonctionnalités du moteur (scheduler, runtime WASM, state store, etc.) au-delà de stubs/points d’extension.
- Stabiliser les contrats d’API HTTP (hors squelette minimal si nécessaire).
- Ajouter une UI.

## Decisions

- **Modularisation initiale (monorepo léger) plutôt que gros monorepo complexe**
  - Décision : commencer avec une arborescence simple (ex: `packages/engine`, `packages/server`, `packages/cli`, `packages/plugin-sdk`) ou équivalent, en gardant les frontières nettes.
  - Alternative : repo unique sans séparation → rejeté, car rend les dépendances croisées plus difficiles à maîtriser.
  - Alternative : monorepo “lourd” (outils avancés) → rejeté pour v0, risque de friction DX.

- **Configuration en YAML + surcharge env, avec typage et validation**
  - Décision : définir un schéma de config TypeScript avec unions discriminées (pour storage types) et utiliser Valibot pour la validation type-safe avec messages d'erreur détaillés; appliquer une stratégie d'override simple (préfixe env, mapping explicite) avec validation des valeurs d'environnement.
  - Alternative : configuration uniquement env → rejeté (moins ergonomique, moins portable).
  - Alternative : config libre sans validation → rejeté (erreurs tardives, non déterministe).

- **CLI structurée par sous-commandes, sortie humaine par défaut + `--json`**
  - Décision : implémenter une CLI qui sépare clairement commandes et output format; JSON stable destiné au scripting.
  - Alternative : CLI minimaliste sans JSON stable → rejeté (non scriptable).

- **Codes de sortie déterministes**
  - Décision : standardiser un mapping (ex: 0 OK, 1 erreur “unknown”, 2 usage, 3 config invalide, 4 not found, 5 conflict) et documenter.
  - Alternative : laisser les libs décider → rejeté (non déterministe).

- **Outillage et CI “minimum viable” dès le départ**
  - Décision : lint + tests unitaires + format, exécutés en CI sur PR.
  - Alternative : repousser → rejeté, car la dette devient vite coûteuse.

## Risks / Trade-offs

- **[Risk] Sur-conception de la structure de packages** → Mitigation : garder peu de packages au départ, extraire uniquement quand une frontière est claire.
- **[Risk] Spécification de config trop rigide** → Mitigation : prévoir des champs extensibles (ex: `plugins`, `features`) et versionner la config si nécessaire.
- **[Risk] Contrat CLI figé trop tôt** → Mitigation : marquer les commandes non stables en v0.x, documenter compat, tests de snapshot pour output JSON.
- **[Risk] Divergence entre config YAML et env overrides** → Mitigation : mapping explicite + tests (table-driven) de résolution.
