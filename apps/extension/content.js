const STATUS_ALVO = "Aguardando atendimento";
const CARD_SEL = 'div[data-testid="cidadao.listaAtendimento"]';
const MENU_BTN_SEL = 'button[title="Mais opções"][aria-haspopup="true"]';

const BTN_CLASS = "pec-ext-chamar-btn";

boot();

function boot() {
  sync();

  // Observer mais completo (pega troca de texto e mudanças internas)
  const obs = new MutationObserver(() => scheduleSync());
  obs.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,   // <- pega mudanças em texto
    attributes: true       // <- pega mudanças de atributos (às vezes status troca via atributo/classe)
  });

  // Fallback: garante acompanhamento mesmo se o observer não disparar
  setInterval(sync, 800);
}

let syncScheduled = false;
function scheduleSync() {
  if (syncScheduled) return;
  syncScheduled = true;
  // debounce pra não rodar mil vezes
  requestAnimationFrame(() => {
    syncScheduled = false;
    sync();
  });
}

function sync() {
  const cards = document.querySelectorAll(CARD_SEL);

  cards.forEach((card) => {
    const isAguardando = hasExactText(card, STATUS_ALVO);

    if (isAguardando) ensureButton(card);
    else cleanupButton(card);
  });
}

function getNomePaciente(card) {
  const blacklist = [
    "Aguardando atendimento",
    "Em atendimento",
    "Finalizado",
    "Não agendado",
    "DEMANDA ESPONTÂNEA"
  ];

  const spans = Array.from(card.querySelectorAll("span"))
    .map(s => (s.textContent || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // 1) remove coisas que não são nome
  const candidatos = spans.filter(t => {
    if (blacklist.some(b => t.includes(b))) return false;
    if (t.includes("anos")) return false;                 // idade
    if (/^\d{2}:\d{2}$/.test(t)) return false;            // horário
    if (t.length < 8) return false;                       // muito curto
    // “nome” costuma ter letras e espaços, e geralmente vem em CAPS no seu layout
    const isCaps = t === t.toUpperCase();
    const hasLetters = /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(t);
    return isCaps && hasLetters;
  });

  // 2) pega o melhor candidato (geralmente o mais longo é o nome)
  candidatos.sort((a, b) => b.length - a.length);

  return candidatos[0] || "";
}

function getUsuarioLogado() {
  return (
    document
      .querySelector('[aria-label="Menu do usuário"][role="button"] p')
      ?.textContent || ""
  ).replace(/\s+/g, " ").trim();
}


function hasExactText(card, text) {
  // procura o status pelo texto dentro do card (span/div/p)
  const els = card.querySelectorAll("span, div, p, small");
  for (const el of els) {
    if ((el.textContent || "").trim() === text) return true;
  }
  return false;
}

function ensureButton(card) {
  if (card.querySelector(`.${BTN_CLASS}`)) return;

  const menuBtn = card.querySelector(MENU_BTN_SEL);
  if (!menuBtn) return;

  const container = menuBtn.parentElement || menuBtn;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = BTN_CLASS;
  btn.textContent = "Chamar";
  btn.addEventListener("click", async () => {
    const card = btn.closest('div[data-testid="cidadao.listaAtendimento"]');
    if (!card) return;

    const payload = {
      origem: "esus.dumont.sp.gov.br/lista-atendimento",
      capturado_em: new Date().toISOString(),
      doctorName: getUsuarioLogado(),
      patientName: getNomePaciente(card) ,
      sectorId: 1
    };

    // TROQUE pela URL do seu endpoint
    const API_URL = "http://localhost:3001/call";

    chrome.runtime.sendMessage(
      {
        type: "POST_TO_API",
        url: API_URL,
        payload,
        // headers opcionais (ex: token)
        headers: {
          // "Authorization": "Bearer SEU_TOKEN"
        }
      },
      (resp) => {
        if (!resp) {
          console.log("[PEC-EXT] Sem resposta do background");
          return;
        }

        if (resp.ok) {
          console.log("[PEC-EXT] Enviado com sucesso:", resp.status, resp.body);
        } else {
          console.error("[PEC-EXT] Falha ao enviar:", resp.status, resp.error || resp.body);
          alert("Falha ao enviar para API. Veja o console.");
        }
      }
    );
  });




  container.insertBefore(btn, menuBtn);
}

function cleanupButton(card) {
  const btn = card.querySelector(`.${BTN_CLASS}`);
  if (btn) btn.remove();
}
