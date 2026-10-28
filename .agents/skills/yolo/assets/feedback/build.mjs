import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url)), check=process.argv.includes('--check');
const versionSource='export const LIBRARY_VERSION = '+JSON.stringify(JSON.parse(readFileSync(root+'package.json','utf8')).version)+';\n';
if(check){if(readFileSync(root+'src/version.ts','utf8')!==versionSource)throw new Error('Library version source drift.');}
else writeFileSync(root+'src/version.ts',versionSource);
const assetType='/** @type {Record<string, {body: string, type: string}>} */\n';
if(!check && !readFileSync(root+'library-assets.mjs','utf8').startsWith(assetType))writeFileSync(root+'library-assets.mjs',assetType+readFileSync(root+'library-assets.mjs','utf8'));
const output=check?mkdtempSync(join(tmpdir(),'yolo-feedback-build-')):root+'dist';
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);}
try {
 execFileSync(process.execPath,[root+'node_modules/typescript/lib/tsc.js','-p',root+'tsconfig.json','--outDir',output],{stdio:'inherit'});
 const assets={};
 for(const [file,path,type] of [['src/browser.js','/yolo/feedback/browser.js','text/javascript; charset=utf-8'],['src/contract.js','/yolo/feedback/contract.js','text/javascript; charset=utf-8'],['src/version.js','/yolo/feedback/version.js','text/javascript; charset=utf-8']])assets[path]={body:readFileSync(join(output,file),'utf8'),type};
 assets['/yolo/feedback/styles.css']={body:readFileSync(root+'styles-library.css','utf8'),type:'text/css; charset=utf-8'};
 const source=assetType+'export const libraryAssets = '+JSON.stringify(assets)+';\n';
 writeFileSync(join(output,'library-assets.mjs'),source);
 if(check){
  if(readFileSync(root+'library-assets.mjs','utf8')!==source)throw new Error('Embedded library assets are stale.');
  const expected=files(output).map(p=>relative(output,p)).sort(),actual=files(root+'dist').map(p=>relative(root+'dist',p)).sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('Compiled file inventory drift.');
  for(const file of expected)if(!readFileSync(join(output,file)).equals(readFileSync(join(root,'dist',file))))throw new Error('Compiled drift: '+file);
 }else writeFileSync(root+'library-assets.mjs',source);
 console.log(check?'Compiled feedback artifacts reproduce.':'Compiled browser, bridge and headless client.');
}finally{if(check)rmSync(output,{recursive:true,force:true});}
