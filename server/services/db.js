const fs=require('fs');
const DB='./data/db.json';

if(!fs.existsSync('./data')) fs.mkdirSync('./data');

if(!fs.existsSync(DB)){
fs.writeFileSync(DB,JSON.stringify({
produtos:[],
estoque:{},
wms:{},
movimentacoes:[]
},null,2));
}

exports.read=()=>JSON.parse(fs.readFileSync(DB));
exports.write=(d)=>fs.writeFileSync(DB,JSON.stringify(d,null,2));
