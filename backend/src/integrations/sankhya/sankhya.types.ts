/**
 * ATENÇÃO — FORMATO PENDENTE DE CONFIRMAÇÃO
 * ------------------------------------------------------------------
 * Os tipos abaixo representam o formato conhecido/documentado do
 * DbExplorerSP.executeQuery e do endpoint de autenticação da Sankhya.
 * Onde o formato real ainda não foi confirmado com a documentação
 * oficial ou com uma resposta de exemplo, isso está marcado com
 * `// CONFIRMAR COM DOC OFICIAL`.
 *
 * Não usar estes tipos como fonte de verdade definitiva antes de validar
 * contra uma chamada real ou a documentação da Sankhya.
 */

export interface SankhyaAuthResponse {
  access_token: string;
  /** Segundos até expirar. CONFIRMAR COM DOC OFICIAL (pode ser `expires_in` ou outro nome). */
  expires_in?: number;
  token_type?: string;
  [key: string]: unknown;
}

export interface SankhyaAuthRequest {
  grant_type: 'client_credentials';
  client_id: string;
  client_secret: string;
}

/**
 * Payload de execução do DbExplorerSP.executeQuery.
 * CONFIRMAR COM DOC OFICIAL: nome exato dos campos (`sql` vs `query`),
 * se aceita parâmetros bind, se `outputType=json` já é suficiente via
 * querystring ou se precisa também ir no corpo.
 */
export interface SankhyaExecuteQueryRequest {
  serviceName: 'DbExplorerSP.executeQuery';
  requestBody: {
    sql: string;
  };
}

/**
 * Formato de retorno esperado do DbExplorer no modo outputType=json.
 * A Sankhya tipicamente retorna colunas (`fieldsMetadata`) separadas das
 * linhas (`rows`), com valores posicionais — CONFIRMAR COM DOC OFICIAL.
 */
export interface SankhyaExecuteQueryResponse {
  status: string; // "1" = sucesso, CONFIRMAR
  responseBody?: {
    fieldsMetadata?: Array<{ name: string }>;
    rows?: unknown[][];
  };
  statusMessage?: string;
  [key: string]: unknown;
}

export interface SankhyaErrorResponse {
  status: string;
  statusMessage: string;
  [key: string]: unknown;
}
