module.exports = function gerarInventario(estoque = []) {
  const totalItens = estoque.length;
  const totalUnidades = estoque.reduce((sum, item) => sum + Number(item.quantidade || item.unidades || 0), 0);
  const totalCaixas = estoque.reduce((sum, item) => sum + Number(item.caixas || 0), 0);

  const porEndereco = estoque.reduce((acc, item) => {
    const endereco = String(item.endereco || "SEM_ENDERECO").trim() || "SEM_ENDERECO";
    acc[endereco] = (acc[endereco] || 0) + Number(item.quantidade || item.unidades || 0);
    return acc;
  }, {});

  const itens = estoque.map((item) => ({
    id: item.id,
    codigo: item.codigo || "",
    produto: item.produto || item.nome || "",
    endereco: item.endereco || "",
    caixas: Number(item.caixas || 0),
    quantidade: Number(item.quantidade || item.unidades || 0),
    fator: Number(item.fator || 0)
  }));

  return {
    ok: true,
    resumo: {
      totalItens,
      totalUnidades,
      totalCaixas,
      totalEnderecos: Object.keys(porEndereco).length
    },
    porEndereco,
    itens
  };
};
