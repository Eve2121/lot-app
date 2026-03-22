let saveStatusTimer = null;
let vibrateTimer = null;

const MAX_CARDS = 10;

const FIXED_ACCOUNTS = [
  { id: "fintokei", name: "Fintokei", unitSize: 100000, visible: true, custom: false },
  { id: "vantage", name: "Vantage", unitSize: 100000, visible: true, custom: false },
  { id: "lion", name: "Lion", unitSize: 1000, visible: true, custom: false },
  { id: "gmo", name: "GMO", unitSize: 10000, visible: true, custom: false }
];

const STORAGE_KEY = "lotcalc_state_v3";

const el = (id) => document.getElementById(id);

const initialState = {
  rr: "2.5",
  accounts: FIXED_ACCOUNTS.map((acc) => ({
    ...acc,
    balanceRaw: "",
    riskRaw: ""
  }))
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(initialState);

    const parsed = JSON.parse(raw);
    const merged = structuredClone(initialState);

    if (typeof parsed.rr === "string" || typeof parsed.rr === "number") {
      merged.rr = String(parsed.rr);
    }

    if (Array.isArray(parsed.accounts)) {
      const fixedMap = new Map(merged.accounts.map((a) => [a.id, a]));

      parsed.accounts.forEach((saved) => {
        if (fixedMap.has(saved.id)) {
          const target = fixedMap.get(saved.id);
          target.name = typeof saved.name === "string" ? saved.name : target.name;
          target.visible = typeof saved.visible === "boolean" ? saved.visible : true;
          target.balanceRaw = typeof saved.balanceRaw === "string" ? saved.balanceRaw : "";
          target.riskRaw = typeof saved.riskRaw === "string" ? saved.riskRaw : "";
        } else if (
          saved &&
          saved.custom === true &&
          typeof saved.id === "string" &&
          typeof saved.name === "string"
        ) {
          merged.accounts.push({
            id: saved.id,
            name: saved.name,
            unitSize: 100000,
            visible: typeof saved.visible === "boolean" ? saved.visible : true,
            custom: true,
            balanceRaw: typeof saved.balanceRaw === "string" ? saved.balanceRaw : "",
            riskRaw: typeof saved.riskRaw === "string" ? saved.riskRaw : ""
          });
        }
      });
    }

    return merged;
  } catch (error) {
    return structuredClone(initialState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateSaveStatus("saved");
}

function sanitizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function sanitizeDecimal(value) {
  const cleaned = String(value || "").replace(/[^\d.]/g, "");
  const firstDotIndex = cleaned.indexOf(".");

  if (firstDotIndex === -1) return cleaned;

  const integerPart = cleaned.slice(0, firstDotIndex + 1);
  const decimalPart = cleaned.slice(firstDotIndex + 1).replace(/\./g, "");
  return integerPart + decimalPart;
}

function formatNumberWithCommasFromDigits(digits) {
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

function parseBalance(rawDigits) {
  if (!rawDigits) return 0;
  return Number(rawDigits);
}

function normalizeRiskInput(value) {
  const cleaned = sanitizeDecimal(value);
  if (!cleaned) return "";

  if (cleaned.endsWith(".")) {
    const integerPartOnly = cleaned.slice(0, -1) || "0";
    return `${integerPartOnly}.`;
  }

  const parts = cleaned.split(".");
  const integerPart = parts[0] || "0";
  const decimalPart = (parts[1] || "").slice(0, 2);

  return decimalPart.length > 0 ? `${integerPart}.${decimalPart}` : integerPart;
}

function parseRisk(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeRrInput(value) {
  const cleaned = sanitizeDecimal(value);
  if (!cleaned) return "";

  if (cleaned.endsWith(".")) {
    const integerPartOnly = cleaned.slice(0, -1) || "0";
    return `${integerPartOnly}.`;
  }

  const parts = cleaned.split(".");
  const integerPart = parts[0] || "0";
  const decimalPart = (parts[1] || "").slice(0, 2);

  return decimalPart.length > 0 ? `${integerPart}.${decimalPart}` : integerPart;
}

function parseRr(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function sanitizeRateDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatRateFromDigits(digits) {
  const clean = sanitizeRateDigits(digits);
  if (!clean) return "";

  const padded = clean.padStart(4, "0");
  const integerPart = padded.slice(0, -3);
  const decimalPart = padded.slice(-3);

  return `${Number(integerPart)}.${decimalPart}`;
}

function parseRateDigitsToNumber(digits) {
  if (!digits) return 0;
  return Number(digits) / 1000;
}

function getEntryValue() {
  return parseRateDigitsToNumber(sanitizeRateDigits(el("entry")?.value || ""));
}

function getSlValue() {
  return parseRateDigitsToNumber(sanitizeRateDigits(el("sl")?.value || ""));
}

function getSlDiff() {
  const entry = getEntryValue();
  const sl = getSlValue();

  if (!entry || !sl) return 0;
  if (entry === sl) return 0;

  return Math.abs(entry - sl);
}

function getSlPips() {
  return getSlDiff() * 100;
}

function getTpPips() {
  return getSlPips() * parseRr(state.rr);
}

function getValidationState() {
  const entryDigits = sanitizeRateDigits(el("entry")?.value || "");
  const slDigits = sanitizeRateDigits(el("sl")?.value || "");
  const entry = getEntryValue();
  const sl = getSlValue();

  if (!entryDigits || !slDigits) {
    return { valid: false, message: "Enter Entry and SL" };
  }

  if (!entry || !sl) {
    return { valid: false, message: "Check Entry and SL" };
  }

  if (entry === sl) {
    return { valid: false, message: "Entry and SL cannot match" };
  }

  return { valid: true, message: "" };
}

function calculateLossAllowance(balance, riskPercent) {
  return balance * (riskPercent / 100);
}

function calculateLot(lossAllowance, slDiff, unitSize) {
  if (!lossAllowance || !slDiff || !unitSize) return 0;
  return lossAllowance / (slDiff * unitSize);
}

function createReadonlyBox(valueText) {
  const div = document.createElement("div");
  div.className = "readonly-box";
  div.textContent = valueText;
  return div;
}

function createField(labelText, inputEl) {
  const label = document.createElement("label");
  label.className = "field";

  const span = document.createElement("span");
  span.className = "label";
  span.textContent = labelText;

  label.appendChild(span);
  label.appendChild(inputEl);
  return label;
}

function createBalanceInput(account) {
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.placeholder = "1,000,000";
  input.value = formatNumberWithCommasFromDigits(account.balanceRaw);

  input.addEventListener("focus", (event) => {
    event.target.value = account.balanceRaw;
  });

  input.addEventListener("input", (event) => {
    const digits = sanitizeDigits(event.target.value);
    account.balanceRaw = digits;
    event.target.value = digits;
    updateSaveStatus("saving");
    triggerInputVibration();
    saveState();
    updateCardResults(account.id);
  });

  input.addEventListener("blur", (event) => {
    event.target.value = formatNumberWithCommasFromDigits(account.balanceRaw);
    saveState();
    updateCardResults(account.id);
  });

  return input;
}

function createRiskInput(account) {
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "decimal";
  input.autocomplete = "off";
  input.placeholder = "1.00";
  input.value = account.riskRaw;

  input.addEventListener("focus", (event) => {
    event.target.value = account.riskRaw;
  });

  input.addEventListener("input", (event) => {
    const normalized = normalizeRiskInput(event.target.value);
    account.riskRaw = normalized;
    event.target.value = normalized;
    updateSaveStatus("saving");
    triggerInputVibration();
    saveState();
    updateCardResults(account.id);
  });

  input.addEventListener("blur", (event) => {
    const num = parseRisk(account.riskRaw);
    account.riskRaw = account.riskRaw === "" ? "" : num.toFixed(2);
    event.target.value = account.riskRaw;
    saveState();
    updateCardResults(account.id);
  });

  return input;
}

function createCard(account) {
  const card = document.createElement("section");
  card.className = "card";
  card.dataset.accountId = account.id;

  const header = document.createElement("div");
  header.className = "card-header";

  const nameWrap = document.createElement("div");
  nameWrap.className = "card-name-wrap";

  if (account.isEditingTitle) {
    const editRow = document.createElement("div");
    editRow.className = "title-edit-row";

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.value = account.name;
    titleInput.maxLength = 30;

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "title-save-btn";
    saveBtn.textContent = "Save";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "title-cancel-btn";
    cancelBtn.textContent = "Cancel";

    saveBtn.addEventListener("click", () => {
      const next = titleInput.value.trim();
      account.name = next || getDefaultCustomNameFromId(account.id) || account.name;
      account.isEditingTitle = false;
      saveState();
      renderAll();
    });

    cancelBtn.addEventListener("click", () => {
      account.isEditingTitle = false;
      renderAll();
    });

    titleInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") saveBtn.click();
      if (event.key === "Escape") cancelBtn.click();
    });

    editRow.appendChild(titleInput);
    editRow.appendChild(saveBtn);
    editRow.appendChild(cancelBtn);
    nameWrap.appendChild(editRow);

    setTimeout(() => titleInput.focus(), 0);
  } else {
    const title = document.createElement("div");
    title.className = "card-title-display editable-hint";
    title.textContent = account.name;
    title.addEventListener("click", () => {
      account.isEditingTitle = true;
      renderAll();
    });

    const meta = document.createElement("div");
    meta.className = "card-meta";
    meta.textContent = `1 Lot = ${account.unitSize.toLocaleString("en-US")} Units`;

    const titleBox = document.createElement("div");
    titleBox.appendChild(title);
    titleBox.appendChild(meta);

    nameWrap.appendChild(titleBox);
  }

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const hideBtn = document.createElement("button");
  hideBtn.type = "button";
  hideBtn.className = "action-btn";
  hideBtn.textContent = "Hide";
  hideBtn.addEventListener("click", () => {
    account.visible = false;
    account.isEditingTitle = false;
    saveState();
    renderAll();
  });
  actions.appendChild(hideBtn);

  if (account.custom) {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "action-btn danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => {
      state.accounts = state.accounts.filter((a) => a.id !== account.id);
      saveState();
      renderAll();
    });
    actions.appendChild(deleteBtn);
  }

  header.appendChild(nameWrap);
  header.appendChild(actions);
  card.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "card-grid";

  const balanceInput = createBalanceInput(account);
  const riskInput = createRiskInput(account);

  const lossBox = createReadonlyBox("0");
  lossBox.dataset.role = "loss";

  grid.appendChild(createField("Balance", balanceInput));
  grid.appendChild(createField("Risk", riskInput));
  grid.appendChild(createField("Loss", lossBox));

  card.appendChild(grid);

  const results = document.createElement("div");
  results.className = "result-grid";

  const lotBox = document.createElement("div");
  lotBox.className = "result-item";

  const lotLabel = document.createElement("span");
  lotLabel.className = "result-label";
  lotLabel.textContent = "Lot Size";

  const lotValue = document.createElement("strong");
  lotValue.textContent = "-";
  lotValue.dataset.role = "lot";

  lotBox.appendChild(lotLabel);
  lotBox.appendChild(lotValue);
  results.appendChild(lotBox);

  card.appendChild(results);

  return card;
}

