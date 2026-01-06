const STATUS_ALVO = "Aguardando atendimento";
const CARD_SEL = 'div[data-testid="cidadao.listaAtendimento"]';
const MENU_BTN_SEL = 'button[title="Mais opções"][aria-haspopup="true"]';
const CONFIG_KEY = "pec_config";
const BTN_CLASS = "pec-ext-chamar-btn";
const CALL_ATTEMPTS_KEY = "pec_call_attempts";

function getCallAttempts() {
  return new Promise((resolve) => {
    chrome.storage.local.get([CALL_ATTEMPTS_KEY], (res) => {
      resolve(res[CALL_ATTEMPTS_KEY] || {});
    });
  });
}

function saveCallAttempts(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [CALL_ATTEMPTS_KEY]: data }, resolve);
  });
}

function getPatientKey(card, sectorId) {
  return `${getNomePaciente(card)}|${sectorId}`;
}

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get([CONFIG_KEY], (res) => {
      resolve(res[CONFIG_KEY] || null);
    });
  });
}

function saveConfig(config) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [CONFIG_KEY]: config }, resolve);
  });
}

async function fetchAreasAndSectors() {
  const res = await fetch("http://localhost:3001/sector");
  if (!res.ok) throw new Error("Erro ao buscar setores");
  return res.json();
}

