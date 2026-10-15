// TEST ONLY release overlay, run only inside the disposable tooling container.
import {readFileSync,writeFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';
const root='/opt/templux',c=JSON.parse(readFileSync(root+'/release.config.json'));c.version='0.3.0-t27.1';c.upgradeFrom=['0.2.0-t26.1'];writeFileSync(root+'/release.config.json',JSON.stringify(c));
const extra='\nexport function sharedReleaseLabel(){return "t27-final-target";}\nexport function sharedReleaseCapabilities(){return ["source-update-scheduler","cumulative-proposals"];}\n';
for(const p of ['apps/api/src/project-interface.ts','apps/api/dist/project-interface.js'])writeFileSync(root+'/'+p,readFileSync(root+'/'+p,'utf8')+extra);
const d=root+'/apps/api/dist/project-interface.d.ts';writeFileSync(d,readFileSync(d,'utf8')+'\nexport declare function sharedReleaseLabel(): string;\nexport declare function sharedReleaseCapabilities(): string[];\n');
writeFileSync(root+'/project-template/tools/shared-version-check.mjs','import {sharedReleaseLabel} from "@templux/core";\nif(sharedReleaseLabel()!=="t27-final-target")throw new Error("Shared target interface mismatch");\n');
writeFileSync(root+'/project-template/tools/final-release-check.mjs','import {sharedReleaseCapabilities} from "@templux/core";\nif(!sharedReleaseCapabilities().includes("cumulative-proposals"))throw new Error("Final release capability missing");\n');
const docker=root+'/project-template/Dockerfile';writeFileSync(docker,readFileSync(docker,'utf8').replace('FROM dependencies AS api-build\n','FROM dependencies AS api-build\nRUN node tools/shared-version-check.mjs\nRUN node tools/final-release-check.mjs\n').replace('FROM dependencies AS web-build\n','FROM dependencies AS web-build\nRUN node .templux/verify.mjs . --installed\n'));
writeFileSync(root+'/apps/web/public/t27-release.svg','<svg xmlns="http://www.w3.org/2000/svg" width="180" height="24"><text x="0" y="18">T27 cumulative test</text></svg>\n');
const r=spawnSync('node',['tools/release/build.mjs','/release'],{cwd:root,stdio:'inherit'});process.exitCode=r.status??1;
