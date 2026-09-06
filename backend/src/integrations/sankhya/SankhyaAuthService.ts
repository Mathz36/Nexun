import axios, { AxiosInstance } from 'axios';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { sankhyaAuthResponseSchema } from './sankhya.schemas';

interface SankhyaToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

/** Margem de segurança antes da expiração real do token, para nunca
 * usar um token expirado por causa de latência de rede. */
const EXPIRY_SAFETY_MARGIN_MS = 30_000;

/** Fallback quando a Sankhya não informa `expires_in`. CONFIRMAR COM DOC OFICIAL
 * qual é o TTL real do token nesse ambiente. */
const DEFAULT_TTL_SECONDS = 3600;

export class SankhyaAuthService {
  private cachedToken: SankhyaToken | null = null;
  private inflightAuth: Promise<string> | null = null;

  constructor(
    private readonly http: AxiosInstance,
    private readonly config: {
      authUrl: string;
      xToken: string;
      clientId: string;
      clientSecret: string;
      grantType: string;
    },
  ) {}

  private hasValidToken(): boolean {
    return !!this.cachedToken && Date.now() < this.cachedToken.expiresAt - EXPIRY_SAFETY_MARGIN_MS;
  }

  /** Retorna um token válido, autenticando (ou reutilizando o cache) conforme necessário. */
  async getToken(): Promise<string> {
    if (this.hasValidToken()) {
      return this.cachedToken!.accessToken;
    }

    // Evita múltiplas autenticações simultâneas quando várias queries
    // disparam ao mesmo tempo e o token expirou.
    if (this.inflightAuth) {
      return this.inflightAuth;
    }

    this.inflightAuth = this.authenticate().finally(() => {
      this.inflightAuth = null;
    });

    return this.inflightAuth;
  }

  /** Descarta o token em cache, forçando nova autenticação na próxima chamada.
   * Usado no fluxo de retry em respostas 401. */
  invalidate(): void {
    this.cachedToken = null;
  }

  private async authenticate(): Promise<string> {
    const startedAt = Date.now();
    try {
      // CONFIRMAR COM DOC OFICIAL: formato exato do corpo (form-urlencoded vs JSON)
      // e se o client_id/client_secret vão no corpo ou em Basic Auth.
      const body = new URLSearchParams({
        grant_type: this.config.grantType,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      });

      const response = await this.http.post(
        this.config.authUrl,
        body,
        {
          timeout: 15_000,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Token': this.config.xToken,
          },
        },
      );

      const parsed = sankhyaAuthResponseSchema.safeParse(response.data);
      if (!parsed.success) {
        logger.error('Resposta de autenticação Sankhya em formato inesperado', {
          service: 'SankhyaAuthService',
          operation: 'authenticate',
          errorCode: 'SANKHYA_INVALID_RESPONSE',
        });
        throw new AppError('SANKHYA_INVALID_RESPONSE', 502);
      }

      const ttlSeconds = parsed.data.expires_in ?? DEFAULT_TTL_SECONDS;
      this.cachedToken = {
        accessToken: parsed.data.access_token,
        expiresAt: Date.now() + ttlSeconds * 1000,
      };

      logger.info('Autenticação Sankhya realizada com sucesso', {
        service: 'SankhyaAuthService',
        operation: 'authenticate',
        duration: Date.now() - startedAt,
        status: 'SUCCESS',
      });

      return this.cachedToken.accessToken;
    } catch (err) {
      if (err instanceof AppError) throw err;

      if (axios.isAxiosError(err)) {
        if (err.code === 'ECONNABORTED') {
          throw new AppError('SANKHYA_TIMEOUT', 504);
        }
        if (!err.response) {
          throw new AppError('SANKHYA_CONNECTION_ERROR', 502);
        }
        if (err.response.status === 401 || err.response.status === 403) {
          logger.error('Sankhya rejeitou as credenciais de autenticação', {
            service: 'SankhyaAuthService',
            operation: 'authenticate',
            status: String(err.response.status),
            response: sanitizeAuthErrorResponse(err.response.data),
            errorCode: 'SANKHYA_AUTH_ERROR',
          });
          throw new AppError('SANKHYA_AUTH_ERROR', 502);
        }
        if (err.response.status === 429) {
          throw new AppError('SANKHYA_RATE_LIMIT', 429);
        }

        logger.error('Endpoint de autenticação Sankhya retornou erro HTTP', {
          service: 'SankhyaAuthService',
          operation: 'authenticate',
          status: String(err.response.status),
          response: sanitizeAuthErrorResponse(err.response.data),
          errorCode: 'SANKHYA_AUTH_ERROR',
        });
      }

      logger.error('Falha inesperada ao autenticar na Sankhya', {
        service: 'SankhyaAuthService',
        operation: 'authenticate',
        error: err instanceof Error ? err.message : String(err),
        errorCode: 'SANKHYA_AUTH_ERROR',
      });
      throw new AppError('SANKHYA_AUTH_ERROR', 502);
    }
  }
}

function sanitizeAuthErrorResponse(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.slice(0, 500);
  }

  if (value && typeof value === 'object') {
    const response = { ...(value as Record<string, unknown>) };
    for (const key of ['access_token', 'client_secret', 'clientSecret', 'x-token', 'X-Token']) {
      delete response[key];
    }
    return response;
  }

  return value;
}
