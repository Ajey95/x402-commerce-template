const TOOL_MODEL_PREFERENCE = [
  'gpt-5.6',
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.3',
  'gpt-5.2',
  'gpt-5.1',
  'gpt-5',
  'gpt-4.1',
  'gpt-4o',
] as const;

export function selectAvailableModel(
  availableModels: Iterable<string | undefined>,
  requestedModel: string,
): { model: string; usedFallback: boolean } {
  const available = new Set([...availableModels].filter((value): value is string => Boolean(value)));
  if (available.has(requestedModel)) return { model: requestedModel, usedFallback: false };
  const fallback = TOOL_MODEL_PREFERENCE.find(model => available.has(model));
  if (!fallback) throw new Error('No supported OpenAI tool-calling model is available to this API project.');
  return { model: fallback, usedFallback: true };
}
