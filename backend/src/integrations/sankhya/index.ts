import { SankhyaClient } from './SankhyaClient';
import { SankhyaDbExplorerService } from './SankhyaDbExplorerService';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export function createSankhyaIntegration() {
  const client = new SankhyaClient({
    authUrl: requireEnv('SANKHYA_API_URL'),
    serviceUrl: requireEnv('SANKHYA_SERVICE_URL'),
    xToken: requireEnv('SANKHYA_X_TOKEN'),
    clientId: requireEnv('CLIENT_ID'),
    clientSecret: requireEnv('CLIENT_SECRET'),
    grantType: process.env.GRANT_TYPE ?? 'client_credentials',
  });

  const dbExplorer = new SankhyaDbExplorerService(client);

  return { client, dbExplorer };
}

export { SankhyaClient } from './SankhyaClient';
export { SankhyaDbExplorerService } from './SankhyaDbExplorerService';
export { SankhyaAuthService } from './SankhyaAuthService';
export * from './SankhyaAdapter';
