export type ErrorCode =
  | 'SANKHYA_AUTH_ERROR'
  | 'SANKHYA_UNAUTHORIZED'
  | 'SANKHYA_TIMEOUT'
  | 'SANKHYA_CONNECTION_ERROR'
  | 'SANKHYA_QUERY_ERROR'
  | 'SANKHYA_INVALID_RESPONSE'
  | 'SANKHYA_RATE_LIMIT'
  | 'REPORT_INVALID_SCHEMA'
  | 'REPORT_NOT_FOUND'
  | 'REPORT_EXECUTION_ERROR'
  | 'COMPARISON_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'STORAGE_ERROR'
  | 'INTERNAL_ERROR';

/** Mensagens amigáveis exibidas ao usuário. Detalhes técnicos completos
 * (stack, payloads, etc.) devem ir apenas para o logger, nunca na resposta. */
const FRIENDLY_MESSAGES: Record<ErrorCode, string> = {
  SANKHYA_AUTH_ERROR: 'Não foi possível autenticar na API Sankhya.',
  SANKHYA_UNAUTHORIZED: 'Sessão com a Sankhya expirada ou inválida.',
  SANKHYA_TIMEOUT: 'A API Sankhya não respondeu dentro do tempo esperado.',
  SANKHYA_CONNECTION_ERROR: 'Não foi possível conectar à API Sankhya.',
  SANKHYA_QUERY_ERROR: 'A Sankhya retornou um erro ao executar a query.',
  SANKHYA_INVALID_RESPONSE: 'A resposta da Sankhya veio em um formato inesperado.',
  SANKHYA_RATE_LIMIT: 'Limite de requisições à Sankhya atingido. Tente novamente em instantes.',
  REPORT_INVALID_SCHEMA: 'A query não respeita o contrato de colunas obrigatórias.',
  REPORT_NOT_FOUND: 'Relatório não encontrado.',
  REPORT_EXECUTION_ERROR: 'Não foi possível executar o relatório.',
  COMPARISON_ERROR: 'Não foi possível realizar o cruzamento dos relatórios.',
  VALIDATION_ERROR: 'Dados inválidos.',
  NOT_FOUND: 'Recurso não encontrado.',
  STORAGE_ERROR: 'Erro ao acessar o armazenamento de dados.',
  INTERNAL_ERROR: 'Erro interno inesperado.',
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: ErrorCode, statusCode = 400, details?: unknown, messageOverride?: string) {
    super(messageOverride ?? FRIENDLY_MESSAGES[code]);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'AppError';
  }

  toResponse() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}
