import 'dotenv/config';
import { createApp } from './app';
import { logger } from './utils/logger';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3026;

try {
  const app = createApp();
  app.listen(PORT, () => {
    logger.info(`Servidor iniciado na porta ${PORT}`, {
      service: 'server',
      operation: 'listen',
      status: 'SUCCESS',
    });
  });
} catch (err) {
  logger.error('Falha ao iniciar o servidor', {
    service: 'server',
    operation: 'listen',
    errorCode: 'INTERNAL_ERROR',
  });
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
}
