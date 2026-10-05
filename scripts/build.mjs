import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'dist');
const files=['index.html','styles.css','app.js','manifest.webmanifest','icon.svg','sw.js'];

fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});

for(const file of files){
  fs.copyFileSync(path.join(root,file),path.join(out,file));
}

console.log('build: copied '+files.length+' static files to dist/');
