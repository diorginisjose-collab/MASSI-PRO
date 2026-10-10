// Diário alimentar: guarda as refeições salvas (só no aparelho, no mesmo storage do app).
import { IA_CONFIG } from "./config.js";

export function dataLocal(d) {
  const x = d || new Date();
  const m = x.getMonth() + 1, dia = x.getDate();
  return x.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (dia < 10 ? "0" : "") + dia;
}
export function somarItens(itens) {
  const t = { calorias: 0, proteinas_g: 0, carboidratos_g: 0, gorduras_g: 0 };
  (itens || []).forEach((i) => {
    t.calorias += Number(i.calorias) || 0;
    t.proteinas_g += Number(i.proteinas_g) || 0;
    t.carboidratos_g += Number(i.carboidratos_g) || 0;
    t.gorduras_g += Number(i.gorduras_g) || 0;
  });
  return { calorias: Math.round(t.calorias), proteinas_g: Math.round(t.proteinas_g * 10) / 10, carboidratos_g: Math.round(t.carboidratos_g * 10) / 10, gorduras_g: Math.round(t.gorduras_g * 10) / 10 };
}
export async function carregarDiario() {
  try {
    const r = await window.storage.get(IA_CONFIG.chaveDiario);
    const lista = r && r.value ? JSON.parse(r.value) : [];
    return Array.isArray(lista) ? lista : [];
  } catch (e) {
    return [];
  }
}
async function gravar(lista) {
  try { await window.storage.set(IA_CONFIG.chaveDiario, JSON.stringify(lista)); return true; } catch (e) { return false; }
}
export async function adicionarEntrada(entrada) {
  const lista = await carregarDiario();
  const nova = { id: "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), data: dataLocal(), hora: new Date().toTimeString().slice(0, 5), ...entrada };
  nova.total = somarItens(nova.itens);
  const novaLista = [...lista, nova].slice(-IA_CONFIG.maxEntradasDiario);
  const ok = await gravar(novaLista);
  return ok ? nova : null;
}
export async function removerEntrada(id) {
  const lista = await carregarDiario();
  const novaLista = lista.filter((e) => e.id !== id);
  await gravar(novaLista);
  return novaLista;
}
export function totalDoDia(lista, data) {
  return somarItens([].concat(...lista.filter((e) => e.data === data).map((e) => e.itens || [])));
}
