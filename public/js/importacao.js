
async function visualizarImportacao() {
    const input = document.querySelector('input[type="file"]');
    const file = input.files[0];

    if (!file) {
        alert('Selecione um arquivo primeiro');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const previewDiv = document.querySelector('#preview');
    previewDiv.innerHTML = '<p>⏳ Carregando...</p>';

    try {
        const res = await fetch('/api/importacao/preview', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        if (!data.sucesso) {
            previewDiv.innerHTML = 'Erro ao importar';
            return;
        }

        let html = `<p>Total: ${data.total}</p><table border="1">`;

        const keys = Object.keys(data.dados[0] || {});
        html += '<tr>' + keys.map(k => `<th>${k}</th>`).join('') + '</tr>';

        data.dados.forEach(row => {
            html += '<tr>' + keys.map(k => `<td>${row[k]}</td>`).join('') + '</tr>';
        });

        html += '</table>';

        previewDiv.innerHTML = html;

    } catch (err) {
        console.error(err);
        previewDiv.innerHTML = 'Erro na requisição';
    }
}

window.visualizarImportacao = visualizarImportacao;

