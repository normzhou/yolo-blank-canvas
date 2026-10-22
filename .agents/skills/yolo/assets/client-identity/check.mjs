// Keep dry-build logs inside this client package, including restricted harnesses.
import {spawnSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
const env={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:resolve(root,'.wrangler/logs')};
for(const args of [
 ...['client.mjs','worker.mjs','backend.mjs'].map(file=>['--check',resolve(root,file)]),
 [resolve(root,'node_modules/wrangler/wrangler-dist/cli.js'),'deploy','--dry-run','--config',resolve(root,'wrangler.json'),'--outdir',resolve(root,'.wrangler/dry-run')],
]){
 const result=spawnSync(process.execPath,args,{cwd:root,env,stdio:'inherit',timeout:90000});
 if(result.status!==0)process.exit(result.status??1);
}
