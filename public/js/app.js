import { ProdutosModule } from './modules/produtos.js'
import { DashboardModule } from './modules/dashboard.js'

const routes={
dashboard:DashboardModule,
produtos:ProdutosModule
}

window.load=async(name)=>{
const html=await routes[name]()
document.getElementById('app').innerHTML=html

if(name==='produtos'){
const d=await fetch('/api/produtos').then(r=>r.json())
document.getElementById('lista').innerHTML=JSON.stringify(d)
}
}

load('dashboard')
