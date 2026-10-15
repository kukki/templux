#!/usr/bin/env python3
import pathlib,subprocess,json,hashlib,tempfile,shutil
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'test-results/t26';p=pathlib.Path((OUT/'current-path.txt').read_text().strip());t=OUT/'releases/0.2.0-t26.1';h=hashlib.sha256((t/'manifest.json').read_bytes()).hexdigest()
a=['docker','run','--rm','-v',str(p)+':/current:ro','-v',str(t)+':/target:ro','-v',str(p)+':/alias','t26-upgrade-tools','--current','/current','--target-release','/target','--target-version','0.2.0-t26.1','--target-sha256',h,'--output','/alias/unsafe-output']
z=subprocess.run(a,capture_output=True,text=True);(OUT/'bind-alias.json').write_text(json.dumps({'exit':z.returncode,'stdout':z.stdout,'stderr':z.stderr},indent=2));assert z.returncode==1 and not(p/'unsafe-output').exists()
