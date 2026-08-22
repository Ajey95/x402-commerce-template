import { describe, expect, it } from 'vitest';
import { selectAvailableModel } from '../client/openai-model.js';

describe('OpenAI model selection', () => {
  it('keeps the configured model when the API project exposes it', () => {
    expect(selectAvailableModel(['gpt-5.6', 'gpt-5.4'], 'gpt-5.6')).toEqual({
      model: 'gpt-5.6',
      usedFallback: false,
    });
  });

  it('falls back to the best available tool-capable model', () => {
    expect(selectAvailableModel(['gpt-4.1', 'gpt-5.2', 'gpt-5.4'], 'gpt-5.6')).toEqual({
      model: 'gpt-5.4',
      usedFallback: true,
    });
  });

  it('rejects a project with no supported tool-calling model', () => {
    expect(() => selectAvailableModel(['text-embedding-3-small'], 'gpt-5.6')).toThrow(
      'No supported OpenAI tool-calling model',
    );
  });
});
