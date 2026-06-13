import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: parseInt(optional('PORT', '4000'), 10),
  // Only required when the agent route is called; checked lazily there.
  anthropicApiKey: process.env['ANTHROPIC_API_KEY'] ?? '',
} as const;
