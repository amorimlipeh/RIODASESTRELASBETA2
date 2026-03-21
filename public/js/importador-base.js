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

  function criarImportador(config) {
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
      selectingMode: false,
      lastRowSelectionState: true,
      map: {},
      ctrlSelecting: false,
      touchRowSelecting: false
    };

    const els = {
      arquivoInput: document.getElementById("arquivoInput"),
      arquivoNome: document.getElementById("arquivoNome"),
      btnAnalisar: document.getElementById("btnAnalisar"),
      btnImportar: document.getElementById("btnImportar"),
      btnFiltro: document.getElementById("btnFiltro"),
      btnMapeamento: document.getElementById("btnMapeamento"),
      btnRenomear: document.getElementById("btnRenomear"),
      tbody: document.getElementById("tbody"),
      thead: document.getElementById("thead"),
      infoLinhas: document.getElementById("infoLinhas"),
      paginaInfo: document.getElementById("paginaInfo"),
      porPagina: document.getElementById("porPagina"),
      msgFinal: document.getElementById("msgFinal"),
      tableWrap: document.getElementById("tableWrap"),
      loadingModal: document.getElementById("loadingModal"),
      previewModal: document.getElementById("previewModal"),
      filterModal: document.getElementById("filterModal"),
      mapModal: document.getElementById("mapModal"),
      renameModal: document.getElementById("renameModal"),
      filterList: document.getElementById("filterList"),
      mappingList: document.getElementById("mappingList"),
      renameList: document.getElementById("renameList"),
      loadingText: document.getElementById("loadingText"),
      debugInfo: document.getElementById("debugInfo")
    };

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
      els.loadingModal.classList.remove("hidden");
    }

    function fecharLoading() {
      els.loadingModal.classList.add("hidden");
    }

    function abrirPreview() {
      els.previewModal.classList.remove("hidden");
    }

    function fecharPreview() {
      els.previewModal.classList.add("hidden");
    }

    function abrirFiltro() {
      renderFiltro();
      els.filterModal.classList.remove("hidden");
    }

    function fecharFiltro() {
      els.filterModal.classList.add("hidden");
    }

    function abrirMapeamento() {
      renderMapeamento();
      els.mapModal.classList.remove("hidden");
    }

    function fecharMapeamento() {
      els.mapModal.classList.add("hidden");
    }

    function abrirRenomear() {
      renderRenomear();
      els.renameModal.classList.remove("hidden");
    }

    function fecharRenomear() {
      els.renameModal.classList.add("hidden");
    }

    function normalizeApiPayload(data) {
      let rows = [];
      let headers = [];

      if (Array.isArray(data?.dados) && data.dados.length) {
        rows = data.dados;
      } else if (Array.isArray(data?.itens) && data.itens.length) {
        rows = data.itens;
      } else if (Array.isArray(data?.planilhas?.[data?.abas?.[0]]) && data.planilhas[data.abas[0]].length) {
        rows = data.planilhas[data.abas[0]];
      }

      if (Array.isArray(data?.colunas) && data.colunas.length) {
        headers = data.colunas;
      } else if (data?.metadados && data?.abas && data.abas[0] && Array.isArray(data.metadados[data.abas[0]]?.cabecalhos)) {
        headers = data.metadados[data.abas[0]].cabecalhos;
      } else if (rows.length) {
        headers = Object.keys(rows[0]);
      }

      headers = headers.filter(h => h !== "__excelRow");
      return { rows, headers };
    }

    function guessMap() {
      const headers = state.headers;
      const lista = headers.map((h) => ({
        original: h,
        norm: normalizarCabecalho(h)
      }));

      function buscar(possibles = []) {
        const exato = lista.find((item) => possibles.includes(item.norm));
        if (exato) return exato.original;
        const parcial = lista.find((item) => possibles.some((p) => item.norm.includes(p)));
        return parcial ? parcial.original : "";
      }

      Object.keys(config.mapLabels).forEach((key) => {
        if (state.map[key]) return;
      });

      if ("codigo" in config.mapLabels) state.map.codigo ||= buscar(["codigo", "codigo do produto", "código", "item no", "sku", "ref", "id", "cod", "客人货号", "货号"]);
      if ("produto" in config.mapLabels) state.map.produto ||= buscar(["produto", "descricao", "descrição", "description", "nome", "item", "produto descricao", "品名"]);
      if ("endereco" in config.mapLabels) state.map.endereco ||= buscar(["endereco", "endereço", "local", "location", "rua", "posicao", "posição"]);
      if ("quantidade" in config.mapLabels) state.map.quantidade ||= buscar(["quantidade", "qty", "qtd", "quantity", "estoque (un)", "estoque", "t.qty", "总数"]);
      if ("caixas" in config.mapLabels) state.map.caixas ||= buscar(["caixas", "ctns", "cartons", "box", "件数"]);
      if ("fator" in config.mapLabels) state.map.fator ||= buscar(["q/c", "fator", "qc", "factor", "装箱"]);
      if ("lote" in config.mapLabels) state.map.lote ||= buscar(["lote", "lot", "batch"]);
      if ("nf" in config.mapLabels) state.map.nf ||= buscar(["nf", "nota", "invoice"]);
      if ("fornecedor" in config.mapLabels) state.map.fornecedor ||= buscar(["fornecedor", "supplier", "vendor"]);
      if ("imagem" in config.mapLabels) state.map.imagem ||= buscar(["imagem", "picture", "image", "foto", "产品图片"]);
      if ("container" in config.mapLabels) state.map.container ||= buscar(["container", "contêiner", "conteiner"]);
    }

    function displayHeader(header) {
      return state.renamedHeaders[header] || header;
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

    function atualizarInfo() {
      els.infoLinhas.textContent = `${state.rows.length} linhas • ${state.selectedRows.size} selecionadas`;
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
      renderTabela();
      renderMapeamento();
    }

    function renameHeader(header, value) {
      const texto = String(value || "").trim();
      if (texto) state.renamedHeaders[header] = texto;
      else delete state.renamedHeaders[header];
      renderTabela();
      renderRenomear();
      renderFiltro();
      renderMapeamento();
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
          <label class="filter-item">
            <input type="radio" name="map_${key}" class="chk" ${state.map[key] === "" ? "checked" : ""} onclick="__importador_setMap('${key}', '')">
            <span>${config.mapLabels[key]}: não usar</span>
          </label>
        `;
        state.headers.forEach((h) => {
          html += `
            <label class="filter-item">
              <input type="radio" name="map_${key}" class="chk" ${state.map[key] === h ? "checked" : ""} onclick="__importador_setMap('${key}', '${String(h).replaceAll("'", "\\'")}')">
              <span>${config.mapLabels[key]} → ${htmlEscape(displayHeader(h))}</span>
            </label>
          `;
        });
      });
      els.mappingList.innerHTML = html;
    }

    function renderRenomear() {
      els.renameList.innerHTML = state.headers.map(h => `
        <div class="rename-item">
          <div class="rename-label">${htmlEscape(h)}</div>
          <input
            class="rename-input"
            type="text"
            value="${htmlEscape(displayHeader(h))}"
            oninput="__importador_renameHeader('${String(h).replaceAll("'", "\\'")}', this.value)"
            placeholder="Novo nome da coluna"
          />
        </div>
      `).join("");
    }

    function getImageHtml(row) {
      const selectedHeader = state.map.imagem;
      const value =
        row.imagem || row.Imagem || row.IMAGEM ||
        row.image || row.Image || row.IMAGE ||
        row.picture || row.Picture || row.PICTURE ||
        (selectedHeader ? row[selectedHeader] : "");

      const codigoHeader = state.map.codigo;
      const codigo = codigoHeader ? row[codigoHeader] : row["ITEM NO"] || row.codigo || "";

      if (value && String(value).trim()) {
        let src = String(value).trim();
        if (!src.startsWith("http") && !src.startsWith("/uploads") && !src.startsWith("data:image")) {
          src = `/uploads/produtos/${src}`;
        }
        return `<img class="img-thumb" src="${htmlEscape(src)}" alt="imagem" onerror="this.outerHTML='<span class=&quot;sem-img&quot;>Sem imagem</span>'">`;
      }

      if (codigo) {
        const fallback = `/uploads/produtos/${encodeURIComponent(String(codigo).trim())}.png`;
        return `<img class="img-thumb" src="${htmlEscape(fallback)}" alt="imagem" onerror="this.outerHTML='<span class=&quot;sem-img&quot;>Sem imagem</span>'">`;
      }

      return `<span class="sem-img">Sem imagem</span>`;
    }

    function renderCell(header, row) {
      if (state.map.imagem && header === state.map.imagem) {
        return `<td>${getImageHtml(row)}</td>`;
      }
      return `<td>${htmlEscape(row[header] ?? "")}</td>`;
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
                ontouchend="__importador_onTouchEndHeader(event)"
                ontouchmove="__importador_onTouchMoveHeader(event)">
              <div class="th-check">
                <input class="chk" type="checkbox" checked onchange="__importador_toggleColuna('${String(h).replaceAll("'", "\\'")}', this.checked)">
                <span>${htmlEscape(displayHeader(h))}</span>
                <span class="drag-handle">↕</span>
              </div>
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
          ontouchend="__importador_rowTouchEnd(event)">
          <td>
            <input class="chk" type="checkbox" ${isChecked(realIndex) ? "checked" : ""} onchange="__importador_toggleLinha(${realIndex}, this.checked)">
          </td>
          ${columns.map((h) => renderCell(h, row)).join("")}
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
      renderRenomear();
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
      renderRenomear();
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

    function rowMouseEnter(ev, realIndex) {
      if (!state.ctrlSelecting) return;
      toggleChecked(realIndex, state.lastRowSelectionState);
      const checkbox = els.tbody.querySelector(`tr[data-row-index="${realIndex}"] input.chk`);
      if (checkbox) checkbox.checked = state.lastRowSelectionState;
    }

    function rowTouchStart(ev, realIndex) {
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
        const fd = new FormData();
        fd.append("arquivo", state.arquivo);
        fd.append("file", state.arquivo);

        const res = await fetch(config.analyzeEndpoint, {
          method: "POST",
          body: fd
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.erro || data.detalhe || config.analyzeErrorText);

        const payload = normalizeApiPayload(data);
        state.rows = payload.rows;
        state.headers = payload.headers;
        state.visibleHeaders = new Set(state.headers);
        state.renamedHeaders = {};
        state.selectedRows = new Set(state.rows.map((_, idx) => idx));
        state.pagina = 1;

        if (!state.rows.length || !state.headers.length) {
          showDebug(data);
          throw new Error("Arquivo vazio ou retorno sem dados reconhecíveis.");
        }

        guessMap();
        renderTabela();
        renderFiltro();
        renderMapeamento();
        renderRenomear();
        abrirPreview();
      } catch (err) {
        cons
