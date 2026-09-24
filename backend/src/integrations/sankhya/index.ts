import { SankhyaClient } from './SankhyaClient';
import { SankhyaDbExplorerService } from './SankhyaDbExplorerService';

function getEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return '';
}

function requireEnv(primary: string, aliases: string[] = []): string {
  return getEnv(primary, ...aliases);
}

export function createSankhyaIntegration() {
  const client = new SankhyaClient({
    authUrl: requireEnv('SANKHYA_API_URL', ['SANKHYA_AUTH_URL', 'AUTH_URL']),
    serviceUrl: requireEnv('SANKHYA_SERVICE_URL', ['SANKHYA_QUERY_URL', 'SERVICE_URL']),
    xToken: requireEnv('SANKHYA_X_TOKEN', ['X_TOKEN', 'X-TOKEN', 'SANKHYA_XTOKEN']),
    clientId: requireEnv('CLIENT_ID', ['SANKHYA_CLIENT_ID']),
    clientSecret: requireEnv('CLIENT_SECRET', ['SANKHYA_CLIENT_SECRET']),
    grantType: getEnv('GRANT_TYPE', 'SANKHYA_GRANT_TYPE') || 'client_credentials',
  });

  const dbExplorer = new SankhyaDbExplorerService(client);

  return { client, dbExplorer };
}

export { SankhyaClient } from './SankhyaClient';
export { SankhyaDbExplorerService } from './SankhyaDbExplorerService';
export { SankhyaAuthService } from './SankhyaAuthService';
export * from './SankhyaAdapter';
