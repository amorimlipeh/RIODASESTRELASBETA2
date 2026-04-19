async function loadModule(nome) {
    const res = await fetch('/modules/' + nome + '.html');
    const html = await res.text();
    document.getElementById('app').innerHTML = html;

    if (nome === 'importacao') {
        initImportacao();
    }
}

// inicial
loadModule('dashboard');
