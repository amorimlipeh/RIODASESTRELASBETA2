async function enviarArquivo() {
    const input = document.getElementById('fileInput');
    const file = input.files[0];

    if (!file) {
        alert("Selecione um arquivo");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch('/api/importacao/preview', {
        method: 'POST',
        body: formData
    });

    const data = await res.json();

    if (data.sucesso) {
        let html = '<h3>Preview:</h3><pre>';
        html += JSON.stringify(data.preview, null, 2);
        html += '</pre>';

        document.getElementById('preview').innerHTML = html;
    } else {
        alert("Erro: " + data.erro);
    }
}
