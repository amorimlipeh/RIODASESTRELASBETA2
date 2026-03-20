const fs = require("fs");

let CACHE = {};
let CACHE_FILE = "";

function carregarCacheTraducoes(filePath) {
  CACHE_FILE = filePath;
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      CACHE = raw ? JSON.parse(raw) : {};
    } else {
      CACHE = {};
    }
  } catch (err) {
    console.error("Erro carregando cache de traduções:", err.message);
    CACHE = {};
  }
}

function salvarCache() {
  if (!CACHE_FILE) return;
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(CACHE, null, 2), "utf8");
  } catch (err) {
    console.error("Erro salvando cache de traduções:", err.message);
  }
}

function keyCache(texto, fornecedor = "") {
  return `${String(fornecedor || "").trim().toLowerCase()}::${String(texto || "").trim().toLowerCase()}`;
}

function traduzirChinesLocal(texto) {
  let s = ` ${String(texto || "")} `;

  const mapa = [
    [/儿童/g, " infantil "],
    [/婴儿/g, " bebê "],
    [/宝宝/g, " bebê "],
    [/袜子/g, " meia "],
    [/鞋/g, " sapato "],
    [/拖鞋/g, " chinelo "],
    [/凉鞋/g, " sandália "],
    [/包/g, " bolsa "],
    [/背包/g, " mochila "],
    [/玩具/g, " brinquedo "],
    [/厨房/g, " cozinha "],
    [/杯/g, " copo "],
    [/水瓶/g, " garrafa "],
    [/饭盒/g, " marmita "],
    [/数据线/g, " cabo "],
    [/充电器/g, " carregador "],
    [/无线/g, " sem fio "],
    [/蓝牙/g, " bluetooth "],
    [/棉/g, " algodão "],
    [/柔软/g, " macio "],
    [/透气/g, " respirável "],
    [/防水/g, " impermeável "],
    [/不锈钢/g, " aço inox "],
    [/便携/g, " portátil "],
    [/套装/g, " kit "],
    [/收纳/g, " organizador "],
    [/盒/g, " caixa "],
    [/灯带/g, " fita led "],
    [/彩灯/g, " luz colorida "],
    [/米/g, " m "]
  ];

  for (const [regex, replacement] of mapa) {
    s = s.replace(regex, replacement);
  }

  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function traduzirInglesLocal(texto) {
  let s = ` ${String(texto || "").toLowerCase()} `;

  const mapa = [
    [/children socks|kids socks|baby socks|infant socks/g, " meia infantil "],
    [/socks|sock/g, " meia "],
    [/shoes|shoe/g, " sapato "],
    [/slippers|slipper/g, " chinelo "],
    [/sandals|sandal/g, " sandália "],
    [/bag|bags/g, " bolsa "],
    [/backpack|backpacks/g, " mochila "],
    [/toy|toys/g, " brinquedo "],
    [/kitchen/g, " cozinha "],
    [/cup|cups/g, " copo "],
    [/bottle|bottles/g, " garrafa "],
    [/lunch box/g, " marmita "],
    [/wireless/g, " sem fio "],
    [/bluetooth/g, " bluetooth "],
    [/charger/g, " carregador "],
    [/cable/g, " cabo "],
    [/cotton/g, " algodão "],
    [/soft/g, " macio "],
    [/breathable/g, " respirável "],
    [/waterproof/g, " impermeável "],
    [/stainless steel/g, " aço inox "],
    [/portable/g, " portátil "],
    [/set/g, " kit "],
    [/storage/g, " organizador "],
    [/organizer/g, " organizador "],
    [/box/g, " caixa "],
    [/led strip|light strip|rgb strip/g, " fita led "],
    [/women|woman|female/g, " feminino "],
    [/men|man|male/g, " masculino "],
    [/baby|infant/g, " bebê "],
    [/kids|child/g, " infantil "],
    [/pcs/g, " peças "]
  ];

  for (const [regex, replacement] of mapa) {
    s = s.replace(regex, replacement);
  }

  s = s.replace(/\s+/g, " ").trim();
  return s;
}

async function traduzirTexto(texto, options = {}) {
  const original = String(texto || "").trim();
  const fornecedor = String(options.fornecedor || "").trim();
  const idioma = String(options.idioma || "").trim();

  if (!original) return "";

  const cacheKey = keyCache(original, fornecedor);
  if (CACHE[cacheKey]) return CACHE[cacheKey];

  let traduzido = original;

  if (/[\u4e00-\u9fff]/.test(original) || idioma === "zh") {
    traduzido = traduzirChinesLocal(original);
  } else {
    traduzido = traduzirInglesLocal(original);
  }

  traduzido = traduzido
    .replace(/\s+/g, " ")
    .replace(/[|]+/g, " ")
    .trim();

  CACHE[cacheKey] = traduzido;
  salvarCache();

  return traduzido;
}

module.exports = {
  carregarCacheTraducoes,
  traduzirTexto
};
