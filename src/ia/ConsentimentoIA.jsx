import React, { useState } from "react";

// Consentimento específico para o envio de dados à IA. Começa desmarcado e só libera o botão após a marcação.
export default function ConsentimentoIA({ onAceitar, onCancelar }) {
  const [marcado, setMarcado] = useState(false);
  const caixa = { position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 3500, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
  const painel = { background: "#1B1F23", color: "#F2F4F6", borderRadius: 16, maxWidth: 440, width: "100%", maxHeight: "86vh", overflowY: "auto", padding: 18, fontFamily: "system-ui, sans-serif", boxSizing: "border-box" };
  return (
    <div style={caixa} role="dialog" aria-label="Uso de inteligência artificial">
      <div style={painel}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 10 }}>Antes de usar a IA</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.55, marginBottom: 12 }}>
          Os recursos de IA (Assistente, Foto inteligente e Rotina Inteligente) enviam ao servidor do Massi Pro os dados necessários para gerar a resposta, e o servidor os encaminha ao provedor de inteligência artificial.
        </div>
        <ul style={{ fontSize: 13.5, lineHeight: 1.55, paddingLeft: 18, margin: "0 0 12px" }}>
          <li>Finalidade: gerar a resposta solicitada por você.</li>
          <li>Podem ser enviados: sua pergunta, a imagem que você escolher, e, se você permitir, dados do seu perfil (como altura, peso, objetivos e restrições).</li>
          <li>Você pode desativar a personalização com seu perfil a qualquer momento.</li>
          <li>Para apagar os dados guardados no aparelho, use Apagar meus dados no menu. Dados já enviados ao provedor não são apagados por essa ação.</li>
        </ul>
        <div style={{ fontSize: 12.5, opacity: 0.85, marginBottom: 12 }}>
          As respostas são geradas por IA e não substituem profissional de saúde, nutrição ou educação física. Veja a Política de Privacidade para detalhes.
        </div>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.45, marginBottom: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} />
          <span>Concordo que os dados necessários a estas respostas sejam enviados ao servidor e ao provedor de IA do Massi Pro.</span>
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onCancelar} style={{ flex: 1, border: "1px solid rgba(128,128,128,0.4)", borderRadius: 10, padding: 11, background: "transparent", color: "inherit", cursor: "pointer" }}>Agora não</button>
          <button type="button" onClick={onAceitar} disabled={!marcado} data-testid="aceitar-consentimento-ia" style={{ flex: 1, border: "none", borderRadius: 10, padding: 11, background: marcado ? "#A7FF00" : "rgba(128,128,128,0.3)", color: marcado ? "#15181B" : "rgba(255,255,255,0.5)", fontWeight: 800, cursor: marcado ? "pointer" : "not-allowed" }}>Continuar</button>
        </div>
      </div>
    </div>
  );
}
