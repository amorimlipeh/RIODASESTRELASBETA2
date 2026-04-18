export async function ImportacaoModule(){
  return `
    <h1>Importação</h1>
    <input type="file" id="file">
    <button onclick="enviar()">Enviar</button>
    <div id="preview"></div>
  `;
}

window.enviar = async () => {
  const file = document.getElementById('file').files[0];

  const reader = new FileReader();

  reader.onload = async function(e){
    const base64 = e.target.result.split(',')[1];

    const res = await fetch('/api/importacao', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ file: base64 })
    });

    const data = await res.json();

    document.getElementById('preview').innerHTML =
      data.preview.map(s => `
        <h3>${s.nome}</h3>
        <b>Colunas:</b> ${s.colunas.join(', ')}<br>
        <pre>${JSON.stringify(s.linhas, null, 2)}</pre>
      `).join('');
  }

  reader.readAsDataURL(file);
}
