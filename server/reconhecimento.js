module.exports = function reconhecerProduto(imagemBase64, produtos = []) {
  const texto = String(imagemBase64 || "").toLowerCase();
  if (!texto) return null;

  return produtos.find((p) => {
    const codigo = String(p.codigo || "").toLowerCase();
    const produto = String(p.produto || p.nome || "").toLowerCase();
    return (codigo && texto.includes(codigo)) || (produto && texto.includes(produto));
  }) || null;
};
