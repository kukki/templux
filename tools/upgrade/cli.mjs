import {propose} from './propose.mjs';
try{
 const options={},keys={'--current':'current','--target-release':'target','--target-version':'targetVersion','--target-sha256':'targetSha','--output':'output','--behavior':'behavior','--timeout-ms':'timeout'};
 const args=process.argv.slice(2);for(let i=0;i<args.length;i++){if(args[i]==='--trust-project-code'){if(options.trustProjectCode)throw Error();options.trustProjectCode=true;continue;}const key=keys[args[i]];if(!key||key in options||!args[i+1]||args[i+1].startsWith('--'))throw Error();options[key]=key==='timeout'?Number(args[++i]):args[++i];}
 if(['current','target','targetVersion','targetSha','output'].some(k=>!options[k]))throw Error();
 const report=await propose(options);console.log(JSON.stringify({ok:report.directlyApplicable,report:'report.json',directlyApplicable:report.directlyApplicable,manual:report.manual.length,checks:report.checks}));if(!report.directlyApplicable)process.exitCode=2;
}catch{console.error(JSON.stringify({event:'upgrade_proposal_failed',message:'Invalid inputs or candidate preparation failed. Check trusted identifiers, baseline, paths and resources; no live project writes were requested.'}));console.log(JSON.stringify({ok:false,directlyApplicable:false,error:'proposal_failed'}));process.exitCode=1;}
