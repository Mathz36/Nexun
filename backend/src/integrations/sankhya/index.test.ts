import { afterEach, describe, expect, it } from 'vitest';
import { createSankhyaIntegration } from './index';

describe('createSankhyaIntegration', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('aceita aliases de variáveis usados por plataformas de deploy', () => {
    process.env.SANKHYA_API_URL = 'https://api.example.com/authenticate';
    process.env.SANKHYA_SERVICE_URL = 'https://api.example.com/service';
    delete process.env.SANKHYA_X_TOKEN;
    process.env.X_TOKEN = 'token-easypanel';
    delete process.env.CLIENT_ID;
    process.env.SANKHYA_CLIENT_ID = 'client-id';
    delete process.env.CLIENT_SECRET;
    process.env.SANKHYA_CLIENT_SECRET = 'client-secret';

    const { client } = createSankhyaIntegration();

    expect((client as any).config.xToken).toBe('token-easypanel');
    expect((client as any).config.clientId).toBe('client-id');
    expect((client as any).config.clientSecret).toBe('client-secret');
  });
});
