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

// FORCE RELOAD SE CACHE ANTIGO
const currentVersion = localStorage.getItem("app_version");
if (currentVersion !== window.APP_VERSION) {
    localStorage.setItem("app_version", window.APP_VERSION);
    location.reload(true);
}
