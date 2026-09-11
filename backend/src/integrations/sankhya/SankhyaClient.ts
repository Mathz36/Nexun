import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { SankhyaAuthService } from './SankhyaAuthService';

export interface SankhyaClientConfig {
  authUrl: string;
  serviceUrl: string;
  xToken: string;
  clientId: string;
  clientSecret: string;
  grantType: string;
}

/**
 * Cliente de baixo nível responsável por: autenticação (via SankhyaAuthService),
 * headers (incluindo X-Token), timeout, e retry controlado em caso de 401.
 * Não conhece o significado de negócio do payload — isso é responsabilidade
 * do SankhyaDbExplorerService / adapter.
 */
export class SankhyaClient {
  private readonly http: AxiosInstance;
  private readonly auth: SankhyaAuthService;

  constructor(private readonly config: SankhyaClientConfig) {
    this.http = axios.create();
    this.auth = new SankhyaAuthService(this.http, {
      authUrl: config.authUrl,
      xToken: config.xToken,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      grantType: config.grantType,
    });
  }

  /** POST autenticado ao serviço configurado (DbExplorer ou outro serviço
   * MGE), com retry único em caso de 401 (token invalidado e renovado). */
  async post<T>(body: unknown, options?: { retried?: boolean }): Promise<T> {
    const token = await this.auth.getToken();

    const requestConfig: AxiosRequestConfig = {
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        // CONFIRMAR COM DOC OFICIAL: nome exato do header (`X-Token` vs
        // `AppKey` vs outro) exigido pelo ambiente Sankhya.
        'X-Token': this.config.xToken,
      },
    };

    try {
      const response = await this.http.post<T>(this.config.serviceUrl, body, requestConfig);
      return response.data;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.code === 'ECONNABORTED') {
          throw new AppError('SANKHYA_TIMEOUT', 504);
        }
        if (!err.response) {
          throw new AppError('SANKHYA_CONNECTION_ERROR', 502);
        }

        if (err.response.status === 401 && !options?.retried) {
          logger.warn('Token Sankhya rejeitado (401). Renovando e repetindo uma vez.', {
            service: 'SankhyaClient',
            operation: 'post',
            errorCode: 'SANKHYA_UNAUTHORIZED',
          });
          this.auth.invalidate();
          return this.post<T>(body, { retried: true });
        }

        if (err.response.status === 401) {
          throw new AppError('SANKHYA_UNAUTHORIZED', 502);
        }

        if (err.response.status === 429) {
          throw new AppError('SANKHYA_RATE_LIMIT', 429);
        }

        logger.error('Erro HTTP ao chamar serviço Sankhya', {
          service: 'SankhyaClient',
          operation: 'post',
          status: String(err.response.status),
          errorCode: 'SANKHYA_QUERY_ERROR',
        });
        throw new AppError('SANKHYA_QUERY_ERROR', 502, { httpStatus: err.response.status });
      }

      throw new AppError('SANKHYA_CONNECTION_ERROR', 502);
    }
  }

  /** Usado pela tela de Configurações > Sankhya para testar a conexão
   * sem executar nenhuma query de negócio. */
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.auth.getToken();
      return { ok: true, message: 'Sankhya conectada' };
    } catch (err) {
      const message = err instanceof AppError ? err.message : 'Falha na autenticação Sankhya';
      return { ok: false, message };
    }
  }
}
