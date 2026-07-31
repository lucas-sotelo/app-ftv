"use client";

import * as React from "react";

/**
 * Com skipWaiting + clients.claim, o novo service worker assume o controle
 * da página assim que instala — antes mesmo do usuário fechar a aba. Esse
 * `controllerchange` é o sinal de que a versão trocou debaixo do usuário;
 * recarregamos na hora para a tela não continuar rodando contra um SW novo
 * com um HTML/JS antigo.
 *
 * `hadController` existe porque o MESMO evento dispara na primeira visita
 * (quando o clients.claim() inicial passa a controlar uma página que antes
 * não tinha controller nenhum) — nesse caso não é atualização, e recarregar
 * derrubaria o que o usuário já tinha digitado.
 */
export function PwaUpdater() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloaded = false;

    const onControllerChange = () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  return null;
}
