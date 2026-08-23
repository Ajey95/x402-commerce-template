import { describe, expect, it } from 'vitest';
import { createShieldTool, createShieldToolInstructions } from '../client/shield-tool.js';

describe('network-aware OpenAI shield tool', () => {
  it('exposes the TestNet price-feed contract without the MainNet provider', () => {
    const serialized = JSON.stringify({
      tool: createShieldTool('testnet'),
      instructions: createShieldToolInstructions('testnet'),
    });

    expect(serialized).toContain('external-algo-price');
    expect(serialized).toContain('exact empty object');
    expect(serialized).not.toContain('external-hash');
  });

  it('exposes the MainNet hash contract without the TestNet provider', () => {
    const serialized = JSON.stringify({
      tool: createShieldTool('mainnet'),
      instructions: createShieldToolInstructions('mainnet'),
    });

    expect(serialized).toContain('external-hash');
    expect(serialized).toContain('sha256');
    expect(serialized).toContain('"algo":{"type":"string","maxLength":8}');
    expect(serialized).not.toContain('external-algo-price');
  });
});
