const r=require('express').Router();
const db=require('../services/db');

r.get('/',(req,res)=>{
const d=db.read();
res.json({produtos:d.produtos.length});
});

module.exports=r;
