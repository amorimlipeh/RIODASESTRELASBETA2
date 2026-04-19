export function renderImportador(container) {
    container.innerHTML = `
        <h2>📦 Importação Inteligente</h2>

        <input type="file" id="fileInput">
        <button id="btnEnviar">Visualizar</button>

        <div id="loading" style="margin-top:10px;"></div>
        <div id="preview" style="margin-top:20px;"></div>
    `;

    document.getElementById('btnEnviar').addEventListener('click', enviarArquivo);
}

async function enviarArquivo() {
    const input = document.getElementById('fileInput');
    const file = input.files[0];

    if (!file) {
        alert("Selecione um arquivo");
        return;
    }

    const loading = document.getElementById('loading');
    const previewDiv = document.getElementById('preview');

    loading.innerHTML = `
        <div style="background:#222;width:100%;height:20px;border-radius:5px;overflow:hidden">
            <div id="bar" style="width:0%;height:100%;background:#00ff88;"></div>
        </div>
        <p>Processando...</p>
    `;

    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        if (progress <= 90) {
            document.getElementById('bar').style.width = progress + "%";
        }
    }, 200);

    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await fetch('/api/importacao/preview', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        clearInterval(interval);
        document.getElementById('bar').style.width = "100%";

        if (!data.sucesso) {
            throw new Error(data.erro);
        }

        let html = "<h3>Preview:</h3><table border='1' style='width:100%;font-size:12px'>";

        if (data.preview.length > 0) {
            const keys = Object.keys(data.preview[0]);

            html += "<tr>";
            keys.forEach(k => html += `<th>${k}</th>`);
            html += "</tr>";

            data.preview.forEach(row => {
                html += "<tr>";
                keys.forEach(k => html += `<td>${row[k] || ""}</td>`);
                html += "</tr>";
            });
        }

        html += "</table>";

        previewDiv.innerHTML = html;

    } catch (err) {
        clearInterval(interval);
        loading.innerHTML = `<p style="color:red">Erro: ${err.message}</p>`;
        console.error(err);
    }
}
