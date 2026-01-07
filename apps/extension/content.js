const STATUS_ALVO = "Aguardando atendimento";
const CARD_SEL = 'div[data-testid="cidadao.listaAtendimento"]';
const MENU_BTN_SEL = 'button[title="Mais opções"][aria-haspopup="true"]';
const CONFIG_KEY = "pec_config";
const BTN_CLASS = "pec-ext-chamar-btn";

// --- NOVAS CONSTANTES DE TEMPO ---
const CLICK_DELAY_MS = 10000; // 10 segundos de intervalo entre cliques
const TIME_WINDOW_MS = 5 * 60 * 1000; // 5 minutos de janela total

let EXTENSION_ALIVE = true;
let observer = null;
let syncInterval = null;
let CACHED_CONFIG = null;
let CONFIG_LOADED = false;

// --- 1. INJEÇÃO DE ESTILOS (CORES E ANIMAÇÃO) ---
function injectStyles() {
  const styleId = "pec-ext-styles";
  if (document.getElementById(styleId)) return;

  const css = `
    /* Botão Base */
    .${BTN_CLASS} {
      margin-right: 10px;
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      color: white;
      background-color: #007bff; /* Azul padrão (1ª vez) */
      transition: background-color 0.3s, transform 0.1s;
    }
    .${BTN_CLASS}:active { transform: scale(0.95); }

    /* Estados de Cor */
    .${BTN_CLASS}.attempt-1 { background-color: #f1c40f; color: #000; } /* Amarelo */
    .${BTN_CLASS}.attempt-2 { background-color: #e74c3c; color: white; } /* Vermelho */
    
    /* Estado Bloqueado (3 tentativas) */
    .${BTN_CLASS}.attempt-blocked { 
      background-color: #8e44ad; /* Roxo */
      color: white; 
      cursor: not-allowed; 
      opacity: 0.9;
    }

    /* --- NOVO: Estado Expirado (Tempo > 5min) --- */
    .${BTN_CLASS}.expired {
      background-color: #95a5a6; /* Cinza */
      color: white;
      cursor: not-allowed;
      opacity: 0.8;
    }

    /* Estado Carregando */
    .${BTN_CLASS}.loading {
      cursor: wait;
      opacity: 0.7;
    }
    .${BTN_CLASS}.loading::after {
      content: ' .';
      animation: dots 1s steps(5, end) infinite;
    }
    @keyframes dots {
      0%, 20% { content: ' .'; }
      40% { content: ' ..'; }
      60% { content: ' ...'; }
      80%, 100% { content: ''; }
    }
    
    /* Modal Styles */
    .pec-ext-modal-backdrop {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); z-index: 9999;
      display: flex; align-items: center; justify-content: center;
    }
    .pec-ext-modal {
      background: white; padding: 20px; border-radius: 8px;
      width: 300px; display: flex; flex-direction: column; gap: 10px;
    }
  `;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);
}

window.addEventListener("unload", () => {
  EXTENSION_ALIVE = false;
  observer?.disconnect();
  clearInterval(syncInterval);
});

// --- CONFIGURAÇÃO E STORAGE ---

function getConfig() {
  return new Promise((resolve) => {
    if (!EXTENSION_ALIVE || !chrome?.storage?.local) {
      resolve(null);
      return;
    }
    try {
      chrome.storage.local.get([CONFIG_KEY], (res) => {
        resolve(res?.[CONFIG_KEY] || null);
      });
    } catch {
      resolve(null);
    }
  });
}

function getPatientKey(card, sectorId) {
  const patientName = getNomePaciente(card);
  return `sector-${sectorId}::patient-${patientName}`;
}

function getCallAttempts() {
  return new Promise((resolve) => {
    if (!EXTENSION_ALIVE || !chrome?.storage?.local) {
      resolve({});
      return;
    }
    try {
      chrome.storage.local.get(["pec_call_attempts"], (res) => {
        resolve(res?.pec_call_attempts || {});
      });
    } catch {
      resolve({});
    }
  });
}

