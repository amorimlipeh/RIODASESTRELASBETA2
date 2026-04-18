const r=require('express').Router();
const db=require('../services/db');

r.get('/',(req,res)=>res.json(db.read().movimentacoes));
module.exports=r;
