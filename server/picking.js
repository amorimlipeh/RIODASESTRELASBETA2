module.exports = function gerarTarefasPicking(pedido = {}, estoque = []) {
  const tarefas = [];

  for (const item of (pedido.produtos || [])) {
    const codigoBusca = String(item.codigo || item.produto || "").trim();
    const quantidade = Number(item.quantidade || 0);

    const encontrado = estoque.find((e) =>
      String(e.codigo || "").trim() === codigoBusca ||
      String(e.produto || "").trim().toLowerCase() === codigoBusca.toLowerCase()
    );

    tarefas.push({
      codigo: codigoBusca,
      produto: encontrado?.produto || item.produto || codigoBusca,
      quantidade,
      endereco: encontrado?.endereco || "",
      caixas: Number(encontrado?.caixas || 0),
      voz: encontrado?.endereco
        ? `Ir para ${encontrado.endereco}. Separar ${quantidade} unidade(s) do item ${encontrado.produto || codigoBusca}.`
        : `Item ${codigoBusca} sem endereço definido.`
    });
  }

  return tarefas;
};
