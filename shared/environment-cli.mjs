import {readFileSync,existsSync,lstatSync}from'node:fs';import {resolve}from'node:path';
import {checkEnvironment}from'./environment.mjs';
export function environmentReport({scope='all',directory=process.env.TEMPLUX_ENV_DIR??process.cwd(),fileRequired=false}={}){
 let exampleText='',fileText;const errors=[];
 try{exampleText=readFileSync(resolve(directory,'.env.example'),'utf8');}catch{errors.push({key:'.env.example',code:'unreadable'});}
 const file=resolve(directory,'.env');
 try{if(existsSync(file)){if(!lstatSync(file).isFile()||lstatSync(file).isSymbolicLink())throw new Error();fileText=readFileSync(file,'utf8');}else if(fileRequired)throw new Error();}catch{errors.push({key:'.env',code:'unreadable'});}
 const result=checkEnvironment({exampleText,fileText,scope});result.errors.unshift(...errors);result.ok=result.errors.length===0;return result;
}
export function environmentMain(args=process.argv.slice(2)){
 const command=args[0]??'check',json=args.includes('--json');
 if(!['check','list'].includes(command)||args.slice(1).some(a=>a!=='--json')||args.filter(a=>a==='--json').length>1){if(json)console.log(JSON.stringify({ok:false,errors:[{key:'arguments',code:'invalid'}]}));console.error('environment: use check|list [--json]');process.exitCode=1;return;}
 const result=environmentReport({fileRequired:true});
 if(json)console.log(JSON.stringify(result));else{for(const r of result.rows)console.log(`${r.key}\t${r.policy}\t${r.required?'required':'optional'}\t${r.state}\t${r.source}`);for(const w of result.warnings)console.error(`${w.key}: ${w.code}`);}
 if(!result.ok){console.error('environment validation failed: '+result.errors.map(e=>`${e.key}:${e.code}`).join(', '));process.exitCode=1;}
}
// Importing the report helper has no CLI side effects.
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname))environmentMain();
