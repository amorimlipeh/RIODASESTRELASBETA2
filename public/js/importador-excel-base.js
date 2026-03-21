(function () {
  function htmlEscape(str = "") {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizarCabecalho(valor) {
    return String(valor || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cssSafeId(text) {
    return String(text).replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  function criarImportadorExcel(config) {
    const state = {
      arquivo: null,
      arquivoNome: "",
      headers: [],
      rows: [],
      visibleHeaders: new Set(),
      renamedHeaders: {},
      selectedRows: new Set(),
      pagina: 1,
      porPagina: 100,
      dragIndex: null,
      touchDragIndex: null,
      touchLongPressTimer: null,
      ctrlSelecting: false,
      touchRowSelecting: false,
      lastRowSelectionState: true,
      editingHeader: null,
      editingValue: "",
      map: Object.fromEntries(Object.keys(config.mapLabels).map(k => [k, ""]))
    };

    const els = {
      arquivoInput: document.getElementById("arquivoInput"),
      arquivoNome: document.getElementById("arquivoNome"),
      btnAnalisar: document.getElementById("btnAnalisar"),
      btnImportar: document.getElementById("btnImportar"),
      btnFiltro: document.getElementById("btnFiltro"),
      btnMapeamento: document.getElementById("btnMapeamento"),
      previewArea: document.getElementById("previewArea"),
      panelFiltro: document.getElementById("panelFiltro"),
      panelMapeamento: document.getElementById("panelMapeamento"),
      tbody: document.getElementById("tbody"),
      thead: document.getElementById("thead"),
      infoLinhas: document.getElementById("infoLinhas"),
      paginaInfo: document.getElementById("paginaInfo"),
      porPagina: document.getElementById("porPagina"),
      msgFinal: document.getElementById("msgFinal"),
      tableWrap: document.getElementById("tableWrap"),
      loadingModal: document.getElementById("loadingModal"),
      loadingText: document.getElementById("loadingText"),
      filterList: document.getElementById("filterList"),
      mappingList: document.getElementById("mappingList"),
      debugInfo: document.getElementById("debugInfo")
    };

    function displayHeader(header) {
      return state.renamedHeaders[header] || header;
    }

    function showDebug(obj) {
      if (!els.debugInfo) return;
      els.debugInfo.classList.remove("hidden");
      els.debugInfo.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
    }

    function hideDebug() {
      if (!els.debugInfo) return;
      els.debugInfo.classList.add("hidden");
      els.debugInfo.textContent = "";
    }

    function abrirLoading(texto = "Analisando planilha e preparando pré-visualização.") {
      if (els.loadingText) els.loadingText.textContent = texto;
      if (els.loadingModal) els.loadingModal.classList.remove("hidden");
    }

    function fecharLoading() {
      if (els.loadingModal) els.loadingModal.classList.add("hidden");
    }

    function abrirPreview() {
      els.previewArea.classList.remove("hidden");
    }

    function fecharPreview() {
      els.previewArea.classList.add("hidden");
    }

    function togglePanel(panel) {
      const panels = [els.panelFiltro, els.panelMapeamento];
      panels.forEach(p => {
        if (p !== panel) p.classList.add("hidden");
      });
      panel.classList.toggle("hidden");
    }

    function lerArquivoNoNavegador(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function (e) {
          try {
            const workbook = XLSX.read(e.target.result, { type: "array" });
            const aba = workbook.SheetNames[0];
            if (!aba) return reject(new Error("Nenhuma aba encontrada no arquivo."));

            const sheet = workbook.Sheets[aba];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

            if (!rows.length) {
              return reject(new Error("Arquivo sem linhas válidas."));
            }

            const headers = Object.keys(rows[0] || {}).filter(h => h !== "__excelRow");
            resolve({ rows, headers });
          } catch (err) {
            reject(err);
          }
        };

        reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
        reader.readAsArrayBuffer(file);
      });
    }

    function guessMap() {
      const lista = state.headers.map((h) => ({
        original: h,
        norm: normalizarCabecalho(h)
      }));

      function buscar(possibles = []) {
        const exato = lista.find((item) => possibles.includes(item.norm));
        if (exato) return exato.original;
        const parcial = lista.find((item) => possibles.some((p) => item.norm.includes(p)));
        return parcial ? parcial.original : "";
      }

      if ("codigo" in state.map) state.map.codigo ||= buscar(["codigo", "codigo do produto", "código", "item no", "sku", "ref", "id", "cod", "客人货号", "货号"]);
      if ("produto" in state.map) state.map.produto ||= buscar(["produto", "descricao", "descrição", "description", "nome", "item", "品名"]);
      if ("endereco" in state.map) state.map.endereco ||= buscar(["endereco", "endereço", "local", "location", "rua", "posicao", "posição"]);
      if ("quantidade" in state.map) state.map.quantidade ||= buscar(["quantidade", "qty", "qtd", "quantity", "estoque (un)", "estoque", "t.qty", "总数"]);
      if ("caixas" in state.map) state.map.caixas ||= buscar(["caixas", "ctns", "cartons", "box", "件数"]);
      if ("fator" in state.map) state.map.fator ||= buscar(["q/c", "fator", "qc", "factor", "装箱"]);
      if ("lote" in state.map) state.map.lote ||= buscar(["lote", "lot", "batch"]);
      if ("nf" in state.map) state.map.nf ||= buscar(["nf", "nota", "invoice"]);
      if ("fornecedor" in state.map) state.map.fornecedor ||= buscar(["fornecedor", "supplier", "vendor"]);
      if ("imagem" in state.map) state.map.imagem ||= buscar(["imagem", "picture", "image", "foto", "产品图片"]);
      if ("container" in state.map) state.map.container ||= buscar(["container", "contêiner", "conteiner"]);
    }

    function atualizarInfo() {
      els.infoLinhas.textContent = `${state.rows.length} linhas • ${state.selectedRows.size} selecionadas`;
    }

    function getVisibleColumns() {
      return state.headers.filter(h => state.visibleHeaders.has(h));
    }

    function getRowsPagina() {
      const ini = (state.pagina - 1) * state.porPagina;
      const fim = ini + state.porPagina;
      return state.rows.slice(ini, fim).map((row, idx) => ({ row, realIndex: ini + idx }));
    }

    function isChecked(realIndex) {
      return state.selectedRows.has(realIndex);
    }

    function toggleChecked(realIndex, checked) {
      if (checked) state.selectedRows.add(realIndex);
      else state.selectedRows.delete(realIndex);
      atualizarInfo();
    }

    function toggleHeaderVisibility(header, checked) {
      if (checked) state.visibleHeaders.add(header);
      else state.visibleHeaders.delete(header);
      renderTabela();
      renderFiltro();
    }

    function toggleTodasColunas(checked) {
      if (checked) state.visibleHeaders = new Set(state.headers);
      else state.visibleHeaders = new Set();
      renderTabela();
      renderFiltro();
    }

    function setMap(key, value) {
      state.map[key] = value;
      renderMapeamento();
    }

    function iniciarEdicaoCabecalho(header) {
      state.editingHeader = header;
      state.editingValue = displayHeader(header);
      renderTabela();
      setTimeout(() => {
        const input = document.getElementById(`rename-input-${cssSafeId(header)}`);
        if (input) {
          input.focus();
          input.select();
        }
      }, 0);
    }

    function atualizarValorEdicao(valor) {
      state.editingValue = valor;
    }

    function confirmarEdicaoCabecalho(header) {
      const texto = String(state.editingValue || "").trim();
      if (texto) state.renamedHeaders[header] = texto;
      else delete state.renamedHeaders[header];

      state.editingHeader = null;
      state.editingValue = "";
      renderTabela();
      renderFiltro();
      renderMapeamento();
    }

    function cancelarEdicaoCabecalho() {
      state.editingHeader = null;
      state.editingValue = "";
      renderTabela();
    }

    function onRenameKeydown(ev, header) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        confirmarEdicaoCabecalho(header);
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        cancelarEdicaoCabecalho();
      }
    }

    function renderHeaderContent(header) {
      const safe = String(header).replaceAll("'", "\\'");

      if (state.editingHeader === header) {
        return `
          <div class="rename-edit">
            <input
              id="rename-input-${cssSafeId(header)}"
              value="${htmlEscape(state.editingValue)}"
              oninput="__importador_atualizarValorEdicao(this.value)"
              onblur="__importador_confirmarEdicao('${safe}')"
              onkeydown="__importador_onRenameKeydown(event, '${safe}')"
            />
            <button class="icon-btn ok" type="button" onclick="__importador_confirmarEdicao('${safe}')">OK</button>
            <button class="icon-btn cancel" type="button" onclick="__importador_cancelarEdicao()">X</button>
            <span class="drag-handle">↕</span>
          </div>
        `;
      }

      return `
        <div class="th-check">
          <input class="chk" type="checkbox" checked onchange="__importador_toggleColuna('${safe}', this.checked)">
          <span class="rename-target" ondblclick="__importador_iniciarEdicao('${safe}')" title="Duplo clique para renomear">
            ${htmlEscape(displayHeader(header))}
          </span>
          <span class="drag-handle">↕</span>
        </div>
      `;
    }

    function renderFiltro() {
      els.filterList.innerHTML = state.headers.map(h => `
        <label class="filter-item">
          <input type="checkbox" class="chk" ${state.visibleHeaders.has(h) ? "checked" : ""} onchange="__importador_toggleColuna('${String(h).replaceAll("'", "\\'")}', this.checked)">
          <span>${htmlEscape(displayHeader(h))}</span>
        </label>
      `).join("");
    }

    function renderMapeamento() {
      let html = "";
      Object.keys(config.mapLabels).forEach((key) => {
        html += `
          <label class="map-item">
            <input type="radio" name="map_${key}" class="chk" ${state.map[key] === "" ? "checked" : ""} onclick="__importador_setMap('${key}', '')">
            <span>${config.mapLabels[key]}: não usar</span>
          </label>
        `;
        state.headers.forEach((h) => {
          html += `
            <label class="map-item">
              <input type="radio" name="map_${key}" class="chk" ${state.map[key] === h ? "checked" : ""} onclick="__importador_setMap('${key}', '${String(h).replaceAll("'", "\\'")}')">
              <span>${config.mapLabels[key]} → ${htmlEscape(displayHeader(h))}</span>
            </label>
          `;
        });
      });
      els.mappingList.innerHTML = html;
    }

    function renderTabela() {
      const rowsPagina = getRowsPagina();
      const columns = getVisibleColumns();
      const allVisible = state.headers.length > 0 && state.visibleHeaders.size === state.headers.length;

      els.thead.innerHTML = `
        <tr>
          <th style="width:52px">
            <input class="chk" type="checkbox" ${allVisible ? "checked" : ""} onchange="__importador_toggleTodasColunas(this.checked)">
          </th>
          ${columns.map((h) => `
            <th draggable="true"
                data-index="${state.headers.indexOf(h)}"
                ondragstart="__importador_onDragStart(event)"
                ondragover="__importador_onDragOver(event)"
                ondrop="__importador_onDrop(event)"
                ontouchstart="__importador_onTouchStartHeader(event)"
                ontouchmove="__importador_onTouchMoveHeader(event)"
                ontouchend="__importador_onTouchEndHeader()">
              ${renderHeaderContent(h)}
            </th>
          `).join("")}
        </tr>
      `;

      els.tbody.innerHTML = rowsPagina.map(({ row, realIndex }) => `
        <tr
          data-row-index="${realIndex}"
          onmousedown="__importador_rowMouseDown(event, ${realIndex})"
          onmouseenter="__importador_rowMouseEnter(event, ${realIndex})"
          ontouchstart="__importador_rowTouchStart(event, ${realIndex})"
          ontouchmove="__importador_rowTouchMove(event)"
          ontouchend="__importador_rowTouchEnd()">
          <td>
            <input class="chk" type="checkbox" ${isChecked(realIndex) ? "checked" : ""} onchange="__importador_toggleLinha(${realIndex}, this.checked)">
          </td>
          ${columns.map((h) => `<td>${htmlEscape(row[h] ?? "")}</td>`).join("")}
        </tr>
      `).join("");

      els.paginaInfo.textContent = `Página ${state.pagina}`;
      atualizarInfo();
    }

    function selecionarPagina() {
      getRowsPagina().forEach(({ realIndex }) => state.selectedRows.add(realIndex));
      renderTabela();
    }

    function desmarcarPagina() {
      getRowsPagina().forEach(({ realIndex }) => state.selectedRows.delete(realIndex));
      renderTabela();
    }

    function selecionarTodas() {
      state.selectedRows = new Set(state.rows.map((_, idx) => idx));
      renderTabela();
    }

    function desmarcarTodas() {
      state.selectedRows.clear();
      renderTabela();
    }

    function paginaAnterior() {
      if (state.pagina > 1) {
        state.pagina -= 1;
        renderTabela();
      }
    }

    function proximaPagina() {
      const totalPaginas = Math.max(1, Math.ceil(state.rows.length / state.porPagina));
      if (state.pagina < totalPaginas) {
        state.pagina += 1;
        renderTabela();
      }
    }

    function moverHorizontal(dir) {
      els.tableWrap.scrollLeft += dir * 240;
    }

    function irInicio() {
      els.tableWrap.scrollLeft = 0;
    }

    function irFim() {
      els.tableWrap.scrollLeft = els.tableWrap.scrollWidth;
    }

    function onDragStart(ev) {
      const th = ev.target.closest("th");
      state.dragIndex = Number(th?.dataset.index);
    }

    function onDragOver(ev) {
      ev.preventDefault();
    }

    function onDrop(ev) {
      ev.preventDefault();
      const th = ev.target.closest("th");
      const targetIndex = Number(th?.dataset.index);

      if (Number.isNaN(state.dragIndex) || Number.isNaN(targetIndex) || state.dragIndex === targetIndex) return;

      const arr = [...state.headers];
      const [item] = arr.splice(state.dragIndex, 1);
      arr.splice(targetIndex, 0, item);
      state.headers = arr;
      state.visibleHeaders = new Set(arr.filter(h => state.visibleHeaders.has(h)));
      state.dragIndex = null;
      renderTabela();
      renderFiltro();
      renderMapeamento();
    }

    function onTouchStartHeader(ev) {
      const th = ev.target.closest("th");
      if (!th) return;
      const idx = Number(th.dataset.index);
      clearTimeout(state.touchLongPressTimer);
      state.touchLongPressTimer = setTimeout(() => {
        state.touchDragIndex = idx;
      }, 250);
    }

    function onTouchMoveHeader(ev) {
      if (state.touchDragIndex == null) return;
      const touch = ev.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const th = target?.closest?.("th");
      if (!th) return;

      const targetIndex = Number(th.dataset.index);
      if (Number.isNaN(targetIndex) || targetIndex === state.touchDragIndex) return;

      const arr = [...state.headers];
      const [item] = arr.splice(state.touchDragIndex, 1);
      arr.splice(targetIndex, 0, item);
      state.headers = arr;
      state.visibleHeaders = new Set(arr.filter(h => state.visibleHeaders.has(h)));
      state.touchDragIndex = targetIndex;
      renderTabela();
      renderFiltro();
      renderMapeamento();
    }

    function onTouchEndHeader() {
      clearTimeout(state.touchLongPressTimer);
      state.touchDragIndex = null;
    }

    function rowMouseDown(ev, realIndex) {
      if (!ev.ctrlKey) return;
      state.ctrlSelecting = true;
      state.lastRowSelectionState = !state.selectedRows.has(realIndex);
      toggleChecked(realIndex, state.lastRowSelectionState);
      renderTabela();
    }

    function rowMouseEnter(_ev, realIndex) {
      if (!state.ctrlSelecting) return;
      toggleChecked(realIndex, state.lastRowSelectionState);
      const checkbox = els.tbody.querySelector(`tr[data-row-index="${realIndex}"] input.chk`);
      if (checkbox) checkbox.checked = state.lastRowSelectionState;
    }

    function rowTouchStart(_ev, realIndex) {
      clearTimeout(state.touchLongPressTimer);
      state.touchLongPressTimer = setTimeout(() => {
        state.touchRowSelecting = true;
        state.lastRowSelectionState = !state.selectedRows.has(realIndex);
        toggleChecked(realIndex, state.lastRowSelectionState);
        renderTabela();
      }, 250);
    }

    function rowTouchMove(ev) {
      if (!state.touchRowSelecting) return;
      const touch = ev.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const tr = target?.closest?.("tr[data-row-index]");
      if (!tr) return;
      const idx = Number(tr.dataset.rowIndex);
      toggleChecked(idx, state.lastRowSelectionState);
      const checkbox = tr.querySelector("input.chk");
      if (checkbox) checkbox.checked = state.lastRowSelectionState;
    }

    function rowTouchEnd() {
      clearTimeout(state.touchLongPressTimer);
      state.touchRowSelecting = false;
    }

    document.addEventListener("mouseup", () => {
      state.ctrlSelecting = false;
    });

    document.addEventListener("touchend", () => {
      state.touchRowSelecting = false;
      clearTimeout(state.touchLongPressTimer);
    });

    async function analisar() {
      if (!state.arquivo) {
        alert("Selecione um arquivo primeiro.");
        return;
      }

      hideDebug();
      els.btnAnalisar.disabled = true;
      els.btnAnalisar.textContent = "Analisando...";
      abrirLoading();

      try {
        const data = await lerArquivoNoNavegador(state.arquivo);

        state.rows = data.rows;
        state.headers = data.headers;
        state.visibleHeaders = new Set(state.headers);
        state.renamedHeaders = {};
        state.selectedRows = new Set(state.rows.map((_, idx) => idx));
        state.pagina = 1;
        state.editingHeader = null;
        state.editingValue = "";

        if (!state.rows.length || !state.headers.length) {
          throw new Error("Arquivo vazio ou sem cabeçalhos válidos.");
        }

        guessMap();
        renderTabela();
        renderFiltro();
        renderMapeamento();
        abrirPreview();
      } catch (err) {
        console.error(err);
        showDebug(err.message || String(err));
        alert(err.message || config.analyzeErrorText);
      } finally {
        fecharLoading();
        els.btnAnalisar.disabled = false;
        els.btnAnalisar.textContent = "Analisar";
      }
    }

    async function importar() {
      const itens = Array.from(state.selectedRows).map(i => state.rows[i]).filter(Boolean);
      if (!itens.length) {
        alert("Nenhum item selecionado.");
        return;
      }

      els.btnImportar.disabled = true;
      els.btnImportar.textContent = config.importButtonLoadingText;
      abrirLoading("Importando itens selecionados...");

      try {
        const res = await fetch(config.importEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            arquivo: state.arquivoNome,
       