function updateCardResults(accountId) {
  const account = state.accounts.find((a) => a.id === accountId);
  const card = document.querySelector(`[data-account-id="${accountId}"]`);
  if (!account || !card) return;

  const balance = parseBalance(account.balanceRaw);
  const riskPercent = parseRisk(account.riskRaw);
  const lossAllowance = calculateLossAllowance(balance, riskPercent);

  const slDiff = getSlDiff();
  const lot = calculateLot(lossAllowance, slDiff, account.unitSize);
  const validation = getValidationState();

  const lossEl = card.querySelector('[data-role="loss"]');
  const lotEl = card.querySelector('[data-role="lot"]');

  const oldSlPipsItem = card.querySelector('[data-role="slPips"]')?.closest(".result-item");
  const oldTpPipsItem = card.querySelector('[data-role="tpPips"]')?.closest(".result-item");
  if (oldSlPipsItem) oldSlPipsItem.remove();
  if (oldTpPipsItem) oldTpPipsItem.remove();

  if (lossEl) {
    lossEl.textContent = lossAllowance > 0
      ? lossAllowance.toLocaleString("en-US", { maximumFractionDigits: 0 })
      : "0";
    lossEl.classList.toggle("is-muted", !validation.valid && lossAllowance === 0);
  }

  if (lotEl) {
    lotEl.textContent = validation.valid ? lot.toFixed(2) : "-";
    lotEl.closest(".result-item")?.classList.toggle("is-muted", !validation.valid);
    lotEl.closest(".result-item")?.classList.toggle("is-active", validation.valid);
  }
}

