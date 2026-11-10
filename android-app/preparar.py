# Prepara o projeto Android gerado pelo Capacitor: copia o plugin de passos, acrescenta a permissao
# e instala a chave de assinatura fixa. Roda dentro do GitHub Actions (nao precisa rodar no seu computador).
import os
import shutil
import sys

PASTA = "android/app/src/main/java/com/massipro/app"
MANIFEST = "android/app/src/main/AndroidManifest.xml"

if not os.path.isdir(PASTA):
    sys.exit("Pasta nao encontrada: " + PASTA + " (confira o appId em capacitor.config.json)")

shutil.copy("android-app/MassiPassosPlugin.java", PASTA)
shutil.copy("android-app/MainActivity.java", PASTA)

with open(MANIFEST, encoding="utf-8") as f:
    texto = f.read()
if "ACTIVITY_RECOGNITION" not in texto:
    novo = (
        '    <uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />\n'
        '    <uses-feature android:name="android.hardware.sensor.stepcounter" android:required="false" />\n'
        "    "
    )
    texto = texto.replace("<application", novo + "<application", 1)
    with open(MANIFEST, "w", encoding="utf-8") as f:
        f.write(texto)
with open(MANIFEST, encoding="utf-8") as f:
    if "ACTIVITY_RECOGNITION" not in f.read():
        sys.exit("Nao consegui acrescentar a permissao no AndroidManifest.xml")

casa = os.path.expanduser("~/.android")
os.makedirs(casa, exist_ok=True)
shutil.copy("android-app/debug.keystore", os.path.join(casa, "debug.keystore"))
print("Projeto Android preparado.")
