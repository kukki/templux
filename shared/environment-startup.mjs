import {environmentReport}from'./environment-cli.mjs';
// Supported Compose services set a fixed role; direct Node unit/fixture processes are not deployments.
if(process.env.TEMPLUX_ENV_SCOPE){
 const result=environmentReport({scope:process.env.TEMPLUX_ENV_SCOPE});
 if(!result.ok){if(process.env.TEMPLUX_ENV_SCOPE==='management'&&process.argv.includes('--json'))process.stdout.write(JSON.stringify({ok:false,error:'environment_invalid',errors:result.errors})+'\n');process.stderr.write('environment startup rejected: '+result.errors.map(e=>`${e.key}:${e.code}`).join(', ')+'\n');process.exit(1);}
 for(const row of result.rows)if(row.policy==='optional'&&['empty','blank'].includes(row.state))delete process.env[row.key];
}