function updateAllCardResults() {
  state.accounts
    .filter((account) => account.visible)
    .forEach((account) => updateCardResults(account.id));
}

function renderCards() {
  const cardsRoot = el("cards");
  cardsRoot.innerHTML = "";

  state.accounts
    .filter((account) => account.visible)
    .forEach((account) => {
      const card = createCard(account);
      cardsRoot.appendChild(card);
    });

  updateAllCardResults();
}

function renderHiddenCards() {
  const hiddenSection = el("hidden-section");
  const list = el("hidden-cards-list");
  const hiddenAccounts = state.accounts.filter((account) => !account.visible);

  list.innerHTML = "";

  if (hiddenAccounts.length === 0) {
    hiddenSection.classList.add("hidden");
    return;
  }

  hiddenSection.classList.remove("hidden");

  hiddenAccounts.forEach((account) => {
    const chip = document.createElement("div");
    chip.className = "hidden-chip";

    const name = document.createElement("span");
    name.textContent = account.name;

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "restore-btn";
    restoreBtn.textContent = "Restore";
    restoreBtn.addEventListener("click", () => {
      account.visible = true;
      saveState();
      renderAll();
    });

    chip.appendChild(name);
    chip.appendChild(restoreBtn);
    list.appendChild(chip);
  });
}

