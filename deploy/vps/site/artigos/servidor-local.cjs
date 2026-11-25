// Servidor estático local para testar site/out (uso: node servidor-local.cjs <pasta> <porta>). Não há Python nesta máquina.
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(process.argv[2]), port=+process.argv[3];
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.txt':'text/plain','.xml':'application/xml','.woff2':'font/woff2','.ico':'image/x-icon','.mp4':'video/mp4','.jpg':'image/jpeg','.avif':'image/avif'};
http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);let f=path.join(root,p);
 if(!f.startsWith(root)){r.writeHead(403);return r.end();}
 if(fs.existsSync(f)&&fs.statSync(f).isDirectory()){ if(!p.endsWith('/')){r.writeHead(301,{Location:p+'/'});return r.end();} f=path.join(f,'index.html');}
 if(!fs.existsSync(f)){const h=f+'.html'; if(fs.existsSync(h)) f=h; else {r.writeHead(404,{'Content-Type':'text/html'});const n=path.join(root,'404.html');return r.end(fs.existsSync(n)?fs.readFileSync(n):'404');}}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);
}).listen(port,'127.0.0.1',()=>console.log('ok '+port));
