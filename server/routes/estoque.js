const r=require('express').Router();
const db=require('../services/db');

r.post('/',(req,res)=>{
const d=db.read();
const {produto,quantidade}=req.body;

if(!d.estoque[produto]) d.estoque[produto]=0;
d.estoque[produto]+=quantidade;

d.movimentacoes.push({produto,quantidade,data:new Date()});

db.write(d);
res.json({ok:true});
});
module.exports=r;