function saveCallAttempts(data) {
  return new Promise((resolve) => {
    if (!EXTENSION_ALIVE || !chrome?.storage?.local) {
      resolve();
      return;
    }
    try {
      chrome.storage.local.set({ pec_call_attempts: data }, resolve);
    } catch {
      resolve({});
    }
  });
}

function saveConfig(config) {
  return new Promise((resolve) => {
    if (!EXTENSION_ALIVE || !chrome?.storage?.local) {
      resolve();
      return;
    }
    try {
      chrome.storage.local.set({ [CONFIG_KEY]: config }, resolve);
    } catch {
      resolve({});
    }
  });
}

// --- LÓGICA DE UI E API ---

async function fetchAreasAndSectors() {
  // Ajuste o IP/Porta conforme necessário
  const res = await fetch("http://localhost:3001/sector");
  if (!res.ok) throw new Error("Erro ao buscar setores");
  return res.json();
}

// --- ATUALIZAÇÃO VISUAL (Modificado para suportar Expirado) ---
function updateButtonVisuals(
  btn,
  attempts,
  isLoading = false,
  isExpired = false
) {
  // Reseta classes
  btn.className = BTN_CLASS;
  btn.disabled = false;

  if (isLoading) {
    btn.classList.add("loading");
    btn.textContent = "Chamando";
    btn.disabled = true;
    return;
  }

  // Prioridade: Se expirou o tempo de 5 minutos
  if (isExpired) {
    btn.textContent = "Tempo de chamada excedido";
    btn.classList.add("expired"); // Nova classe cinza
    btn.disabled = true;
    return;
  }

  // Lógica das Tentativas
  if (attempts === 0) {
    btn.textContent = "Chamar";
    // Azul padrão
  } else if (attempts === 1) {
    btn.textContent = "Chamar";
    btn.classList.add("attempt-1"); // Amarelo
  } else if (attempts === 2) {
    btn.textContent = "Chamar";
    btn.classList.add("attempt-2"); // Vermelho
  } else if (attempts >= 3) {
    btn.textContent = "Limite de chamadas excedido";
    btn.classList.add("attempt-blocked"); // Roxo
    btn.disabled = true;
  }
}

