import React, { useState } from "react";

// Identifica um aparelho de academia pela foto e leva ao YouTube para ver a execução.
// onAnalisar(imagem) recebe { base64, mediaType } e devolve o resultado; quem cobra o crédito é o App.
export default function IdentificarAparelho({ onFechar, onAnalisar, tr = (x) => x }) {
  const [imagem, setImagem] = useState(null);
  const [preview, setPreview] = useState("");
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const reduzir = (arquivo) => new Promise((ok, falha) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const max = 1024;
      const f = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL("image/jpeg", 0.85);
      URL.revokeObjectURL(url);
      ok({ base64: data.split(",")[1], mediaType: "image/jpeg", preview: data });
    };
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error("imagem_invalida")); };
    img.src = url;
  });

  const escolher = async (ev) => {
    const arq = ev.target.files && ev.target.files[0];
    if (!arq) return;
    setErro(""); setResultado(null);
    try {
      const r = await reduzir(arq);
      setImagem({ base64: r.base64, mediaType: r.mediaType });
      setPreview(r.preview);
    } catch (e) { setErro(tr("Não foi possível abrir essa imagem. Tente outra foto.")); }
  };

  const analisar = async () => {
    if (!imagem || ocupado) return;
    setOcupado(true); setErro("");
    try {
      const r = await onAnalisar(imagem);
      if (r) setResultado(r);
    } catch (e) {
      setErro((e && e.message) || tr("Não foi possível identificar agora. Tente de novo."));
    } finally { setOcupado(false); }
  };

  const youtube = () => {
    const termo = encodeURIComponent("como fazer " + (resultado && resultado.nome ? resultado.nome : "") + " execução correta");
    window.open("https://www.youtube.com/results?search_query=" + termo, "_blank", "noopener,noreferrer");
  };

  const caixa = { position: "fixed", top: 0, right: 0, bottom: 0, left: 0, zIndex: 3000, background: "#101214", color: "#F2F4F6", overflowY: "auto", padding: 18, fontFamily: "system-ui, sans-serif", boxSizing: "border-box" };
  const botao = { width: "100%", border: "none", borderRadius: 12, padding: 12, fontWeight: 800, cursor: "pointer", marginBottom: 10 };

  return (
    <div style={caixa} role="dialog" aria-label="Identificar aparelho">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>🏋️ {tr("Identificar aparelho")}</div>
        <button type="button" onClick={onFechar} style={{ border: "none", background: "transparent", color: "inherit", fontSize: 22, cursor: "pointer" }} aria-label="Fechar">×</button>
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5, marginBottom: 12, opacity: 0.9 }}>
        {tr("Tire uma foto do aparelho. A IA identifica o nome e o grupo muscular, e você pode ver a execução no YouTube. Sugestão educativa: confirme a técnica com um profissional de educação física.")}
      </div>
      <label style={{ ...botao, display: "block", textAlign: "center", background: "rgba(128,128,128,0.2)" }}>
        📷 {tr("Escolher ou tirar foto")}
        <input type="file" accept="image/*" capture="environment" onChange={escolher} style={{ display: "none" }} data-testid="escolher-aparelho" />
      </label>
      {preview && <img src={preview} alt={tr("Aparelho escolhido")} style={{ width: "100%", borderRadius: 12, marginBottom: 10 }} />}
      {imagem && !resultado && (
        <button type="button" onClick={analisar} disabled={ocupado} data-testid="identificar-aparelho" style={{ ...botao, background: "#A7FF00", color: "#15181B" }}>
          {ocupado ? tr("Identificando...") : tr("Identificar aparelho")}
        </button>
      )}
      {erro && <div role="alert" style={{ color: "#FFB1A8", fontSize: 13, marginBottom: 10 }}>{erro}</div>}
      {resultado && (
        <div style={{ background: "rgba(128,128,128,0.15)", borderRadius: 12, padding: 12, marginBottom: 10 }} data-testid="resultado-aparelho">
          {resultado.identificado ? (
            <>
              <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>{resultado.nome}</div>
              {resultado.grupo_muscular && <div style={{ fontSize: 13.5, marginBottom: 6 }}>{tr("Trabalha:")} {resultado.grupo_muscular}</div>}
              {resultado.observacao && <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>{resultado.observacao}</div>}
              <button type="button" onClick={youtube} data-testid="ver-execucao-youtube" style={{ ...botao, background: "#FF0033", color: "#fff" }}>▶ {tr("Ver execução no YouTube")}</button>
            </>
          ) : (
            <div style={{ fontSize: 13.5 }}>{tr("Não consegui identificar um aparelho nessa foto. ")}{resultado.observacao || tr("Tente uma foto mais de perto, com o aparelho bem visível.")}</div>
          )}
        </div>
      )}
    </div>
  );
}
