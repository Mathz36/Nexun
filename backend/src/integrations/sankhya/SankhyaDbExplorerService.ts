import { SankhyaClient } from './SankhyaClient';
import { adaptSankhyaResponse, RawColumnarResult } from './SankhyaAdapter';
import { SankhyaExecuteQueryResponse } from './sankhya.types';

/**
 * Camada dedicada à execução de queries via DbExplorerSP.executeQuery.
 * Não sabe nada sobre "relatórios", "fornecedores" ou "cruzamento" —
 * apenas executa SQL e devolve dados em formato colunar genérico.
 */
export class SankhyaDbExplorerService {
  constructor(private readonly client: SankhyaClient) {}

  async executeQuery(query: string): Promise<RawColumnarResult> {
    // CONFIRMAR COM DOC OFICIAL: formato exato do envelope de requisição
    // (nome do campo com o SQL, se `outputType=json` já basta via querystring
    // do SANKHYA_SERVICE_URL, se `serviceName` precisa ir também no corpo).
    const body = {
      serviceName: 'DbExplorerSP.executeQuery',
      requestBody: {
        sql: query,
      },
    };

    const raw = await this.client.post<SankhyaExecuteQueryResponse>(body);
    return adaptSankhyaResponse(raw);
  }
}
