#!/usr/bin/env python3
"""Read only consistency check for the two self-owned restore-proof databases."""
import json,pathlib,subprocess
root=pathlib.Path(__file__).resolve().parents[2]
config=root/'test-results/t23/compose/compose.yaml'
assert 'name: t23-proof\n' in config.read_text()
query="""SELECT json_build_object(
'accounts',(SELECT json_agg(row_to_json(a) ORDER BY id) FROM (SELECT id,display_name,state,kind,responsible_person_id,auth_version FROM templux.accounts) a),
'roles',(SELECT json_agg(row_to_json(r) ORDER BY account_id,role_key) FROM templux.account_roles r),
'credentials',(SELECT count(*) FROM templux.password_credentials WHERE enabled),
'restoreAudits',(SELECT count(*) FROM templux.audit_events WHERE event='database_restored'))"""
snapshots={}
for name in ['t23_app','t23_independent']:
    p=subprocess.run(['docker','compose','-f',str(config),'exec','-T','database','psql','-X','-At','-U','t23','-d',name,'-v','ON_ERROR_STOP=1','-c',query],capture_output=True,text=True,check=True)
    snapshots[name]=json.loads(p.stdout)
a,b=snapshots.values()
assert a==b,(a,b)
assert [v['kind'] for v in a['accounts']]==['person','agent']
assert a['accounts'][1]['responsible_person_id']==a['accounts'][0]['id']
assert [v['role_key'] for v in a['roles']]==['user','user']
assert a['credentials']==2 and a['restoreAudits']==1
(root/'test-results/t23/data-consistency.json').write_text(json.dumps(snapshots,indent=2)+'\n')
print('both modes: identical 2 accounts, responsibility, auth versions, user roles, 2 enabled credentials, 1 strong restore audit')
