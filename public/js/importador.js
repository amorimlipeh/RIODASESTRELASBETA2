(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const els = {
    arquivoInput: $("arquivo"),
    btnAnalisar: $("btn-analisar"),
    btnModal: $("btn-modal"),
    btnAplicar: $("btn-aplicar"),
    btnConfirmar: $("btn-confirmar"),
    btnCancelar: $("btn-cancelar"),
    btnFecharModal: $("btn-fechar-modal"),
    msgEl: $("msg"),
    abaSelect: $("aba-select"),
    pillTipo: $("pill-tipo"),
    pillTotal: $("pill-total"),
    pillAba: $("pill-aba"),
    previewConvertido: $("preview-convertido"),
    conflictsBody: $("conflicts-body"),
    modal: $("config-modal"),
    visibleColumns: $("visible-columns"),
    originalHead: $("original-head"),
    originalBody: $("original-body"),
    mapCodigo: $("map-codigo"),
    mapProduto: $("map-produto"),
    mapCaixas: $("map-caixas"),
    mapQuantidade: $("map-quantidade"),
    mapFator: $("map-fator"),
    mapImagem: $("map-imagem"),
    mapEndereco: $("map-endereco"),
    factorPolicy: $("factor-policy"),
    quantityMode: $("quantity-mode"),
    saveLayout: $("save-layout")
  };

  const state = {
    abas: [],
    activeSheetName: "",
    columns: [],
    visibleColumns: [],
    mapping: {},
    previewOriginal: { columns: [], items: [] },
    previewConvertido: [],
    conflitosFator: [],
    arquivoAtual: ""
  };

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m]));
  }

  function getStorage(key, fallback = "") {
    try {
      const value = localStorage.getItem(key);
      return value == null || value === "" ? fallback : value;
    } catch (_e) {
      return fallback;
    }
  }

  function getSessionHeaders(extra = {}) {
    return {
      "x-empresa": getStorage("rio_empresa", getStorage("empresa", "rio_das_estrelas")),
      "x-usuario": getStorage("rio_usuario", getStorage("usuario", "admin")),
      "x-cargo": getStorage("rio_cargo", getStorage("cargo", "admin")),
      ...extra
    };
  }

  async function parseJsonSafe(res) {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch (_e) {
      return { ok: false, erro: text || "Resposta inválida do servidor." };
    }
  }

  function normalizeJsonBody(body) {
    if (body === undefined || body === null) return body;
    if (typeof body === "string") {
      try {
        return JSON.parse(body);
      } catch (_e) {
        return body;
      }
    }
    return body;
  }

  async function requestJson(url, options = {}) {
    if (window.RioAPI && typeof window.RioAPI.apiJson === "function" && !(options.body instanceof FormData)) {
      const rioOptions = {
        ...options,
        body: normalizeJsonBody(options.body)
      };
      return window.RioAPI.apiJson(url, rioOptions);
    }

    if (window.RioAPI && typeof window.RioAPI.apiFormData === "function" && options.body instanceof FormData) {
      return window.RioAPI.apiFormData(url, options.body, options);
    }

    const headers = getSessionHeaders(options.headers || {});
    const res = await fetch(url, { ...options, headers });
    const data = await parseJsonSafe(res);

    if (res.status === 401) {
      setMsg("Usuário não autenticado. Faça login novamente.", false);
      throw new Error(data.erro || "Usuário não autenticado.");
    }

    if (!res.ok || data.ok === false) {
      throw new Error(data.erro || "Erro na requisição.");
    }

    return data;
  }

  function setMsg(text = "", ok = true) {
    if (!els.msgEl) return;
    els.msgEl.textContent = text;
    els.msgEl.className = `msg ${ok ? "ok" : "erro"}`;
  }

  function resetState() {
    state.abas = [];
    state.activeSheetName = "";
    state.columns = [];
    state.visibleColumns = [];
    state.mapping = {};
    state.previewOriginal = { columns: [], items: [] };
    state.previewConvertido = [];
    state.conflitosFator = [];
    state.arquivoAtual = "";
  }

  function setPills({ tipo = "-", total = 0, aba = "-" } = {}) {
    if (els.pillTipo) els.pillTipo.textContent = `Tipo: ${tipo}`;
    if (els.pillTotal) els.pillTotal.textContent = `Linhas: ${total}`;
    if (els.pillAba) els.pillAba.textContent = `Aba: ${aba}`;
  }

  function fillSelect(selectEl, columns = [], selected = "") {
    if (!selectEl) return;

    selectEl.innerHTML = "";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— não usar —";
    selectEl.appendChild(empty);

    columns.forEach((col) => {
      const opt = document.createElement("option");
      opt.value = col;
      opt.textContent = col;
      if (selected === col) opt.selected = true;
      selectEl.appendChild(opt);
    });
  }

  function fillMappingSelectors(columns = [], mapping = {}) {
    fillSelect(els.mapCodigo, columns, mapping.codigo || "");
    fillSelect(els.mapProduto, columns, mapping.produto || "");
    fillSelect(els.mapCaixas, columns, mapping.caixas || "");
    fillSelect(els.mapQuantidade, columns, mapping.quantidade || "");
    fillSelect(els.mapFator, columns, mapping.fator || "");
    fillSelect(els.mapImagem, columns, mapping.imagem || "");
    fillSelect(els.mapEndereco, columns, mapping.endereco || "");
  }

  function fillAbas(abas = [], active = "") {
    if (!els.abaSelect) return;

    els.abaSelect.innerHTML = "";

    if (!abas.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Sem abas detectadas";
      els.abaSelect.appendChild(opt);
      return;
    }

    abas.forEach((aba) => {
      const opt = document.createElement("option");
      opt.value = aba;
      opt.textContent = aba;
      if (aba === active) opt.selected = true;
      els.abaSelect.appendChild(opt);
    });
  }

  function renderVisibleColumns(columns = [], selected = []) {
    if (!els.visibleColumns) return;

    els.visibleColumns.innerHTML = "";

    columns.forEach((col) => {
      const wrapper = document.createElement("label");
      wrapper.className = "checkbox-item";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = col;
      cb.checked = selected.includes(col);

      const span = document.createElement("span");
      span.textContent = col;

      wrapper.appendChild(cb);
      wrapper.appendChild(span);
      els.visibleColumns.appendChild(wrapper);
    });
  }

  function getSelectedVisibleColumns() {
    if (!els.visibleColumns) return [];
    return Array.from(els.visibleColumns.querySelectorAll('input[type="checkbox"]:checked')).map((cb) => cb.value);
  }

  function renderOriginalPreview(previewOriginal = { columns: [], items: [] }, chosenColumns = []) {
    if (!els.originalHead || !els.originalBody) return;

    const cols = (Array.isArray(chosenColumns) && chosenColumns.length)
      ? chosenColumns
      : (Array.isArray(previewOriginal.columns) ? previewOriginal.columns : []);

    const items = Array.isArray(previewOriginal.items) ? previewOriginal.items : [];

    els.originalHead.innerHTML = `<tr>${cols.map((col) => `<th>${escapeHtml(col)}</th>`).join("")}</tr>`;

    if (!cols.length) {
      els.originalBody.innerHTML = `<tr><td colspan="1">Nenhuma coluna detectada.</td></tr>`;
      return;
    }

    if (!items.length) {
      els.originalBody.innerHTML = `<tr><td colspan="${Math.max(cols.length, 1)}">Nenhum dado original.</td></tr>`;
      return;
    }

    els.originalBody.innerHTML = items.map((row) => `
      <tr>
        ${cols.map((col) => `<td>${escapeHtml(row[col] ?? "")}</td>`).join("")}
      </tr>
    `).join("");
  }

  function renderConvertedPreview(preview = []) {
    if (!els.previewConvertido) return;

    if (!Array.isArray(preview) || !preview.length) {
      els.previewConvertido.innerHTML = `<tr><td colspan="7">Nenhum dado convertido.</td></tr>`;
      return;
    }

    els.previewConvertido.innerHTML = preview.map((item) => `
      <tr>
        <td>${escapeHtml(item.codigo || "")}</td>
        <td>${escapeHtml(item.produto || "")}</td>
        <td>${escapeHtml(String(item.caixas ?? 0))}</td>
        <td>${escapeHtml(String(item.quantidade ?? 0))}</td>
        <td>${escapeHtml(String(item.fator ?? item.fatorImportado ?? 0))}</td>
        <td>${escapeHtml(item.imagem || "")}</td>
        <td>${escapeHtml(item.endereco || "")}</td>
      </tr>
    `).join("");
  }

  function renderConflicts(conflicts = []) {
    if (!els.conflictsBody) return;

    if (!Array.isArray(conflicts) || !conflicts.length) {
      els.conflictsBody.innerHTML = `<tr><td colspan="4">Nenhum conflito encontrado.</td></tr>`;
      return;
    }

    els.conflictsBody.innerHTML = conflicts.map((item) => `
      <tr>
        <td>${escapeHtml(item.codigo || "")}</td>
        <td>${escapeHtml(item.produto || "")}</td>
        <td>${escapeHtml(String(item.fatorExistente || ""))}</td>
        <td>${escapeHtml(String(item.fatorImportado || ""))}</td>
      </tr>
    `).join("");
  }

  function syncStateFromResponse(data = {}) {
    state.abas = Array.isArray(data.abas) ? data.abas : [];
    state.activeSheetName = data.activeSheetName || "";
    state.columns = Array.isArray(data.columns) ? data.columns : [];
    state.visibleColumns = Array.isArray(data.visibleColumns) && data.visibleColumns.length
      ? data.visibleColumns
      : (Array.isArray(data.previewOriginal?.columns) ? data.previewOriginal.columns : []);
    state.mapping = data.mapping || {};
    state.previewOriginal = data.previewOriginal && typeof data.previewOriginal === "object"
      ? data.previewOriginal
      : { columns: [], items: [] };
    state.previewConvertido = Array.isArray(data.preview) ? data.preview : [];
    state.conflitosFator = Array.isArray(data.conflitosFator) ? data.conflitosFator : [];
    state.arquivoAtual = data.arquivo || state.arquivoAtual || "";

    fillAbas(state.abas, state.activeSheetName);
    fillMappingSelectors(state.columns, state.mapping);
    renderVisibleColumns(state.columns, state.visibleColumns);
    renderOriginalPreview(state.previewOriginal, state.visibleColumns);
    renderConvertedPreview(state.previewConvertido);
    renderConflicts(state.conflitosFator);

    setPills({
      tipo: data.tipo || "-",
      total: data.total || state.previewConvertido.length || 0,
      aba: state.activeSheetName || "-"
    });
  }

  function openModal() {
    if (els.modal) els.modal.style.display = "block";
  }

  function closeModal() {
    if (els.modal) els.modal.style.display = "none";
  }

  async function analisarArquivo() {
    const arquivo = els.arquivoInput?.files?.[0];

    if (!arquivo) {
      setMsg("Selecione um arquivo primeiro.", false);
      return;
    }

    setMsg("Analisando arquivo...", true);

    if (els.btnAnalisar) els.btnAnalisar.disabled = true;
    if (els.btnConfirmar) els.btnConfirmar.disabled = true;
    if (els.btnCancelar) els.btnCancelar.disabled = true;
    if (els.btnModal) els.btnModal.classList.add("hidden");

    try {
      const form = new FormData();
      form.append("arquivo", arquivo);

      const data = await requestJson("/api/importacao/analisar", {
        method: "POST",
        body: form
      });

      syncStateFromResponse(data);

      setMsg(
        `${data.mensagem || "Arquivo analisado com sucesso"}. ${data.total || 0} linha(s) detectada(s).`,
        true
      );

      if (els.btnModal) els.btnModal.classList.remove("hidden");
      if (els.btnConfirmar) els.btnConfirmar.disabled = !(Array.isArray(data.preview) && data.preview.length);
      if (els.btnCancelar) els.btnCancelar.disabled = false;
    } catch (err) {
      setMsg(err.message || "Falha ao analisar arquivo.", false);
      renderConvertedPreview([]);
      renderConflicts([]);
      renderOriginalPreview({ columns: [], items: [] }, []);
      setPills({ tipo: "-", total: 0, aba: "-" });
    } finally {
      if (els.btnAnalisar) els.btnAnalisar.disabled = false;
    }
  }

  async function trocarAba() {
    const novaAba = els.abaSelect?.value || "";
    if (!novaAba) return;

    try {
      const data = await requestJson(`/api/importacao/preview?sheetName=${encodeURIComponent(novaAba)}`, {
        method: "GET"
      });

      syncStateFromResponse(data);

      if (els.btnConfirmar) {
        els.btnConfirmar.disabled = !(Array.isArray(data.preview) && data.preview.length);
      }

      if (els.btnCancelar) els.btnCancelar.disabled = false;
      setMsg(`Pré-visualização atualizada para a aba ${novaAba}.`, true);
    } catch (err) {
      setMsg(err.message || "Erro ao trocar aba.", false);
    }
  }

  async function aplicarConfiguracao() {
    setMsg("Aplicando configuração...", true);
    if (els.btnAplicar) els.btnAplicar.disabled = true;

    try {
      const payload = {
        activeSheetName: els.abaSelect?.value || "",
        codigo: els.mapCodigo?.value || "",
        produto: els.mapProduto?.value || "",
        caixas: els.mapCaixas?.value || "",
        quantidade: els.mapQuantidade?.value || "",
        fator: els.mapFator?.value || "",
        imagem: els.mapImagem?.value || "",
        endereco: els.mapEndereco?.value || "",
        factorPolicy: els.factorPolicy?.value || "use_import_if_missing",
        quantityMode: els.quantityMode?.value || "prefer_total",
        saveLayout: !!els.saveLayout?.checked,
        visibleColumns: getSelectedVisibleColumns()
      };

      const data = await requestJson("/api/importacao/configurar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload
      });

      syncStateFromResponse(data);

      setMsg(
        data.layoutSaved
          ? "Configuração aplicada e layout salvo."
          : "Configuração aplicada com sucesso.",
        true
      );

      if (els.btnConfirmar) els.btnConfirmar.disabled = !(Array.isArray(data.preview) && data.preview.length);
      if (els.btnCancelar) els.btnCancelar.disabled = false;

      closeModal();
    } catch (err) {
      setMsg(err.message || "Erro ao aplicar configuração.", false);
    } finally {
      if (els.btnAplicar) els.btnAplicar.disabled = false;
    }
  }

  async function confirmarImportacao() {
    if (els.btnConfirmar?.disabled) return;

    if (els.btnConfirmar) {
      els.btnConfirmar.disabled = true;
      els.btnConfirmar.textContent = "Importando...";
    }

    if (els.btnCancelar) els.btnCancelar.disabled = true;
    setMsg("Confirmando importação...", true);

    try {
      const data = await requestJson("/api/importacao/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { updateRegisteredFactor: false }
      });

      setMsg(
        `${data.mensagem || "Importação confirmada com sucesso"}. ${data.importados || 0} item(ns) processado(s).`,
        true
      );

      if (els.btnConfirmar) els.btnConfirmar.textContent = "Importação concluída";

      setTimeout(() => {
        window.location.href = "/index.html";
      }, 1200);
    } catch (err) {
      setMsg(err.message || "Erro ao confirmar importação.", false);

      if (els.btnConfirmar) {
        els.btnConfirmar.disabled = false;
        els.btnConfirmar.textContent = "Confirmar importação";
      }

      if (els.btnCancelar) els.btnCancelar.disabled = false;
    }
  }

  async function cancelarImportacao() {
    if (els.btnCancelar) els.btnCancelar.disabled = true;

    try {
      await requestJson("/api/importacao/cancelar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: {}
      });

      resetState();

      if (els.arquivoInput) els.arquivoInput.value = "";

      fillAbas([], "");
      renderVisibleColumns([], []);
      renderConvertedPreview([]);
      renderConflicts([]);
      renderOriginalPreview({ columns: [], items: [] }, []);
      setPills({ tipo: "-", total: 0, aba: "-" });

      if (els.btnConfirmar) {
        els.btnConfirmar.disabled = true;
        els.btnConfirmar.textContent = "Confirmar importação";
      }

      if (els.btnCancelar) els.btnCancelar.disabled = true;
      if (els.btnModal) els.btnModal.classList.add("hidden");

      setMsg("Prévia cancelada com sucesso.", true);
      closeModal();
    } catch (err) {
      setMsg(err.message || "Erro ao cancelar.", false);
      if (els.btnCancelar) els.btnCancelar.disabled = false;
    }
  }

  function bindEvents() {
    if (els.btnModal) els.btnModal.addEventListener("click", openModal);
    if (els.btnFecharModal) els.btnFecharModal.addEventListener("click", closeModal);

    window.addEventListener("click", (e) => {
      if (e.target === els.modal) closeModal();
    });

    if (els.btnAnalisar) els.btnAnalisar.addEventListener("click", analisarArquivo);
    if (els.abaSelect) els.abaSelect.addEventListener("change", trocarAba);

    if (els.visibleColumns) {
      els.visibleColumns.addEventListener("change", () => {
        renderOriginalPreview(state.previewOriginal, getSelectedVisibleColumns());
      });
    }

    if (els.btnAplicar) els.btnAplicar.addEventListener("click", aplicarConfiguracao);
    if (els.btnConfirmar) els.btnConfirmar.addEventListener("click", confirmarImportacao);
    if (els.btnCancelar) els.btnCancelar.addEventListener("click", cancelarImportacao);
  }

  function bootstrapEmptyScreen() {
    setMsg("Selecione um arquivo para iniciar a análise.", true);
    setPills({ tipo: "-", total: 0, aba: "-" });
    fillAbas([], "");
    renderVisibleColumns([], []);
    renderOriginalPreview({ columns: [], items: [] }, []);
    renderConvertedPreview([]);
    renderConflicts([]);
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    bootstrapEmptyScreen();
  });
})();
