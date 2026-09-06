import fs from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

/**
 * Repositório genérico persistido em um único arquivo JSON.
 *
 * Decisão de arquitetura (a pedido do projeto): NÃO usar banco de dados
 * relacional. Cada entidade vive em um arquivo `.json` próprio, e a CADA
 * escrita o arquivo inteiro é sobrescrito (nunca um patch parcial em disco).
 *
 * Para evitar corromper o arquivo caso o processo caia no meio da escrita,
 * o conteúdo é gravado primeiro em um arquivo temporário e só então
 * renomeado por cima do arquivo final (rename é atômico no mesmo filesystem).
 *
 * Esta classe é a ÚNICA parte do sistema que sabe que o storage é JSON.
 * Services/Controllers dependem apenas da interface pública abaixo, então
 * trocar por Prisma/Postgres no futuro não exige tocar em regra de negócio.
 */
export class JsonRepository<T extends { id: string }> {
  private readonly filePath: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(fileName: string, dataDir: string) {
    this.filePath = path.join(dataDir, fileName);
  }

  private async ensureFile(): Promise<void> {
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await this.writeAll([]);
    }
  }

  private async readAll(): Promise<T[]> {
    await this.ensureFile();
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      if (!raw.trim()) return [];
      return JSON.parse(raw) as T[];
    } catch (err) {
      logger.error('Falha ao ler arquivo JSON de armazenamento', {
        service: 'JsonRepository',
        operation: 'readAll',
        errorCode: 'STORAGE_ERROR',
      });
      throw new AppError('STORAGE_ERROR', 500, { file: this.filePath });
    }
  }

  /** Sobrescreve o arquivo inteiro com a lista fornecida. Atômico via tmp+rename. */
  private async writeAll(records: T[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    const payload = JSON.stringify(records, null, 2);
    await fs.writeFile(tmpPath, payload, 'utf-8');
    await fs.rename(tmpPath, this.filePath);
  }

  /** Serializa escritas concorrentes para evitar leituras-modificações-escritas
   * (read-modify-write) intercaladas sobrescreverem umas às outras. */
  private enqueue<R>(op: () => Promise<R>): Promise<R> {
    const result = this.writeQueue.then(op);
    this.writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async findAll(): Promise<T[]> {
    return this.readAll();
  }

  async findById(id: string): Promise<T | null> {
    const all = await this.readAll();
    return all.find((r) => r.id === id) ?? null;
  }

  async findBy(predicate: (item: T) => boolean): Promise<T[]> {
    const all = await this.readAll();
    return all.filter(predicate);
  }

  async insert(record: T): Promise<T> {
    return this.enqueue(async () => {
      const all = await this.readAll();
      all.push(record);
      await this.writeAll(all);
      return record;
    });
  }

  async insertMany(records: T[]): Promise<T[]> {
    return this.enqueue(async () => {
      const all = await this.readAll();
      const merged = all.concat(records);
      await this.writeAll(merged);
      return records;
    });
  }

  async update(id: string, patch: Partial<T>): Promise<T | null> {
    return this.enqueue(async () => {
      const all = await this.readAll();
      const idx = all.findIndex((r) => r.id === id);
      if (idx === -1) return null;
      const updated = { ...all[idx], ...patch } as T;
      all[idx] = updated;
      await this.writeAll(all);
      return updated;
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const all = await this.readAll();
      const filtered = all.filter((r) => r.id !== id);
      if (filtered.length === all.length) return false;
      await this.writeAll(filtered);
      return true;
    });
  }

  /** Substitui completamente a coleção (usado, por ex., por replaceByExecution). */
  async replaceAll(records: T[]): Promise<void> {
    return this.enqueue(() => this.writeAll(records));
  }
}