function renderGlobalStats() {
  const validation = getValidationState();
  const slEl = el("global-sl-pips");
  const tpEl = el("global-tp-pips");
  const subtitleEl = document.querySelector(".subtitle");

  if (!slEl || !tpEl) return;

  slEl.textContent = validation.valid ? getSlPips().toFixed(1) : "0.0";
  tpEl.textContent = validation.valid ? getTpPips().toFixed(1) : "0.0";

  slEl.closest(".stat")?.classList.toggle("is-muted", !validation.valid);
  slEl.closest(".stat")?.classList.toggle("is-active", validation.valid);
  tpEl.closest(".stat")?.classList.toggle("is-muted", !validation.valid);
  tpEl.closest(".stat")?.classList.toggle("is-active", validation.valid);

  if (subtitleEl) {
    subtitleEl.textContent = validation.valid ? "" : validation.message;
    subtitleEl.classList.toggle("is-error-text", !validation.valid);
    subtitleEl.classList.toggle("is-success-text", false);
  }
}

function renderAll() {
  renderGlobalStats();
  renderCards();
  renderHiddenCards();
  updateAddButtonState();
}

function getDefaultCustomName(number) {
  return `Account ${number}`;
}

function getDefaultCustomNameFromId(id) {
  const match = String(id).match(/^custom-(\d+)$/);
  if (!match) return "";
  return getDefaultCustomName(Number(match[1]));
}

function getNextCustomNumber() {
  let n = 1;
  const existingNames = new Set(
    state.accounts.filter((a) => a.custom).map((a) => a.id)
  );
  while (existingNames.has(`custom-${n}`)) n += 1;
  return n;
}

function updateAddButtonState() {
  const btn = el("add-card-btn");
  if (!btn) return;

  const count = state.accounts.length;
  btn.disabled = count >= MAX_CARDS;
  btn.textContent = count >= MAX_CARDS ? "Limit Reached" : "+";
  btn.setAttribute("aria-label", count >= MAX_CARDS ? "Limit reached" : "Add account");
}

function addCustomCard() {
  if (state.accounts.length >= MAX_CARDS) return;

  const num = getNextCustomNumber();
  state.accounts.push({
    id: `custom-${num}`,
    name: getDefaultCustomName(num),
    unitSize: 100000,
    visible: true,
    custom: true,
    balanceRaw: "",
    riskRaw: ""
  });

  saveState();
  renderAll();
}

function updateSaveStatus(mode = "saved") {
  const statusEl = el("save-status");
  if (!statusEl) return;

  if (saveStatusTimer) {
    clearTimeout(saveStatusTimer);
    saveStatusTimer = null;
  }

  statusEl.classList.remove("is-saving", "is-saved", "is-hidden");

  if (mode === "saving") {
    statusEl.textContent = "Saving...";
    statusEl.classList.add("is-saving");
    return;
  }

  statusEl.textContent = "Saved";
  statusEl.classList.add("is-saved");

  saveStatusTimer = setTimeout(() => {
    statusEl.classList.add("is-hidden");
  }, 1400);
}

function triggerInputVibration() {
  if (!("vibrate" in navigator)) return;

  if (vibrateTimer) {
    clearTimeout(vibrateTimer);
    vibrateTimer = null;
  }

  vibrateTimer = setTimeout(() => {
    navigator.vibrate(8);
  }, 10);
}

function bindCommonInputs() {
  const entryInput = el("entry");
  const slInput = el("sl");
  const rrInput = el("rr");

  if (!entryInput || !slInput || !rrInput) return;

  entryInput.addEventListener("input", (event) => {
    const digits = sanitizeRateDigits(event.target.value);
    event.target.value = formatRateFromDigits(digits);
    triggerInputVibration();
    renderGlobalStats();
    updateAllCardResults();
  });

  slInput.addEventListener("input", (event) => {
    const digits = sanitizeRateDigits(event.target.value);
    event.target.value = formatRateFromDigits(digits);
    triggerInputVibration();
    renderGlobalStats();
    updateAllCardResults();
  });

  rrInput.value = state.rr;

  rrInput.addEventListener("input", (event) => {
    const normalized = normalizeRrInput(event.target.value);
    state.rr = normalized;
    event.target.value = normalized;
    updateSaveStatus("saving");
    triggerInputVibration();
    saveState();
    renderGlobalStats();
    updateAllCardResults();
  });

  rrInput.addEventListener("blur", (event) => {
    if (state.rr === "") {
      state.rr = "2.50";
    } else {
      state.rr = parseRr(state.rr).toFixed(2);
    }
    event.target.value = state.rr;
    saveState();
    renderGlobalStats();
    updateAllCardResults();
  });
}

function init() {
  bindCommonInputs();

  el("add-card-btn")?.addEventListener("click", addCustomCard);

  if (state.rr === "" || Number.isNaN(parseRr(state.rr))) {
    state.rr = "2.50";
  }

  if (el("rr")) {
    el("rr").value = state.rr;
  }

  renderAll();
  updateSaveStatus("saved");
}

init();