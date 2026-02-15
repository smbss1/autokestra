export const pluginManifestSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    name: {
      type: 'string',
      pattern: '^[a-z0-9-]+$',
      description: 'Plugin name in kebab-case',
    },
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+$',
      description: 'Semantic version',
    },
    namespace: {
      type: 'string',
      description: 'Plugin namespace',
    },
    description: {
      type: 'string',
    },
    author: {
      type: 'string',
    },
    license: {
      type: 'string',
    },
    runtime: {
      type: 'object',
      properties: {
        entrypoint: {
          type: 'string',
          minLength: 1,
          description: 'Relative plugin runtime entrypoint path',
        },
      },
      required: ['entrypoint'],
    },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            pattern: '^[a-z0-9-]+$',
          },
          description: {
            type: 'string',
          },
          input: {
            type: 'object',
          },
          output: {
            type: 'object',
          },
        },
        required: ['name', 'description', 'input', 'output'],
      },
    },
    capabilities: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
  },
  required: ['name', 'version', 'namespace', 'actions'],
} as const;
