export class SecretMasker {
  private secretValues: string[] = [];
  private maskRegex?: RegExp;
  private readonly maskPlaceholder: string;

  constructor(maskPlaceholder: string = '***SECRET***') {
    this.maskPlaceholder = maskPlaceholder;
  }

  /**
   * Load secret values to mask (call at execution start)
   */
  loadSecrets(secrets: string[]): void {
    this.secretValues = secrets;
    this.compileRegex();
  }

  /**
   * Clear secret values (call at execution end)
   */
  clearSecrets(): void {
    this.secretValues = [];
    this.maskRegex = undefined;
  }

  /**
   * Mask secrets in a string
   */
  mask(text: string): string {
    if (!this.maskRegex || this.secretValues.length === 0) {
      return text;
    }
    return text.replace(this.maskRegex, this.maskPlaceholder);
  }

  /**
   * Mask secrets in an object recursively
   */
  maskObject(obj: any): any {
    if (typeof obj === 'string') {
      return this.mask(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.maskObject(item));
    }

    if (obj && typeof obj === 'object') {
      const masked: any = {};
      for (const [key, value] of Object.entries(obj)) {
        masked[key] = this.maskObject(value);
      }
      return masked;
    }

    return obj;
  }

  /**
   * Compile regex for efficient masking
   */
  private compileRegex(): void {
    if (this.secretValues.length === 0) {
      this.maskRegex = undefined;
      return;
    }

    // Escape special regex characters and join with |
    const escapedSecrets = this.secretValues.map(secret =>
      secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );

    // Create regex that matches any of the secret values
    this.maskRegex = new RegExp(escapedSecrets.join('|'), 'g');
  }
}

export class LogWrapper {
  private masker: SecretMasker;
  private originalConsoleLog: typeof console.log;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;

  constructor(masker: SecretMasker) {
    this.masker = masker;
    this.originalConsoleLog = console.log;
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
  }

  /**
   * Install the log wrapper (intercept console methods)
   */
  install(): void {
    console.log = (...args) => {
      const maskedArgs = args.map(arg => {
        if (typeof arg === 'string') {
          return this.masker.mask(arg);
        } else {
          // For non-string args, convert to string and mask
          const str = String(arg);
          return this.masker.mask(str);
        }
      });
      this.originalConsoleLog(...maskedArgs);
    };

    console.error = (...args) => {
      const maskedArgs = args.map(arg => {
        if (typeof arg === 'string') {
          return this.masker.mask(arg);
        } else {
          const str = String(arg);
          return this.masker.mask(str);
        }
      });
      this.originalConsoleError(...maskedArgs);
    };

    console.warn = (...args) => {
      const maskedArgs = args.map(arg => {
        if (typeof arg === 'string') {
          return this.masker.mask(arg);
        } else {
          const str = String(arg);
          return this.masker.mask(str);
        }
      });
      this.originalConsoleWarn(...maskedArgs);
    };
  }

  /**
   * Uninstall the log wrapper (restore original console methods)
   */
  uninstall(): void {
    console.log = this.originalConsoleLog;
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
  }
}