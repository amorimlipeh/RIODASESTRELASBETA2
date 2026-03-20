function limparDescricao(texto) {
  let s = String(texto || "").trim();

  s = s.replace(/\s+/g, " ");
  s = s.replace(/[|]+/g, " ");
  s = s.replace(/[_]+/g, " ");
  s = s.replace(/\bnew\b/gi, " ");
  s = s.replace(/\bhot sale\b/gi, " ");
  s = s.replace(/\bfactory\b/gi, " ");
  s = s.replace(/\bwholesale\b/gi, " ");
  s = s.replace(/\bready stock\b/gi, " ");
  s = s.replace(/\bmade in china\b/gi, " ");
  s = s.replace(/\bamazon\b/gi, " ");
  s = s.replace(/\bsku\b[:：]?\s*[a-z0-9-]+\b/gi, " ");
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

function detectarIdiomaProvavel(texto) {
  const s = String(texto || "");
  if (/[\u4e00-\u9fff]/.test(s)) return "zh";
  if (/[а-яА-Я]/.test(s)) return "ru";
  if (/[ぁ-ゟ゠-ヿ]/.test(s)) return "ja";
  if (/[가-힣]/.test(s)) return "ko";
  if (/[a-zA-Z]/.test(s)) return "en";
  return "desconhecido";
}

function padronizarFornecedor(fornecedor) {
  return String(fornecedor || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bco\.\b/gi, "Co")
    .replace(/\bltd\.\b/gi, "Ltd");
}

function normalizarCodigoProduto(codigo) {
  return String(codigo || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^\w\-./]/g, "")
    .toUpperCase();
}

function extrairFatorQC(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return Number.isFinite(valor) ? Math.max(0, Math.trunc(valor)) : 0;

  const s = String(valor).trim();

  const matchFrac = s.match(/(\d+)\s*[xX/*]\s*(\d+)/);
  if (matchFrac) {
    const a = Number(matchFrac[1]);
    const b = Number(matchFrac[2]);
    if (a > 0 && b > 0) return a * b;
  }

  const match = s.match(/-?\d+[.,]?\d*/);
  if (!match) return 0;

  const n = Number(match[0].replace(",", "."));
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function titleCasePt(texto) {
  const lowerWords = new Set([
    "de", "da", "do", "das", "dos", "e", "em", "para", "com"
  ]);

  return String(texto || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word, idx) => {
      if (idx > 0 && lowerWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function substituirTermos(texto) {
  let s = ` ${String(texto || "").toLowerCase()} `;

  const mapa = [
    [/ children socks | kids socks | baby socks | infant socks | socks child /g, " meia infantil "],
    [/ sock | socks /g, " meia "],
    [/ shoes | shoe /g, " sapato "],
    [/ slippers | slipper /g, " chinelo "],
    [/ sandal | sandals /g, " sandália "],
    [/ bag | bags /g, " bolsa "],
    [/ backpack | backpacks /g, " mochila "],
    [/ led strip | strip led | rgb strip /g, " fita led "],
    [/ light strip /g, " fita led "],
    [/ toy | toys /g, " brinquedo "],
    [/ kitchen /g, " cozinha "],
    [/ cup | cups /g, " copo "],
    [/ bottle | bottles /g, " garrafa "],
    [/ lunch box /g, " marmita "],
    [/ notebook cover /g, " capa de notebook "],
    [/ wireless /g, " sem fio "],
    [/ bluetooth /g, " bluetooth "],
    [/ charger /g, " carregador "],
    [/ cable /g, " cabo "],
    [/ cotton /g, " algodão "],
    [/ breathable /g, " respirável "],
    [/ soft /g, " macio "],
    [/ waterproof /g, " impermeável "],
    [/ stainless steel /g, " aço inox "],
    [/ mini /g, " mini "],
    [/ portable /g, " portátil "],
    [/ fashion /g, " moda "],
    [/ woman | women | female /g, " feminino "],
    [/ man | men | male /g, " masculino "],
    [/ infant | baby /g, " bebê "],
    [/ kids | child /g, " infantil "],
    [/ home /g, " casa "],
    [/ storage /g, " organizador "],
    [/ organizer /g, " organizador "],
    [/ box /g, " caixa "],
    [/ set /g, " kit "],
    [/ pcs /g, " peças "]
  ];

  for (const [regex, replacement] of mapa) {
    s = s.replace(regex, replacement);
  }

  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function priorizarEstrutura(texto) {
  const s = String(texto || "").trim();

  const categorias = [
    "meia infantil", "meia", "sapato", "chinelo", "sandália",
    "bolsa", "mochila", "fita led", "brinquedo", "copo", "garrafa",
    "marmita", "capa de notebook", "carregador", "cabo", "organizador", "caixa"
  ];

  let categoria = "";
  for (const c of categorias) {
    if (s.includes(c)) {
      categoria = c;
      break;
    }
  }

  const atributos = [];
  const possiveis = [
    "algodão", "respirável", "macio", "impermeável", "aço inox",
    "portátil", "sem fio", "bluetooth", "feminino", "masculino",
    "bebê", "infantil", "mini", "kit"
  ];

  for (const p of possiveis) {
    if (s.includes(p) && p !== categoria && !atributos.includes(p)) atributos.push(p);
  }

  const tamanho = s.match(/\b(\d{1,2}(?:\.\d{1,2})?\s?(?:cm|mm|m|ml|l|w))\b/i);
  if (tamanho && !atributos.includes(tamanho[1])) atributos.push(tamanho[1].toUpperCase());

  const metragem = s.match(/\b(\d{1,2}\s?m)\b/i);
  if (metragem && !atributos.includes(metragem[1])) atributos.push(metragem[1].toUpperCase());

  const cor = s.match(/\b(rgb|rosa|azul|preto|branco|verde|vermelho|amarelo)\b/i);
  if (cor && !atributos.includes(cor[1])) atributos.push(cor[1].toUpperCase());

  let nome = [categoria, ...atributos].filter(Boolean).join(" ").trim();
  if (!nome) nome = s;

  nome = nome.replace(/\s+/g, " ").trim();
  return titleCasePt(nome);
}

function gerarNomeComercial(textoTratado, options = {}) {
  let s = limparDescricao(textoTratado);

  if (!s) return "";

  s = substituirTermos(s);
  s = s.replace(/[^\p{L}\p{N}\s\-./]/gu, " ");
  s = s.replace(/\s+/g, " ").trim();

  let nome = priorizarEstrutura(s);

  if (nome.length > 80) {
    nome = nome.slice(0, 80).trim();
  }

  return nome;
}

module.exports = {
  limparDescricao,
  detectarIdiomaProvavel,
  padronizarFornecedor,
  normalizarCodigoProduto,
  extrairFatorQC,
  gerarNomeComercial
};
