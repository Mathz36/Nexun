import { SankhyaClient } from './SankhyaClient';
import { SankhyaDbExplorerService } from './SankhyaDbExplorerService';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    // A app pode subir sem credenciais Sankhya; a integração só passa a funcionar
    // quando o ambiente real for preenchido no EasyPanel ou .env do host.
    return '';
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
