
document.addEventListener('DOMContentLoaded', () => {
    console.log('IMPORTAÇÃO JS CARREGADO');

    const btn = document.getElementById('btnVisualizar');

    if (!btn) {
        console.error('BOTÃO NÃO ENCONTRADO');
        return;
    }

    btn.addEventListener('click', async () => {
        console.log('CLICOU VISUALIZAR');

        const fileInput = document.getElementById('fileInput');
        const file = fileInput.files[0];

        if (!file) {
            alert('Selecione um arquivo');
            return;
        }

        const preview = document.getElementById('preview');
        preview.innerHTML = '<p>⏳ Carregando...</p>';

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/importacao/preview', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            console.log('RESPOSTA:', data);

            if (!data.sucesso) {
                preview.innerHTML = 'Erro ao processar';
                return;
            }

            let html = `<p>Total: ${data.total}</p><table border="1">`;

            const keys = Object.keys(data.dados[0] || {});
            html += '<tr>' + keys.map(k => `<th>${k}</th>`).join('') + '</tr>';

            data.dados.forEach(row => {
                html += '<tr>' + keys.map(k => `<td>${row[k]}</td>`).join('') + '</tr>';
            });

            html += '</table>';

            preview.innerHTML = html;

        } catch (err) {
            console.error(err);
            preview.innerHTML = 'Erro na requisição';
        }
    });
});

