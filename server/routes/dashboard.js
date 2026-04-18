const r=require('express').Router();
const db=require('../services/db');

r.get('/',(req,res)=>{
const d=db.read();
res.json({
produtos:d.produtos.length,
movimentacoes:d.movimentacoes.length,
enderecos:Object.keys(d.wms).length
});
});
module.exports=r;
