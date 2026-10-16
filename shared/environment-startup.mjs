import {environmentReport}from'./environment-cli.mjs';
// Supported Compose services set a fixed role; direct Node unit/fixture processes are not deployments.
if(process.env.TEMPLUX_ENV_SCOPE){
 const result=environmentReport({scope:process.env.TEMPLUX_ENV_SCOPE});
 if(!result.ok){process.stderr.write('environment startup rejected: '+result.errors.map(e=>`${e.key}:${e.code}`).join(', ')+'\n');process.exit(1);}
}
