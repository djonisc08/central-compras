import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

export const CAMINHO_DB =
  process.env.COMPRAS_DB ?? path.join(process.cwd(), "data", "compras.db");

const PASTA_MIGRATIONS = path.join(process.cwd(), "src", "db", "migrations");

function abrir(arquivo: string): DB {
  if (arquivo !== ":memory:") fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const sqlite = new Database(arquivo);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  // Mantém o banco sempre no schema mais recente, sem apagar dados.
  migrate(db, { migrationsFolder: PASTA_MIGRATIONS });
  return db;
}

// Reaproveita a conexão entre recarregamentos do servidor de desenvolvimento.
const globalParaDb = globalThis as unknown as { __comprasDb?: DB; __comprasMigracoes?: number };

function qtdMigracoes() {
  try {
    return fs.readdirSync(PASTA_MIGRATIONS).filter((f) => f.endsWith(".sql")).length;
  } catch {
    return 0;
  }
}

export function getDb(): DB {
  const qtd = qtdMigracoes();
  if (!globalParaDb.__comprasDb) {
    globalParaDb.__comprasDb = abrir(CAMINHO_DB);
  } else if (globalParaDb.__comprasMigracoes !== qtd) {
    // Chegou migration nova (ex.: git pull com o sistema aberto): aplica sem reiniciar.
    migrate(globalParaDb.__comprasDb, { migrationsFolder: PASTA_MIGRATIONS });
  }
  globalParaDb.__comprasMigracoes = qtd;
  return globalParaDb.__comprasDb;
}

/** Banco isolado (testes). */
export function abrirDb(arquivo: string): DB {
  return abrir(arquivo);
}
