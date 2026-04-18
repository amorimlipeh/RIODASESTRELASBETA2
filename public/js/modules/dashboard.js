export async function DashboardModule(){
const d=await fetch('/api/dashboard').then(r=>r.json())
return `<h1>Dashboard</h1>Produtos: ${d.produtos}`
}
