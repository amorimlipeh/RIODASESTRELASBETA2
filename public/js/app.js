async function load(modulo) {
  try {
    const res = await fetch('/modules/' + modulo + '.html');

    if (!res.ok) {
      throw new Error('Erro ao carregar módulo');
    }

    const html = await res.text();

    const content = document.getElementById('content');
    content.innerHTML = html;

    executarScripts(content);

  } catch (err) {
    document.getElementById('content').innerHTML =
      "<h2>Erro ao carregar módulo</h2>";
  }
}

// EXECUTA SCRIPT DENTRO DO HTML
function executarScripts(element) {
  const scripts = element.querySelectorAll("script");

  scripts.forEach(script => {
    const novo = document.createElement("script");
    novo.textContent = script.textContent;
    document.body.appendChild(novo);
    script.remove();
  });
}

// INICIAR
window.onload = () => {
  load('dashboard');
};
