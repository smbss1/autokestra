## Why

Le projet a besoin d'un langage de définition de workflows (DSL) standardisé et validé pour permettre aux utilisateurs de définir des automatisations complexes de manière déclarative et sécurisée. Sans DSL et validation robuste, les workflows risquent d'être fragiles, non déterministes, et sujets à des erreurs de sécurité ou de logique. C'est le moment de l'implémenter car c'est la fondation de toutes les fonctionnalités de workflow du moteur.

## What Changes

- Définition d'un schéma YAML standardisé pour les workflows incluant tâches, dépendances, déclencheurs, et politiques de retry
- Implémentation d'une validation complète du DSL avec messages d'erreur détaillés et prévention des configurations dangereuses
- Support des plugins via un système de types déclarés (`namespace/plugin.action`)
- Injection sécurisée des secrets à l'exécution (pas de stockage dans le YAML)
- Validation des contraintes de sécurité (pas d'accès réseau arbitraire, pas d'exécution de code non-sandboxé)

## Capabilities

### New Capabilities
- `workflow-dsl-schema`: Définition du schéma YAML pour les workflows incluant validation syntaxique et sémantique
- `workflow-validation-engine`: Moteur de validation des workflows avec détection d'erreurs, cycles, et contraintes de sécurité
- `workflow-parsing-loading`: Chargement et parsing des fichiers workflow avec gestion d'erreurs et métadonnées

### Modified Capabilities
<!-- Aucune capability existante n'est modifiée pour ce changement -->

## Impact

- Nouvelles dépendances pour le parsing/validation YAML avancé
- Extension de l'API de chargement de configuration pour supporter les workflows
- Impact sur la CLI pour les commandes de gestion des workflows (`workflow apply`, `workflow validate`)
- Préparation pour les futures capacités d'exécution de workflows