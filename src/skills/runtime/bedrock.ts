import { BedrockRuntimeClient, ConverseCommand, type Tool } from '@aws-sdk/client-bedrock-runtime';

export interface CallBedrockConverseOpts {
  system?: string;
  userMessage: string;
  modelId?: string;
  tools?: Tool[];
  toolChoice?: any;
}

let _client: BedrockRuntimeClient | null = null;

export function getBedrockClient(): BedrockRuntimeClient {
  if (!_client) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'us-east-1';

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        'AWS Credentials manquantes. Veuillez configurer AWS_ACCESS_KEY_ID et AWS_SECRET_ACCESS_KEY dans votre fichier .env'
      );
    }

    _client = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return _client;
}

export async function callBedrockConverse({
  system = "You are a creative and strategic expert. Answer strictly according to instructions.",
  userMessage,
  modelId = 'us.anthropic.claude-sonnet-4-6',
  tools,
  toolChoice,
}: CallBedrockConverseOpts): Promise<any> {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';
  const region = process.env.AWS_REGION || 'us-east-1';

  // Check if using the new Amazon Bedrock Service Key (ABSK) Bearer Token format
  if (accessKeyId.startsWith('BedrockAPIKey-')) {
    // Reconstruct the original ABSK bearer token
    const rawKeyString = `${accessKeyId}:${secretAccessKey}`;
    const base64Key = Buffer.from(rawKeyString).toString('base64');
    const abskToken = `ABSK${base64Key}`;

    const url = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/converse`;

    const body = {
      messages: [
        {
          role: 'user',
          content: [{ text: userMessage }],
        },
      ],
      system: [
        {
          text: system,
        },
      ],
      ...(tools ? { toolConfig: { tools, ...(toolChoice ? { toolChoice } : {}) } } : {}),
      inferenceConfig: {
        maxTokens: modelId.includes('sonnet') || modelId.includes('3-7') ? 8192 : 4096,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${abskToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      let parsedErr: any = null;
      try {
        parsedErr = JSON.parse(errText);
      } catch { /* ignore */ }
      const errMsg = parsedErr?.message || parsedErr?.Message || errText;
      throw new Error(`AWS Bedrock REST API Error (HTTP ${res.status}): ${errMsg}`);
    }

    const responseData = await res.json();
    return responseData;
  }

  // Otherwise, use standard SigV4 AWS client signing
  const client = getBedrockClient();

  const command = new ConverseCommand({
    modelId,
    messages: [
      {
        role: 'user',
        content: [{ text: userMessage }],
      },
    ],
    system: [
      {
        text: system,
      },
    ],
    ...(tools ? { toolConfig: { tools, ...(toolChoice ? { toolChoice } : {}) } } : {}),
    inferenceConfig: {
      maxTokens: modelId.includes('sonnet') || modelId.includes('3-7') ? 8192 : 4096,
    },
  });

  const response = await client.send(command);
  return response;
}

