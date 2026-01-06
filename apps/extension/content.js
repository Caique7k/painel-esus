const STATUS_ALVO = "Aguardando atendimento";
const CARD_SEL = 'div[data-testid="cidadao.listaAtendimento"]';
const MENU_BTN_SEL = 'button[title="Mais opções"][aria-haspopup="true"]';
const CONFIG_KEY = "pec_config";
const BTN_CLASS = "pec-ext-chamar-btn";

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
    .${BTN_CLASS}.attempt-blocked { 
      background-color: #8e44ad; /* Roxo */
      color: white; 
      cursor: not-allowed; 
      opacity: 0.9;
    }

    /* Estado Carregando */
    .${BTN_CLASS}.loading {
      cursor: wait;
      opacity: 0.7;
    }
    /* Animação dos pontinhos (...) */
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

// --- CONFIGURAÇÃO E STORAGE ---

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get([CONFIG_KEY], (res) =>
      resolve(res[CONFIG_KEY] || null)
    );
  });
}

function getPatientKey(card, sectorId) {
  const patientName = getNomePaciente(card);
  return `sector-${sectorId}::patient-${patientName}`;
}

function getCallAttempts() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["pec_call_attempts"], (res) =>
      resolve(res.pec_call_attempts || {})
    );
  });
}

function saveCallAttempts(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ pec_call_attempts: data }, resolve);
  });
}

function saveConfig(config) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [CONFIG_KEY]: config }, resolve);
  });
}

// --- LÓGICA DE UI E API ---

async function fetchAreasAndSectors() {
  const res = await fetch("http://localhost:3001/sector");
  if (!res.ok) throw new Error("Erro ao buscar setores");
  return res.json();
}

// Função auxiliar para definir a aparência do botão baseada no nº de tentativas
function updateButtonVisuals(btn, attempts, isLoading = false) {
  // Reseta classes
  btn.className = BTN_CLASS;
  btn.disabled = false;

  if (isLoading) {
    btn.classList.add("loading");
    btn.textContent = "Chamando"; // O CSS adiciona o "..."
    btn.disabled = true;
    return;
  }

  // Lógica das Cores
  if (attempts === 0) {
    btn.textContent = "Chamar";
    // Azul padrão (sem classe extra)
  } else if (attempts === 1) {
    btn.textContent = "Chamar"; // Ou "Chamar (2ª)"
    btn.classList.add("attempt-1"); // Amarelo
  } else if (attempts === 2) {
    btn.textContent = "Chamar"; // Ou "Chamar (3ª)"
    btn.classList.add("attempt-2"); // Vermelho
  } else if (attempts >= 3) {
    btn.textContent = "Limite excedido";
    btn.classList.add("attempt-blocked"); // Roxo
    btn.disabled = true; // Bloqueia clique
  }
}

async function showConfigModal() {
  // ... (Mantive igual ao seu código original, só simplifiquei para caber aqui)
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
  injectStyles(); // Injeta o CSS

  (async () => {
    const config = await getConfig();
    if (!config) showConfigModal();
  })();

  sync();
  const obs = new MutationObserver(() => scheduleSync());
  obs.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
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
    if (t.includes("anos") || /^\d{2}:\d{2}$/.test(t) || t.length < 5)
      return false;
    return /[A-Z]/.test(t);
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

// --- PRINCIPAL MUDANÇA AQUI ---
async function ensureButton(card) {
  let btn = card.querySelector(`.${BTN_CLASS}`);
  const menuBtn = card.querySelector(MENU_BTN_SEL);

  // Se não tem botão de menu (card inválido) ou já tem nosso botão E JÁ ESTÁ configurado visualmente, retorna
  // Nota: Removemos o return simples se o botão existe, pois precisamos atualizar a cor se o estado mudar externamente
  if (!menuBtn) return;

  const container = menuBtn.parentElement || menuBtn;

  // Se o botão não existe, cria
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = BTN_CLASS;
    btn.textContent = "Chamar";

    // Evento de Click
    btn.addEventListener("click", async () => {
      handleButtonClick(card, btn);
    });

    container.insertBefore(btn, menuBtn);
  }

  // ATUALIZAÇÃO VISUAL: Busca o estado atual e pinta o botão corretamente
  // Fazemos isso a cada sync para garantir que se você atualizar a página, os botões voltem com a cor certa
  const config = await getConfig();
  if (config) {
    const attemptsData = await getCallAttempts();
    const patientKey = getPatientKey(card, config.sectorId);
    const record = attemptsData[patientKey] || { attempts: 0 };

    // Só atualiza visual se não estiver clicado/carregando no momento
    if (!btn.disabled) {
      updateButtonVisuals(btn, record.attempts);
    }
  }
}

async function handleButtonClick(card, btn) {
  const config = await getConfig();
  if (!config) {
    showConfigModal();
    return;
  }

  // 1. Recupera tentativas atuais
  const attemptsData = await getCallAttempts();
  const patientKey = getPatientKey(card, config.sectorId);
  const record = attemptsData[patientKey] || { attempts: 0, callId: null };

  // Verifica se já excedeu antes de tentar chamar (segurança extra)
  if (record.attempts >= 3) {
    updateButtonVisuals(btn, 3);
    return;
  }

  // 2. Muda para estado "Carregando..."
  updateButtonVisuals(btn, record.attempts, true);

  const nextAttempt = record.attempts + 1;
  let endpoint = "/call";
  if (nextAttempt > 1 && record.callId) {
    endpoint = `/call/retry`;
  }

  const payload =
    nextAttempt === 1
      ? {
          origem: "esus.dumont.sp.gov.br/lista-atendimento",
          capturado_em: new Date().toISOString(),
          doctorName: getUsuarioLogado(),
          patientName: getNomePaciente(card),
          sectorId: config.sectorId,
          attempt: nextAttempt,
        }
      : { callId: record.callId, attempt: nextAttempt };

  // 3. Chama API
  chrome.runtime.sendMessage(
    { type: "POST_TO_API", url: `http://localhost:3001${endpoint}`, payload },
    async (resp) => {
      if (!resp || !resp.ok) {
        btn.disabled = false;
        btn.textContent = "Erro API";
        btn.className = BTN_CLASS; // Reseta cor para azul/padrão momentaneamente
        setTimeout(() => updateButtonVisuals(btn, record.attempts), 2000); // Volta ao estado anterior
        return;
      }

      // 4. Sucesso: Atualiza Storage e Visual
      let callId = record.callId;
      if (nextAttempt === 1) callId = resp.body?.id;

      attemptsData[patientKey] = {
        attempts: nextAttempt,
        callId,
        status: "calling",
        lastCallAt: new Date().toISOString(),
      };

      await saveCallAttempts(attemptsData);

      // Aplica a nova cor baseada no novo número de tentativas
      updateButtonVisuals(btn, nextAttempt);
    }
  );
}

function cleanupButton(card) {
  const btn = card.querySelector(`.${BTN_CLASS}`);
  if (btn) btn.remove();
}
