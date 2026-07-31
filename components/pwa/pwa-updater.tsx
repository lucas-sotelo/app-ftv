"use client";

import * as React from "react";

/**
 * Com skipWaiting + clients.claim, o novo service worker assume o controle
 * da página assim que instala — antes mesmo do usuário fechar a aba. Esse
 * `controllerchange` é o sinal de que a versão trocou debaixo do usuário.
 *
 * `hadController` existe porque o MESMO evento dispara na primeira visita
 * (quando o clients.claim() inicial passa a controlar uma página que antes
 * não tinha controller nenhum) — nesse caso não é atualização, e recarregar
 * derrubaria o que o usuário já tinha digitado.
 *
 * O reload em si só acontece com a aba em segundo plano (`visibilitychange`
 * para "hidden"): um `window.location.reload()` imediato, com a tela em
 * primeiro plano, derruba qualquer interação em andamento — inclusive o
 * próprio convite de instalação do PWA, que passava a "sumir sozinho" assim
 * que a página terminava de renderizar e recebia a atualização. Adiar para
 * o próximo momento em que o usuário troca de app/bloqueia a tela mantém a
 * atualização "de fundo" sem interromper quem está com o app aberto.
 */
export function PwaUpdater() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const hadController = Boolean(navigator.serviceWorker.controller);
    let updatePending = false;
    let reloaded = false;

    const reloadIfHidden = () => {
      if (!updatePending || reloaded || document.visibilityState !== "hidden") return;
      reloaded = true;
      window.location.reload();
    };

    const onControllerChange = () => {
      if (!hadController || reloaded) return;
      updatePending = true;
      reloadIfHidden();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", reloadIfHidden);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", reloadIfHidden);
    };
  }, []);

  return null;
}
