import { Button } from '../components/button.js'

export async function ProdutosModule(){
return `
<h1>Produtos</h1>
<input id="nome">
${Button('Adicionar','addProduto()')}
<div id="lista"></div>
`
}

window.addProduto=async()=>{
await fetch('/api/produtos',{
method:'POST',
headers:{'Content-Type':'application/json'},
body:JSON.stringify({nome:nome.value})
})
load('produtos')
}
