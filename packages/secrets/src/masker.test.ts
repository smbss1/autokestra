import { describe, it, expect } from 'bun:test';
import { SecretMasker, LogWrapper } from './masker.js';

describe('SecretMasker', () => {
  it('should mask secrets in strings', () => {
    const masker = new SecretMasker();
    masker.loadSecrets(['secret-api-key', 'another-secret']);

    const input = 'The API key is secret-api-key and another is another-secret';
    const output = masker.mask(input);
    expect(output).toBe('The API key is ***SECRET*** and another is ***SECRET***');
  });

  it('should mask secrets in objects', () => {
    const masker = new SecretMasker();
    masker.loadSecrets(['secret-value']);

    const input = {
      apiKey: 'secret-value',
      nested: {
        token: 'secret-value',
        normal: 'normal-value'
      },
      array: ['secret-value', 'normal']
    };

    const output = masker.maskObject(input);
    expect(output.apiKey).toBe('***SECRET***');
    expect(output.nested.token).toBe('***SECRET***');
    expect(output.nested.normal).toBe('normal-value');
    expect(output.array[0]).toBe('***SECRET***');
    expect(output.array[1]).toBe('normal');
  });

  it('should handle multiple occurrences', () => {
    const masker = new SecretMasker();
    masker.loadSecrets(['secret']);

    const input = 'secret secret secret';
    const output = masker.mask(input);
    expect(output).toBe('***SECRET*** ***SECRET*** ***SECRET***');
  });

  it('should use custom placeholder', () => {
    const masker = new SecretMasker('[MASKED]');
    masker.loadSecrets(['secret']);

    const input = 'value is secret';
    const output = masker.mask(input);
    expect(output).toBe('value is [MASKED]');
  });

  it('should handle special regex characters in secrets', () => {
    const masker = new SecretMasker();
    masker.loadSecrets(['secret.key(with)special*chars']);

    const input = 'The secret is secret.key(with)special*chars';
    const output = masker.mask(input);
    expect(output).toBe('The secret is ***SECRET***');
  });

  it('should not mask when no secrets loaded', () => {
    const masker = new SecretMasker();
    const input = 'This has secret in it';
    const output = masker.mask(input);
    expect(output).toBe('This has secret in it');
  });
});

describe('LogWrapper', () => {
  it('should mask console output', () => {
    const masker = new SecretMasker();
    masker.loadSecrets(['secret-password']);

    // Mock console.log to capture output BEFORE installing wrapper
    const originalLog = console.log;
    let capturedArgs: any[] = [];
    console.log = (...args: any[]) => {
      capturedArgs = args;
    };

    const wrapper = new LogWrapper(masker);
    wrapper.install();

    // Now console.log is wrapped, call it
    console.log('The password is secret-password');

    // Restore
    wrapper.uninstall();
    console.log = originalLog;

    expect(capturedArgs[0]).toBe('The password is ***SECRET***');
  });
});