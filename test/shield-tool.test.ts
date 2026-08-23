import { describe, expect, it } from 'vitest';
import {
  createDefaultAgentGoal,
  createShieldTool,
  createShieldToolInstructions,
} from '../client/shield-tool.js';

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
    expect(serialized).toContain(
      '"algo":{"type":"string","maxLength":8,"enum":["sha256","sha512","sha1","md5"]}',
    );
    expect(serialized).not.toContain('external-algo-price');
  });

  it('builds a TestNet fallback goal for the intended external price provider flow', () => {
    expect(createDefaultAgentGoal('testnet')).toBe(
      'Get Bangalore weather, look up Algorand Foundation, and fetch the signed external ALGO/USD price from external-algo-price.',
    );
  });

  it('builds a MainNet fallback goal for the intended external hash provider flow', () => {
    expect(createDefaultAgentGoal('mainnet')).toBe(
      'Get Bangalore weather, look up Algorand Foundation, and hash CPMM-SHIELD with sha256 using external-hash.',
    );
  });
});
