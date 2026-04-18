const r=require('express').Router();
const db=require('../services/db');

r.get('/',(req,res)=>res.json(db.read().wms));

r.post('/',(req,res)=>{
const d=db.read();
const {endereco,produto}=req.body;

if(!d.wms[endereco]) d.wms[endereco]=[];
d.wms[endereco].push(produto);

db.write(d);
res.json({ok:true});
});
module.exports=r;