async function showConfigModal() {
  const backdrop = document.createElement("div");
  backdrop.className = "pec-ext-modal-backdrop";

  const modal = document.createElement("div");
  modal.className = "pec-ext-modal";

  modal.innerHTML = `
    <h2>Configuração inicial</h2>
    <p>Selecione a área e o setor onde você está atendendo.</p>

    <label>Área</label>
    <select id="pec-area">
      <option value="">Selecione a área</option>
    </select>

    <label>Setor</label>
    <select id="pec-sector" disabled>
      <option value="">Selecione o setor</option>
    </select>

    <button id="pec-save">Salvar configuração</button>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const areaSelect = modal.querySelector("#pec-area");
  const sectorSelect = modal.querySelector("#pec-sector");
  const saveBtn = modal.querySelector("#pec-save");

  const data = await fetchAreasAndSectors();

  // popula áreas
  data.forEach((area) => {
    const opt = document.createElement("option");
    opt.value = area.areaId;
    opt.textContent = area.areaName;
    areaSelect.appendChild(opt);
  });

  areaSelect.addEventListener("change", () => {
    const areaId = Number(areaSelect.value);
    sectorSelect.innerHTML = `<option value="">Selecione o setor</option>`;
    sectorSelect.disabled = true;

    if (!areaId) return;

    const area = data.find((a) => a.areaId === areaId);
    if (!area) return;

    area.sectors.forEach((sector) => {
      const opt = document.createElement("option");
      opt.value = sector.id;
      opt.textContent = sector.name;
      sectorSelect.appendChild(opt);
    });

    sectorSelect.disabled = false;
  });

  saveBtn.addEventListener("click", async () => {
    const areaId = Number(areaSelect.value);
    const sectorId = Number(sectorSelect.value);

    if (!areaId || !sectorId) {
      alert("Selecione a área e o setor");
      return;
    }

    const area = data.find((a) => a.areaId === areaId);
    const sector = area.sectors.find((s) => s.id === sectorId);

    await saveConfig({
      areaId,
      areaName: area.areaName,
      sectorId,
      sectorName: sector.name,
    });

    backdrop.remove();
    console.log("[PEC-EXT] Configuração salva");
  });
}

boot();

function boot() {
  console.log("[PEC-EXT] content script carregado");
  (async () => {
    const config = await getConfig();
    if (!config) {
      showConfigModal();
    } else {
      console.log("[PEC-EXT] Config carregada:", config);
    }
  })();
  sync();

  // Observer mais completo
  const obs = new MutationObserver(() => scheduleSync());
  obs.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });

  // Fallback
  setInterval(sync, 800);
}

let syncScheduled = false;
function scheduleSync() {
  if (syncScheduled) return;
  syncScheduled = true;
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
    "DEMANDA ESPONTÂNEA",
  ];

  const spans = Array.from(card.querySelectorAll("span"))
    .map((s) => (s.textContent || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const candidatos = spans.filter((t) => {
    if (blacklist.some((b) => t.includes(b))) return false;
    if (t.includes("anos")) return false; // idade
    if (/^\d{2}:\d{2}$/.test(t)) return false; // horário
    if (t.length < 8) return false; // muito curto
    const isCaps = t === t.toUpperCase();
    const hasLetters = /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(t);
    return isCaps && hasLetters;
  });

  candidatos.sort((a, b) => b.length - a.length);

  return candidatos[0] || "";
}

function getUsuarioLogado() {
  return (
    document.querySelector('[aria-label="Menu do usuário"][role="button"] p')
      ?.textContent || ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

function hasExactText(card, text) {
  const els = card.querySelectorAll("span, div, p, small");
  for (const el of els) {
    if ((el.textContent || "").trim() === text) return true;
  }
  return false;
}

// --- LÓGICA DO BOTÃO E ANIMAÇÃO ---

function ensureButton(card) {
  // Se já existe, não recria (mantém o estado/fase atual)
  if (card.querySelector(`.${BTN_CLASS}`)) return;

  const menuBtn = card.querySelector(MENU_BTN_SEL);
  if (!menuBtn) return;

  const container = menuBtn.parentElement || menuBtn;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = BTN_CLASS;
  
  // Estado inicial
  btn.textContent = "Chamar";
  btn.dataset.phase = "0"; // 0: Branco, 1: Amarelo, 2: Vermelho, 3: Finalizado

  btn.addEventListener("click", (e) => handleButtonFlow(e, btn, card));

  container.insertBefore(btn, menuBtn);
}

async function handleButtonFlow(e, btn, card) {
  e.preventDefault();
  e.stopPropagation(); // Garante que não clique em nada atrás

  const phase = parseInt(btn.dataset.phase || "0");

  // Se já estiver finalizado ou animando, ignora
  if (phase >= 3 || btn.classList.contains("animating")) return;

  // 1. Confirmação
  const paciente = getNomePaciente(card);
  const confirmMsg = `Deseja realmente chamar o paciente: \n${paciente}?`;
  
  // O clique só é "captado" (processado) se confirmar
  if (!confirm(confirmMsg)) {
    return; 
  }

  // 2. Dispara API (funcionalidade original)
  await callApi(card);

  // 3. Inicia Animação e Transição de Fase
  startAnimation(btn, phase);
}

function startAnimation(btn, currentPhase) {
  // Adiciona classe para escurecer e travar cliques
  btn.classList.add("animating");
  
  let dots = 1;
  btn.textContent = ".";

  // Loop da animação de pontos
  const animInterval = setInterval(() => {
    dots++;
    if (dots > 3) dots = 1;
    btn.textContent = ".".repeat(dots);
  }, 400); // Velocidade da troca de pontos

  // Duração da animação (ex: 3 segundos)
  setTimeout(() => {
    clearInterval(animInterval);
    btn.classList.remove("animating");
    
    // Avança para a próxima fase
    const nextPhase = currentPhase + 1;
    btn.dataset.phase = nextPhase.toString();

    updateButtonVisuals(btn, nextPhase);
  }, 3000); 
}

function updateButtonVisuals(btn, phase) {
  if (phase === 1) {
    btn.textContent = "Chamar"; // Fundo amarelo (via CSS)
  } else if (phase === 2) {
    btn.textContent = "Chamar"; // Fundo vermelho (via CSS)
  } else if (phase === 3) {
    btn.textContent = "Limite de chamadas excedidas"; // Fundo roxo (via CSS)
    btn.disabled = true; // Não clicável
  }
}

async function callApi(card) {
    const config = await getConfig();
    if (!config) {
      alert("Extensão não configurada");
      showConfigModal();
      return;
    }

    const payload = {
      origem: "esus.dumont.sp.gov.br/lista-atendimento",
      capturado_em: new Date().toISOString(),
      doctorName: getUsuarioLogado(),
      patientName: getNomePaciente(card),
      sectorId: config.sectorId,
    };

    const API_URL = "http://localhost:3001/call";

    return new Promise(resolve => {
        chrome.runtime.sendMessage(
            {
              type: "POST_TO_API",
              url: API_URL,
              payload,
            },
            (resp) => {
              if (resp && resp.ok) {
                console.log("[PEC-EXT] API ok");
              } else {
                console.error("[PEC-EXT] API fail", resp);
              }
              resolve(); // Resolvemos sempre para não travar a animação visual em caso de erro de rede
            }
          );
    });
}

function cleanupButton(card) {
  const btn = card.querySelector(`.${BTN_CLASS}`);
  if (btn) btn.remove();
}

window.__PEC_DEBUG__ = {
  showConfigModal,
  getConfig,
};