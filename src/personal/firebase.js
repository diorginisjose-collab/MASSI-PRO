// Carrega o Firebase só quando alguém abre o Personal Massi, direto do servidor oficial do Google.
// Assim o Massi Pro atual não fica mais pesado e o build não depende de nenhum pacote novo.
import { firebaseConfig } from "./firebaseConfig.js";

const VERSAO = "10.14.1";
const BASE = "https://www.gstatic.com/firebasejs/" + VERSAO + "/";
let promessa = null;

export function carregarFirebase() {
  if (!promessa) {
    promessa = (async () => {
      const [appM, authM, fsM] = await Promise.all([
        import(/* @vite-ignore */ BASE + "firebase-app.js"),
        import(/* @vite-ignore */ BASE + "firebase-auth.js"),
        import(/* @vite-ignore */ BASE + "firebase-firestore.js"),
      ]);
      const existente = appM.getApps().find((a) => a.name === "personal");
      const app = existente || appM.initializeApp(firebaseConfig, "personal");
      return { app, auth: authM.getAuth(app), db: fsM.getFirestore(app), A: authM, F: fsM };
    })().catch((e) => {
      promessa = null; // permite tentar de novo
      throw e;
    });
  }
  return promessa;
}
