// Gera os ícones do aplicativo (tela inicial do celular) a partir do logotipo oficial, sem alterar a marca:
// fundo branco quadrado com o logotipo centralizado (área segura de 80% para ícones "maskable").
// Uso: node scripts/gerar-icones-app.cjs
const sharp = require("sharp");
const SRC = "public/brand/audita-logo.png";
(async () => {
  const trimmed = await sharp(SRC).trim({ threshold: 20 }).toBuffer();
  for (const [size, name] of [[192, "app-icon-192.png"], [512, "app-icon-512.png"], [180, "apple-icon-180.png"]]) {
    const inner = Math.round(size * 0.72);
    const logo = await sharp(trimmed).resize({ width: inner, height: inner, fit: "inside" }).toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: "#ffffff" } })
      .composite([{ input: logo, gravity: "center" }])
      .png()
      .toFile(`public/brand/${name}`);
    console.log("ok", name);
  }
})();
