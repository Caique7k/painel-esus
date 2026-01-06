const STATUS_ALVO = "Aguardando atendimento";
const CARD_SEL = 'div[data-testid="cidadao.listaAtendimento"]';
const MENU_BTN_SEL = 'button[title="Mais opções"][aria-haspopup="true"]';
const CONFIG_KEY = "pec_config";
const BTN_CLASS = "pec-ext-chamar-btn";

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

  // Observer mais completo (pega troca de texto e mudanças internas)
  const obs = new MutationObserver(() => scheduleSync());
  obs.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true, // <- pega mudanças em texto
    attributes: true, // <- pega mudanças de atributos (às vezes status troca via atributo/classe)
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
    "DEMANDA ESPONTÂNEA",
  ];

  const spans = Array.from(card.querySelectorAll("span"))
    .map((s) => (s.textContent || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // 1) remove coisas que não são nome
  const candidatos = spans.filter((t) => {
    if (blacklist.some((b) => t.includes(b))) return false;
    if (t.includes("anos")) return false; // idade
    if (/^\d{2}:\d{2}$/.test(t)) return false; // horário
    if (t.length < 8) return false; // muito curto
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
    document.querySelector('[aria-label="Menu do usuário"][role="button"] p')
      ?.textContent || ""
  )
    .replace(/\s+/g, " ")
    .trim();
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

    chrome.runtime.sendMessage(
      {
        type: "POST_TO_API",
        url: API_URL,
        payload,
        // headers opcionais (ex: token)
        headers: {
          // "Authorization": "Bearer SEU_TOKEN"
        },
      },
      (resp) => {
        if (!resp) {
          console.log("[PEC-EXT] Sem resposta do background");
          return;
        }

        if (resp.ok) {
          console.log("[PEC-EXT] Enviado com sucesso:", resp.status, resp.body);
        } else {
          console.error(
            "[PEC-EXT] Falha ao enviar:",
            resp.status,
            resp.error || resp.body
          );
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

window.__PEC_DEBUG__ = {
  showConfigModal,
  getConfig,
};
console.log("[PEC-EXT] content script carregado");