function showConfirmModal({
  title,
  message,
  confirmText = "Sim",
  cancelText = "Cancelar",
}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "pec-ext-modal-backdrop";

    backdrop.innerHTML = `
      <div class="pec-ext-modal">
        <h3>${title}</h3>
        <p>${message}</p>
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button id="pec-cancel" style="background-color: #ccc;">${cancelText}</button>
          <button id="pec-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    backdrop.querySelector("#pec-cancel").onclick = () => {
      backdrop.remove();
      resolve(false);
    };

    backdrop.querySelector("#pec-confirm").onclick = () => {
      backdrop.remove();
      resolve(true);
    };

    backdrop.onclick = (e) => {
      if (e.target === backdrop) {
        backdrop.remove();
        resolve(false);
      }
    };
  });
}

async function showConfigModal() {
  const backdrop = document.createElement("div");
  backdrop.className = "pec-ext-modal-backdrop";
  backdrop.innerHTML = `
    <div class="pec-ext-modal">
      <h2>Configuração</h2>
      <select id="pec-area"><option value="">Carregando...</option></select>
      <select id="pec-sector" disabled><option value="">Selecione o setor</option></select>
      <button id="pec-save">Salvar</button>
    </div>`;
  document.body.appendChild(backdrop);

  const areaSelect = backdrop.querySelector("#pec-area");
  const sectorSelect = backdrop.querySelector("#pec-sector");

  try {
    const data = await fetchAreasAndSectors();
    areaSelect.innerHTML = '<option value="">Selecione a área</option>';
    data.forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a.areaId;
      opt.textContent = a.areaName;
      areaSelect.appendChild(opt);
    });

    areaSelect.addEventListener("change", () => {
      const areaId = Number(areaSelect.value);
      sectorSelect.innerHTML = `<option value="">Selecione o setor</option>`;
      sectorSelect.disabled = true;
      if (!areaId) return;
      const area = data.find((a) => a.areaId === areaId);
      area?.sectors.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.name;
        sectorSelect.appendChild(opt);
      });
      sectorSelect.disabled = false;
    });

    backdrop.querySelector("#pec-save").addEventListener("click", async () => {
      const areaId = Number(areaSelect.value);
      const sectorId = Number(sectorSelect.value);
      if (!areaId || !sectorId) return alert("Selecione tudo");
      const area = data.find((a) => a.areaId === areaId);
      const sector = area.sectors.find((s) => s.id === sectorId);
      await saveConfig({
        areaId,
        areaName: area.areaName,
        sectorId,
        sectorName: sector.name,
      });

      CACHED_CONFIG = {
        areaId,
        areaName: area.areaName,
        sectorId,
        sectorName: sector.name,
      };
      CONFIG_LOADED = true;
      backdrop.remove();
      alert("Configurado! Atualize a página.");
    });
  } catch (e) {
    alert("Erro ao buscar API. Verifique se o servidor está rodando.");
    backdrop.remove();
  }
}

boot();

function boot() {
  console.log("[PEC-EXT] Iniciando...");
  injectStyles();

  async function loadConfigOnce() {
    if (CONFIG_LOADED) return CACHED_CONFIG;
    CACHED_CONFIG = await getConfig();
    CONFIG_LOADED = true;
    if (!CACHED_CONFIG) {
      showConfigModal();
    }
    return CACHED_CONFIG;
  }
  (async () => {
    await loadConfigOnce();
  })();

  sync();
  const obs = new MutationObserver(() => scheduleSync());
  obs.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
  // Sincroniza a cada 1s para garantir atualizações visuais (ex: tempo expirado)
  setInterval(sync, 1000);
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
  if (!EXTENSION_ALIVE) return;

  const cards = document.querySelectorAll(CARD_SEL);
  cards.forEach((card) => {
    const isAguardando = hasExactText(card, STATUS_ALVO);
    if (isAguardando) ensureButton(card);
    else cleanupButton(card);
  });
}

function getNomePaciente(card) {
  return card.querySelector("span.css-11zrb1w")?.textContent?.trim() || "";
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

// --- FUNÇÃO PRINCIPAL DE CRIAÇÃO E ATUALIZAÇÃO ---
async function ensureButton(card) {
  if (!EXTENSION_ALIVE) return;
  let btn = card.querySelector(`.${BTN_CLASS}`);
  const menuBtn = card.querySelector(MENU_BTN_SEL);

  if (!menuBtn) return;
  const container = menuBtn.parentElement || menuBtn;

  // Cria botão se não existir
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = BTN_CLASS;
    btn.textContent = "Chamar";
    btn.dataset.processing = "false";

    btn.addEventListener("click", async () => {
      if (btn.dataset.processing === "true") return;

      // Chama função de verificação antes do modal
      const patientName = getNomePaciente(card);

      // Verificações preliminares (UI rápida) antes de abrir modal
      // Nota: A lógica real robusta fica dentro do handleButtonClick,
      // mas podemos checar o modal aqui.
      // Optei por deixar toda lógica complexa no handleButtonClick
      // para garantir que o estado esteja fresco.

      const confirmed = await showConfirmModal({
        title: "Confirmar chamada",
        message: `Deseja realmente chamar o paciente "${patientName}"?`,
        confirmText: "Chamar",
        cancelText: "Cancelar",
      });

      if (!confirmed) return;

      btn.dataset.processing = "true";
      btn.disabled = true;

      handleButtonClick(card, btn);
    });

    container.insertBefore(btn, menuBtn);
  }

  // ATUALIZAÇÃO VISUAL CONSTANTE
  const config = CACHED_CONFIG;
  if (config) {
    const attemptsData = await getCallAttempts();
    const patientKey = getPatientKey(card, config.sectorId);
    const record = attemptsData[patientKey] || { attempts: 0 };

    // Verifica se expirou os 5 minutos
    let isExpired = false;
    if (record.firstCallAt) {
      const now = new Date();
      const firstCallTime = new Date(record.firstCallAt);
      if (now - firstCallTime > TIME_WINDOW_MS) {
        isExpired = true;
      }
    }

    if (btn.dataset.processing !== "true") {
      updateButtonVisuals(btn, record.attempts, false, isExpired);
    }
  }
}

// --- LÓGICA DO CLIQUE COM RESTRIÇÕES ---
async function handleButtonClick(card, btn) {
  const config = CACHED_CONFIG;

  if (!config) {
    console.warn("[PEC-EXT] Config ainda não carregada");
    btn.dataset.processing = "false";
    btn.disabled = false;
    return;
  }

  const attemptsData = await getCallAttempts();
  const patientKey = getPatientKey(card, config.sectorId);
  // Garante estrutura inicial
  const record = attemptsData[patientKey] || { attempts: 0, callId: null };
  const now = new Date();

  // --- REGRA 1: JANELA DE 5 MINUTOS ---
  if (record.firstCallAt) {
    const firstDiff = now - new Date(record.firstCallAt);
    if (firstDiff > TIME_WINDOW_MS) {
      // Excedeu 5 minutos
      updateButtonVisuals(btn, record.attempts, false, true); // true = isExpired
      btn.dataset.processing = "false";
      return; // Para aqui
    }
  }

  // --- REGRA 2: INTERVALO DE 10 SEGUNDOS ---
  if (record.lastCallAt) {
    const lastDiff = now - new Date(record.lastCallAt);
    if (lastDiff < CLICK_DELAY_MS) {
      alert(
        "Paciente chamado recentemente. Aguarde alguns segundos para poder chamar novamente"
      );

      // Reseta estado do botão
      btn.dataset.processing = "false";
      btn.disabled = false;
      return; // Para aqui
    }
  }

  // --- REGRA 3: LIMITE DE TENTATIVAS ---
  if (record.attempts >= 3) {
    updateButtonVisuals(btn, 3);
    btn.dataset.processing = "false";
    return;
  }

  // --- SE PASSOU PELAS REGRAS, PROSEGUE ---
  updateButtonVisuals(btn, record.attempts, true); // Loading state

  const nextAttempt = record.attempts + 1;
  let endpoint = "/call";
  if (nextAttempt > 1 && record.callId) {
    endpoint = `/call/retry`;
  }

  const payload =
    nextAttempt === 1
      ? {
          origem: "esus.dumont.sp.gov.br/lista-atendimento",
          capturado_em: now.toISOString(),
          doctorName: getUsuarioLogado(),
          patientName: getNomePaciente(card),
          sectorId: config.sectorId,
          attempt: nextAttempt,
        }
      : { callId: record.callId, attempt: nextAttempt };

  // Chama API via background script
  chrome.runtime.sendMessage(
    { type: "POST_TO_API", url: `http://localhost:3001${endpoint}`, payload },
    async (resp) => {
      if (!resp || !resp.ok) {
        btn.dataset.processing = "false";
        btn.disabled = false;
        btn.textContent = "Erro API";
        setTimeout(() => {
          // Verifica expiração novamente ao restaurar visual
          let isExp = false;
          if (
            record.firstCallAt &&
            new Date() - new Date(record.firstCallAt) > TIME_WINDOW_MS
          )
            isExp = true;
          updateButtonVisuals(btn, record.attempts, false, isExp);
        }, 2000);
        return;
      }

      // SUCESSO
      let callId = record.callId;
      if (nextAttempt === 1) callId = resp.body?.id;

      // Define firstCallAt: se já existe, mantém. Se não (1ª vez), define agora.
      const firstCallAt = record.firstCallAt || now.toISOString();

      attemptsData[patientKey] = {
        attempts: nextAttempt,
        callId,
        status: "calling",
        lastCallAt: now.toISOString(),
        firstCallAt: firstCallAt, // Salva o tempo da 1ª chamada para controlar os 5 min
      };

      await saveCallAttempts(attemptsData);

      btn.dataset.processing = "false";

      // Atualiza visual verificando expiração imediata (improvável aqui, mas consistente)
      const diff = new Date() - new Date(firstCallAt);
      const isExpiredNow = diff > TIME_WINDOW_MS;
      updateButtonVisuals(btn, nextAttempt, false, isExpiredNow);
    }
  );
}

function cleanupButton(card) {
  const btn = card.querySelector(`.${BTN_CLASS}`);
  if (btn) btn.remove();
}
