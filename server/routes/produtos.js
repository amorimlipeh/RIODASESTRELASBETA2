const r=require('express').Router();
const db=require('../services/db');

r.get('/',(req,res)=>res.json(db.read().produtos));

r.post('/',(req,res)=>{
const d=db.read();
const p={id:Date.now(),nome:req.body.nome};
d.produtos.push(p);
db.write(d);
res.json(p);
});
module.exports=r;
