import { SecretStore } from './store.js';

export class SecretResolver {
  private store: SecretStore;
  private resolvedSecrets: Map<string, string> = new Map();

  constructor(store: SecretStore) {
    this.store = store;
  }

  /**
   * Resolve secret templates in the given inputs object
   * Templates like {{ secrets.API_KEY }} are replaced with actual values
   */
  async resolve(inputs: any, allowedSecrets?: string[]): Promise<any> {
    if (typeof inputs === 'string') {
      return await this.resolveString(inputs, allowedSecrets);
    }

    if (Array.isArray(inputs)) {
      return await Promise.all(inputs.map(item => this.resolve(item, allowedSecrets)));
    }

    if (inputs && typeof inputs === 'object') {
      const resolved: any = {};
      const entries = Object.entries(inputs);
      await Promise.all(entries.map(async ([key, value]) => {
        resolved[key] = await this.resolve(value, allowedSecrets);
      }));
      return resolved;
    }

    return inputs;
  }

  private async resolveString(str: string, allowedSecrets?: string[]): Promise<string> {
    // Simple regex to match {{ secrets.NAME }}
    const secretRegex = /\{\{\s*secrets\.([A-Z_][A-Z0-9_]*)\s*\}\}/g;

    const replacements: Array<{ match: string; replacement: string }> = [];

    // Find all matches first
    let match;
    while ((match = secretRegex.exec(str)) !== null) {
      const secretName = match[1];

      // Check if secret is in allowed list
      if (allowedSecrets && !allowedSecrets.includes(secretName)) {
        throw new Error(`Secret '${secretName}' is not declared in workflow secrets`);
      }

      // Get from cache or store
      if (!this.resolvedSecrets.has(secretName)) {
        const value = await this.store.get(secretName);
        if (value === null) {
          if (process.env[`${secretName}`]) {
            // Fallback to environment variable
            this.resolvedSecrets.set(secretName, process.env[secretName]!);
          } else {
            throw new Error(`Secret '${secretName}' not found`);
          }
        } else {
          this.resolvedSecrets.set(secretName, value);
        }
      }

      replacements.push({
        match: match[0],
        replacement: this.resolvedSecrets.get(secretName)!
      });
    }

    // Apply replacements
    let result = str;
    for (const { match, replacement } of replacements) {
      result = result.replace(match, replacement);
    }

    return result;
  }

  /**
   * Get all resolved secret values (for masking)
   */
  getResolvedSecrets(): string[] {
    return Array.from(this.resolvedSecrets.values());
  }

  /**
   * Clear resolved secrets cache
   */
  clearCache(): void {
    this.resolvedSecrets.clear();
  }
}