#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createWorkClient } from './dist/src/work-client.js';
const [command,...args]=process.argv.slice(2);
try {
  const baseURL=process.env.YOLO_WORK_BRIDGE_URL,token=process.env.YOLO_WORK_BRIDGE_TOKEN;
  if(!baseURL||!token)throw new Error('Load the client-owned YOLO_WORK_BRIDGE_URL and YOLO_WORK_BRIDGE_TOKEN from the private connection environment.');
  const client=createWorkClient({baseURL,token});
  let result;
  if(command==='session'&&args.length===0)result=await client.session();
  else if(command==='requests'&&args.length===0)result=await client.requests();
  else if(command==='request'&&args.length===1)result=await client.request(args[0]);
  else if(command==='receipt'&&args.length===2)result=await client.receipt(args[0],args[1]);
  else if(command==='respond'&&args.length===5&&args[1]==='--operation'&&args[3]==='--message-file')result=await client.respond(args[0],args[2],await readFile(args[4],'utf8'));
  else throw new Error('Use session | requests | request UUID | receipt REQUEST_UUID OPERATION_UUID | respond UUID --operation SAVED_UUID --message-file PATH');
  console.log(JSON.stringify(result,null,2));
} catch(error){console.error(error instanceof Error?error.message:'Bridge operation failed; reconcile before retry.');process.exitCode=1;}
