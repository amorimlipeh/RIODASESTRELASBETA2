module.exports = function gerarMapa(estoque = [], config = {}) {
  const ruas = Number(config?.armazem?.ruas || 7);
  const posicoes = Number(config?.armazem?.posicoes || 140);
  const andares = Number(config?.armazem?.andares || 7);

  const ocupacao = {};
  for (const item of estoque) {
    const endereco = String(item.endereco || "").trim();
    if (!endereco) continue;
    ocupacao[endereco] = {
      codigo: item.codigo || "",
      produto: item.produto || item.nome || "",
      quantidade: Number(item.quantidade || item.unidades || 0),
      caixas: Number(item.caixas || 0)
    };
  }

  const mapa = [];
  for (let r = 1; r <= ruas; r++) {
    const rua = String(r).padStart(2, "0");
    const ruaObj = { rua, posicoes: [] };

    for (let p = 1; p <= posicoes; p++) {
      const pos = String(p).padStart(3, "0");
      const posObj = { posicao: pos, andares: [] };

      for (let a = 1; a <= andares; a++) {
        const endereco = `${rua}-${pos}-${a}-1`;
        posObj.andares.push({
          endereco,
          ocupado: !!ocupacao[endereco],
          item: ocupacao[endereco] || null
        });
      }

      ruaObj.posicoes.push(posObj);
    }

    mapa.push(ruaObj);
  }

  return {
    ok: true,
    resumo: {
      ruas,
      posicoes,
      andares,
      totalEnderecos: ruas * posicoes * andares
    },
    mapa
  };
};
