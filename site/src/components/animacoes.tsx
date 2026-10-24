"use client";

import { useEffect } from "react";

/**
 * Entrada ao rolar: elementos com `data-revelar` sobem ou entram pelas laterais quando chegam a 90% da altura da tela
 * (transform e opacity, 500 ms). Confere a posição a cada quadro de rolagem, então nada fica escondido numa rolagem
 * rápida ou num salto pelo menu. Sem JavaScript, ou com "reduzir movimento", tudo aparece direto; o que já está na
 * tela ao abrir a página não é escondido.
 */
export function Animacoes() {
  useEffect(() => {
    const todos = Array.from(document.querySelectorAll<HTMLElement>("[data-revelar]"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      todos.forEach((el) => el.classList.add("visivel"));
      return;
    }
    const limite = () => window.innerHeight * 0.9;
    let pendentes = todos.filter((el) => {
      if (el.getBoundingClientRect().top < limite()) {
        el.classList.add("visivel");
        return false;
      }
      el.classList.add("revelar");
      return true;
    });
    let quadro = 0;
    const conferir = () => {
      quadro = 0;
      pendentes = pendentes.filter((el) => {
        if (el.getBoundingClientRect().top < limite()) {
          el.classList.add("visivel");
          return false;
        }
        return true;
      });
      if (!pendentes.length) parar();
    };
    const agendar = () => {
      if (!quadro) quadro = requestAnimationFrame(conferir);
    };
    const parar = () => {
      window.removeEventListener("scroll", agendar);
      window.removeEventListener("resize", agendar);
    };
    window.addEventListener("scroll", agendar, { passive: true });
    window.addEventListener("resize", agendar);
    return () => {
      parar();
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, []);
  return null;
}
