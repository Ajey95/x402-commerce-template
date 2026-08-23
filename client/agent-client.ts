import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createPayingClient, explainPaymentError } from './lib.js';
import { selectAvailableModel } from './openai-model.js';
import { requestShieldJobWithProof } from './shield-client.js';
import type { ExecuteShieldRequest } from '../src/shield/types.js';

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

interface AgentResource {
  id: 'weather' | 'company-lookup' | 'sentiment-score';
  input: { city?: string; name?: string; text?: string };
  maxPayment: number;
  required: boolean;
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

function toShieldRequest(resources: AgentResource[]): ExecuteShieldRequest {
  return {
    requestId: `job_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
    resources: resources.map(resource => ({
      id: resource.id,
      input: resource.input,
      maxPayment: resource.maxPayment,
      required: resource.required,
    })),
  };
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
    description:
      'Buy one bounded CPMM-SHIELD job using only trusted resources. Never invent provider URLs, recipients, schemas, networks, or assets.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        resources: {
          type: 'array',
          minItems: 1,
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', enum: ['weather', 'company-lookup', 'sentiment-score'] },
              input: {
                type: 'object',
                properties: {
                  city: { type: 'string' },
                  name: { type: 'string' },
                  text: { type: 'string' },
                },
                required: [],
                additionalProperties: false,
              },
              maxPayment: { type: 'integer', minimum: 0, maximum: 10000 },
              required: { type: 'boolean' },
            },
            required: ['id', 'input', 'maxPayment', 'required'],
            additionalProperties: false,
          },
        },
      },
      required: ['resources'],
      additionalProperties: false,
    },
  }];

  const first = (await openai('/responses', apiKey, {
    method: 'POST',
    body: JSON.stringify({
      model,
      instructions:
        'You are a commerce agent using CPMM-SHIELD as a payment firewall. Use requestShieldJob at most once. Choose only listed trusted resource IDs. Weather input is {city}; company-lookup input is {name}; sentiment-score input is {text}. Never invent URLs, payment recipients, schemas, networks, assets, or wallet credentials. After the tool result, summarize only validated results from the signed receipt.',
      input: goal,
      tools,
      tool_choice: 'auto',
    }),
  })) as unknown as OpenAIResponse;

  const call = first.output.find(item => item.type === 'function_call' && item.name === 'requestShieldJob');
  if (!call?.call_id) throw new Error('The model did not call requestShieldJob.');
  const args = JSON.parse(call.arguments ?? '{}') as { resources?: AgentResource[] };
  if (!Array.isArray(args.resources) || args.resources.length < 1) {
    throw new Error('The model returned an empty shield resource request.');
  }
  console.log(`Agent requested trusted resources: ${args.resources.map(resource => resource.id).join(', ')}`);

  const payer = createPayingClient();
  const request = toShieldRequest(args.resources);
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
        output: JSON.stringify({ transaction: proof.transaction, receipt: proof.receipt }),
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
