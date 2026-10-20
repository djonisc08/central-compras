/**
 * Cópia de segurança do banco: npm run backup
 * Gera data/backups/compras-AAAA-MM-DD-HHMM.db (cópia consistente, mesmo com o app aberto).
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { CAMINHO_DB } from "../src/db/client";

if (!fs.existsSync(CAMINHO_DB)) {
  console.error(`Banco não encontrado em ${CAMINHO_DB}`);
  process.exit(1);
}

const agora = new Date();
const carimbo = `${agora.toISOString().slice(0, 10)}-${String(agora.getHours()).padStart(2, "0")}${String(agora.getMinutes()).padStart(2, "0")}`;
const pasta = path.join(path.dirname(CAMINHO_DB), "backups");
fs.mkdirSync(pasta, { recursive: true });
const destino = path.join(pasta, `compras-${carimbo}.db`);

const db = new Database(CAMINHO_DB, { readonly: true });
db.backup(destino)
  .then(() => {
    db.close();
    const kb = Math.round(fs.statSync(destino).size / 1024);
    console.log(`Backup salvo: ${destino} (${kb} KB)`);
    // Mantém os 30 backups mais recentes.
    const antigos = fs
      .readdirSync(pasta)
      .filter((f) => f.startsWith("compras-") && f.endsWith(".db"))
      .sort()
      .reverse()
      .slice(30);
    for (const f of antigos) fs.rmSync(path.join(pasta, f));
  })
  .catch((e) => {
    console.error("Falha no backup:", e);
    process.exit(1);
  });
