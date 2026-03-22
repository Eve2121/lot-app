const MAX_CARDS = 10;

const FIXED_ACCOUNTS = [
  { id: "fintokei", name: "Fintokei", unitSize: 100000, visible: true, custom: false },
  { id: "vantage", name: "Vantage", unitSize: 100000, visible: true, custom: false },
  { id: "lion", name: "Lion", unitSize: 1000, visible: true, custom: false },
  { id: "gmo", name: "GMO", unitSize: 10000, visible: true, custom: false }
];

const STORAGE_KEY = "lotcalc_state_v2";

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
}

function sanitizeDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function sanitizeDecimal(value) {
  return String(value || "").replace(/[^\d.]/g, "");
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
  return parseRateDigitsToNumber(sanitizeRateDigits(el("entry").value));
}

function getSlValue() {
  return parseRateDigitsToNumber(sanitizeRateDigits(el("sl").value));
}

function getSlDiff() {
  const entry = getEntryValue();
  const sl = getSlValue();
  if (!entry || !sl) return 0;
  return Math.abs(entry - sl);
}

function getSlPips() {
  return getSlDiff() * 100;
}

function getTpPips() {
  return getSlPips() * parseRr(state.rr);
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

function renderCards() {
  const cardsRoot = el("cards");
  cardsRoot.innerHTML = "";

  state.accounts
    .filter((account) => account.visible)
    .forEach((account) => {
      const card = document.createElement("section");
      card.className = "card";

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
        saveBtn.textContent = "保存";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "title-cancel-btn";
        cancelBtn.textContent = "取消";

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
        meta.textContent = `1ロット = ${account.unitSize.toLocaleString("en-US")}通貨`;

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
      hideBtn.textContent = "非表示";
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
        deleteBtn.textContent = "削除";
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

      const balanceInput = document.createElement("input");
      balanceInput.type = "text";
      balanceInput.inputMode = "numeric";
      balanceInput.autocomplete = "off";
      balanceInput.placeholder = "1,000,000";
      balanceInput.value = formatNumberWithCommasFromDigits(account.balanceRaw);
      balanceInput.addEventListener("input", (event) => {
        const digits = sanitizeDigits(event.target.value);
        account.balanceRaw = digits;
        event.target.value = formatNumberWithCommasFromDigits(digits);
        saveState();
        renderAll();
      });

      const riskInput = document.createElement("input");
      riskInput.type = "text";
      riskInput.inputMode = "decimal";
      riskInput.autocomplete = "off";
      riskInput.placeholder = "1.00";
      riskInput.value = account.riskRaw;
      riskInput.addEventListener("input", (event) => {
        const normalized = normalizeRiskInput(event.target.value);
        account.riskRaw = normalized;
        event.target.value = normalized;
        saveState();
        renderAll();
      });
      riskInput.addEventListener("blur", (event) => {
        const num = parseRisk(account.riskRaw);
        account.riskRaw = account.riskRaw === "" ? "" : num.toFixed(2);
        event.target.value = account.riskRaw;
        saveState();
        renderAll();
      });

      const balance = parseBalance(account.balanceRaw);
      const riskPercent = parseRisk(account.riskRaw);
      const lossAllowance = calculateLossAllowance(balance, riskPercent);

      grid.appendChild(createField("口座残高", balanceInput));
      grid.appendChild(createField("リスク%", riskInput));
      grid.appendChild(
        createField(
          "損失許容額",
          createReadonlyBox(lossAllowance > 0 ? lossAllowance.toLocaleString("en-US", {
            maximumFractionDigits: 0
          }) : "0")
        )
      );

      card.appendChild(grid);

      const slDiff = getSlDiff();
      const slPips = getSlPips();
      const tpPips = getTpPips();
      const lot = calculateLot(lossAllowance, slDiff, account.unitSize);

      const results = document.createElement("div");
      results.className = "result-grid";

      const resultItems = [
        { label: "ロット数", value: lot.toFixed(2) },
        { label: "SL pips", value: slPips.toFixed(1) },
        { label: "TP pips", value: tpPips.toFixed(1) }
      ];

      resultItems.forEach((item) => {
        const box = document.createElement("div");
        box.className = "result-item";

        const label = document.createElement("span");
        label.className = "result-label";
        label.textContent = item.label;

        const strong = document.createElement("strong");
        strong.textContent = item.value;

        box.appendChild(label);
        box.appendChild(strong);
        results.appendChild(box);
      });

      card.appendChild(results);
      cardsRoot.appendChild(card);
    });
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
    restoreBtn.textContent = "再表示";
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
  el("global-sl-pips").textContent = getSlPips().toFixed(1);
  el("global-tp-pips").textContent = getTpPips().toFixed(1);
}

function renderAll() {
  renderGlobalStats();
  renderCards();
  renderHiddenCards();
  updateAddButtonState();
}

function getCustomAccountsCount() {
  return state.accounts.filter((account) => account.custom).length;
}

function getDefaultCustomName(number) {
  return `追加口座${number}`;
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
  const count = state.accounts.length;
  btn.disabled = count >= MAX_CARDS;
  btn.textContent = count >= MAX_CARDS ? "追加上限です" : "＋ カード追加";
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

function bindCommonInputs() {
  const entryInput = el("entry");
  const slInput = el("sl");
  const rrInput = el("rr");

  entryInput.addEventListener("input", (event) => {
    const digits = sanitizeRateDigits(event.target.value);
    event.target.value = formatRateFromDigits(digits);
    renderAll();
  });

  slInput.addEventListener("input", (event) => {
    const digits = sanitizeRateDigits(event.target.value);
    event.target.value = formatRateFromDigits(digits);
    renderAll();
  });

  rrInput.value = state.rr;
  rrInput.addEventListener("input", (event) => {
    const normalized = normalizeRrInput(event.target.value);
    state.rr = normalized;
    event.target.value = normalized;
    saveState();
    renderAll();
  });

  rrInput.addEventListener("blur", (event) => {
    if (state.rr === "") {
      state.rr = "2.50";
    } else {
      state.rr = parseRr(state.rr).toFixed(2);
    }
    event.target.value = state.rr;
    saveState();
    renderAll();
  });

  if (state.rr !== "") {
    rrInput.value = state.rr;
  }
}

function init() {
  bindCommonInputs();

  el("add-card-btn").addEventListener("click", addCustomCard);

  if (state.rr === "" || Number.isNaN(parseRr(state.rr))) {
    state.rr = "2.50";
  }

  renderAll();
}

init();