async function load(modulo) {
  const res = await fetch('/modules/' + modulo + '.html');
  const html = await res.text();
  document.getElementById('content').innerHTML = html;
}

load('dashboard');
