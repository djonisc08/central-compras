// Liga a Central de Compras em modo produção (rápido, sem avisos de desenvolvimento).
// Recompila sozinho só quando o programa mudou (git pull / npm install); os dados não são tocados.
//   node scripts/servir.mjs      (usado pelo "Central de Compras.vbs")
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const marca = path.join(raiz, ".next", "versao-central.txt");
const porta = process.env.PORT || "3000";

function versaoAtual() {
  let commit = "sem-git";
  try {
    commit = execSync("git rev-parse HEAD", { cwd: raiz }).toString().trim();
  } catch {}
  const lock = fs.existsSync(path.join(raiz, "package-lock.json")) ? fs.statSync(path.join(raiz, "package-lock.json")).mtimeMs : 0;
  return `${commit}|${lock}`;
}

const versao = versaoAtual();
const compilado = fs.existsSync(path.join(raiz, ".next", "BUILD_ID")) && fs.existsSync(marca) && fs.readFileSync(marca, "utf8") === versao;
const trava = path.join(raiz, ".next", "compilando.lock");
if (!compilado) {
  // Outro clique no ícone enquanto prepara: não começa uma segunda compilação.
  if (fs.existsSync(trava) && Date.now() - fs.statSync(trava).mtimeMs < 5 * 60_000) {
    console.log("Já estou preparando o sistema em outra janela. Aguarde.");
    process.exit(0);
  }
  fs.mkdirSync(path.dirname(trava), { recursive: true });
  fs.writeFileSync(trava, String(process.pid));
  console.log(`[${new Date().toLocaleString("pt-BR")}] Versão nova: preparando o sistema (1 a 2 minutos)...`);
  try {
    execSync("npx next build", { cwd: raiz, stdio: "inherit" });
    fs.writeFileSync(marca, versao);
  } finally {
    fs.rmSync(trava, { force: true });
  }
}
console.log(`[${new Date().toLocaleString("pt-BR")}] Central de Compras no ar na porta ${porta}`);
const srv = spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", porta], { cwd: raiz, stdio: "inherit", shell: true });
srv.on("exit", (c) => process.exit(c ?? 0));
