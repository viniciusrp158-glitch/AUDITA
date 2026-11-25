// Capturas de uma página do site local (computador 1440 e iPhone 13), com checagem de rolagem lateral e erros.
// Uso: NODE_PATH=<repo>/node_modules node capturas.cjs <pasta-saida> artigos/<endereco>/ [...]   (rotas sem a barra inicial: o Git Bash troca "/x" por caminho do Windows; servidor em 127.0.0.1:3400)
const { chromium, devices } = require("@playwright/test");
const [out, ...rotas] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  let falhou = false;
  for (const [nome, opt] of [["computador-1440", { viewport: { width: 1440, height: 900 } }], ["iphone13", { ...devices["iPhone 13"] }]]) {
    const ctx = await b.newContext({ ...opt, locale: "pt-BR", reducedMotion: "reduce" });
    for (const r0 of rotas) {
      const rota = "/" + r0.replace(/^\/+/, "");
      const p = await ctx.newPage(); const erros = [];
      p.on("pageerror", (e) => erros.push(String(e))); p.on("console", (m) => m.type() === "error" && erros.push(m.text()));
      const r = await p.goto("http://127.0.0.1:3400" + rota, { waitUntil: "networkidle" });
      await p.addStyleTag({ content: "[data-revelar]{opacity:1!important;transform:none!important}" });
      await p.waitForTimeout(300);
      const lateral = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const arq = (rota.replace(/^\/|\/$/g, "").replace(/\//g, "_") || "inicio") + "-" + nome + ".png";
      await p.screenshot({ path: `${out}/${arq}`, fullPage: true });
      const ok = r.status() === 200 && lateral <= 0 && !erros.length;
      if (!ok) falhou = true;
      console.log(ok ? "OK " : "FALHA", nome, rota, "status:", r.status(), "lateral:", lateral, "erros:", erros.length ? erros : 0, "->", arq);
      await p.close();
    }
    await ctx.close();
  }
  await b.close();
  process.exit(falhou ? 1 : 0);
})();
