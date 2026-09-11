type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  service?: string;
  operation?: string;
  reportId?: string;
  executionId?: string;
  duration?: number;
  status?: string;
  errorCode?: string;
  [key: string]: unknown;
}

/** Chaves que NUNCA podem aparecer em log, mesmo que alguém passe por engano. */
const FORBIDDEN_KEYS = [
  'clientSecret',
  'CLIENT_SECRET',
  'accessToken',
  'access_token',
  'xToken',
  'X_TOKEN',
  'X-Token',
  'password',
  'pass',
];

function sanitize(fields: LogFields): LogFields {
  const clone: LogFields = { ...fields };
  for (const key of Object.keys(clone)) {
    if (FORBIDDEN_KEYS.some((f) => f.toLowerCase() === key.toLowerCase())) {
      delete clone[key];
    }
  }
  return clone;
}

function log(level: LogLevel, message: string, fields: LogFields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitize(fields),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) => log('debug', message, fields),
  info: (message: string, fields?: LogFields) => log('info', message, fields),
  warn: (message: string, fields?: LogFields) => log('warn', message, fields),
  error: (message: string, fields?: LogFields) => log('error', message, fields),
};
