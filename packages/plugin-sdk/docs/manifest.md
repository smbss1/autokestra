# Plugin Manifest Format

## plugin.yaml

```yaml
name: my-plugin
version: 1.0.0
namespace: my
description: My plugin
author: Me
license: MIT

capabilities:
  - network
  - filesystem

actions:
  - name: do-something
    description: Does something
    input:
      type: object
      properties:
        param:
          type: string
    output:
      type: object
      properties:
        result:
          type: string
```

## Fields

- `name`: kebab-case plugin name
- `version`: semver
- `namespace`: grouping namespace
- `actions`: list of actions with input/output schemas
- `capabilities`: optional list of required capabilities