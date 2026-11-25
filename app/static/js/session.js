// session.js — vigia de sessao (carregado em toda pagina autenticada).
//
// A cada 1 minuto bate em /auth/me (rota same-origin do Flask, que repassa para
// o /auth/me da API com o JWT da sessao). Se o token expirou ou foi revogado, a
// rota devolve 401 e mandamos o usuario para a tela de login.
//
// Sem isso, uma aba parada continua "logada" na aparencia ate o proximo clique:
// o token expira em ~30 min e nao ha refresh.
//
// Regras de convivencia:
// - So desloga no 401. Erro de rede ou API fora do ar (5xx) e ignorado — a
//   sessao pode estar perfeitamente valida, seria cruel derrubar o usuario.
// - Aba em segundo plano nao precisa de polling; ao voltar para ela a
//   verificacao roda na hora (pode ter expirado enquanto estava oculta).

const CHECK_URL = window.__SESSION_CHECK_URL__;
const LOGIN_URL = window.__LOGIN_URL__;
const INTERVAL_MS = 60_000; // 1 minuto

const LOGIN_PATH = LOGIN_URL ? new URL(LOGIN_URL, window.location.origin).pathname : null;

let timerId = null;
let checking = false; // evita empilhar requests se um ciclo demorar
let redirecting = false; // uma vez indo pro login, nao insiste

function start() {
  if (timerId === null) timerId = window.setInterval(check, INTERVAL_MS);
}

function stop() {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function goToLogin() {
  if (redirecting) return;
  redirecting = true;
  stop();
  // replace (e nao href): a pagina expirada nao fica no historico, entao o
  // botao "voltar" do browser nao traz de volta uma tela que ja morreu.
  window.location.replace(LOGIN_URL);
}

async function check() {
  if (checking || redirecting || !CHECK_URL) return;
  checking = true;
  try {
    const resp = await fetch(CHECK_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    // 401 = token invalido. O `redirected` e so uma rede de seguranca: se algum
    // dia a rota passar a redirecionar pro login em vez de responder JSON, o
    // resultado aqui continua sendo o certo.
    const bouncedToLogin = resp.redirected && new URL(resp.url).pathname === LOGIN_PATH;
    if (resp.status === 401 || bouncedToLogin) goToLogin();
  } catch {
    // Offline/instabilidade: mantem a sessao e tenta de novo no proximo ciclo.
  } finally {
    checking = false;
  }
}

if (CHECK_URL && LOGIN_URL) {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
      return;
    }
    start();
    check();
  });

  if (!document.hidden) start();
}
