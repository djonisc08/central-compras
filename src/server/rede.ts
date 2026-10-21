// Endereços deste computador na rede local (Wi-Fi/cabo), para abrir o sistema pelo celular.
import os from "node:os";

export function enderecosNaRede(porta: number) {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address)
    // Rede de casa/escritório primeiro (192.168.x.x), depois as outras.
    .sort((a, b) => Number(!a.startsWith("192.168.")) - Number(!b.startsWith("192.168.")));
  return [...new Set(ips)].map((ip) => `http://${ip}:${porta}`);
}
