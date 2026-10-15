#!/usr/bin/env python3
import importlib.util,json,pathlib
p=pathlib.Path(__file__).with_name('diagnose.py').resolve();spec=importlib.util.spec_from_file_location('diag',p);d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)
w=pathlib.Path(json.loads((d.OUT/'work.json').read_text())['path'])
d.run('default-compose-web-cold',['docker','compose','--env-file','/dev/null','-p','t29-cold-default','--progress','plain','build','--no-cache','web'],150,w/'project')
