import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createPayingClient, explainPaymentError } from './lib.js';
import { selectAvailableModel } from './openai-model.js';
import { createDemoShieldRequest, requestShieldJobWithProof } from './shield-client.js';

interface OpenAIItem {
  type: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: Array<{ type: string; text?: string }>;
}

interface OpenAIResponse {
  id: string;
  output: OpenAIItem[];
  output_text?: string;
}

async function openai(path: string, apiKey: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.openai.com/v1${path}`, {
    ...init,
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const detail = body.error as { message?: string } | undefined;
    throw new Error(`OpenAI API returned HTTP ${response.status}: ${detail?.message ?? 'unknown error'}`);
  }
  return body;
}

async function resolveModel(apiKey: string, requestedModel: string) {
  const list = await openai('/models', apiKey);
  return selectAvailableModel(
    ((list.data as Array<{ id?: string }> | undefined) ?? []).map(item => item.id),
    requestedModel,
  );
}

function responseText(response: OpenAIResponse): string {
  if (response.output_text) return response.output_text;
  return response.output.flatMap(item => item.content ?? []).map(part => part.text ?? '').join('\n').trim();
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for the tool-calling client.');
  const requestedModel = process.env.OPENAI_MODEL?.trim() || 'gpt-5.6';
  const baseUrl = (process.env.API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const goal = process.argv.slice(2).join(' ') ||
    'Get Bangalore weather, look up Algorand Foundation, and score the sentiment of “Secure, scalable and fast.”';
  const selection = await resolveModel(apiKey, requestedModel);
  const model = selection.model;
  console.log(
    selection.usedFallback
      ? `OpenAI model ${requestedModel} is unavailable to this project; using ${model}.`
      : `OpenAI model confirmed: ${model}`,
  );

  const tools = [{
    type: 'function',
    name: 'requestShieldJob',
    description: 'Submit and pay one CPMM-SHIELD job that aggregates weather, company lookup, and sentiment resources into a signed receipt.',
    strict: true,
    parameters: {
      type: 'object',
      properties: { description: { type: 'string', description: 'The natural-language research goal to execute.' } },
      required: ['description'],
      additionalProperties: false,
    },
  }];
  const first = (await openai('/responses', apiKey, {
    method: 'POST',
    body: JSON.stringify({
      model,
      instructions: 'You are a commerce agent. Use requestShieldJob exactly once to satisfy the user, then summarize only the validated receipt.',
      input: goal,
      tools,
      tool_choice: 'auto',
    }),
  })) as unknown as OpenAIResponse;
  const call = first.output.find(item => item.type === 'function_call' && item.name === 'requestShieldJob');
  if (!call?.call_id) throw new Error('The model did not call requestShieldJob.');
  const args = JSON.parse(call.arguments ?? '{}') as { description?: string };
  console.log(`Agent tool call: ${args.description ?? goal}`);

  const payer = createPayingClient();
  const request = createDemoShieldRequest(baseUrl, `job_${randomUUID().replaceAll('-', '').slice(0, 16)}`);
  const proof = await requestShieldJobWithProof(baseUrl, request, {
    fetchWithPayment: payer.fetchWithPayment,
    readSettlement: response => payer.httpClient.getPaymentSettleResponse(name => response.headers.get(name)),
  });
  const final = (await openai('/responses', apiKey, {
    method: 'POST',
    body: JSON.stringify({
      model,
      previous_response_id: first.id,
      tools,
      input: [{
        type: 'function_call_output',
        call_id: call.call_id,
        output: JSON.stringify({ description: args.description, transaction: proof.transaction, receipt: proof.receipt }),
      }],
    }),
  })) as unknown as OpenAIResponse;
  console.log('\nAgent result');
  console.log(responseText(final) || JSON.stringify(proof.receipt, null, 2));
}

main().catch(error => {
  console.error(`\nShield agent failed: ${explainPaymentError(error)}`);
  process.exitCode = 1;
});
