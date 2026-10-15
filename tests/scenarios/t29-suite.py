"""Full parent-matrix container tests on a fresh, task-owned Compose project."""
import pathlib,subprocess,json,os,argparse
r=pathlib.Path(__file__).resolve().parents[2];o=r/'test-results/t29';s=pathlib.Path((o/'source-path.txt').read_text());p=argparse.ArgumentParser();p.add_argument('action',choices=['build','run','down']);a=p.parse_args();env={k:v for k,v in os.environ.items()if not k.startswith(('TEMPLUX_','COMPOSE_','DATABASE_','FEISHU_','TEST_'))};env.update(TEMPLUX_PROJECT_NAME='t29-suite',TEST_DEPLOYMENT_ENV='DEV');override=o/'suite.override.json';override.write_text(json.dumps({'services':{'password-api':{'networks':{'default':{'aliases':['api']}}},'restore-db':{'image':'postgres:18.6-bookworm@sha256:afc7e2d441324c0388fa80c3d24f733b4194a4eb7f47dd8ee2b08eb1a24a647c','environment':{'POSTGRES_DB':'restore_t29','POSTGRES_USER':'templux_test','POSTGRES_PASSWORD':'isolated-test-only'},'tmpfs':['/var/lib/postgresql'],'healthcheck':{'test':['CMD-SHELL','pg_isready -U templux_test -d restore_t29'],'interval':'2s','timeout':'3s','retries':20}},'checks':{'image':'t29-tools','entrypoint':[],'environment':{'TEST_API_URL':'http://password-api:8080','TEST_WEB_URL':'http://password-web:3000','TEST_RESTORE_DATABASE_URL':'postgresql://templux_test:isolated-test-only@restore-db:5432/restore_t29'}}}}));base=['docker','compose','--profile','tools','--env-file','/dev/null','-p','t29-suite','-f',str(s/'compose.yaml'),'-f',str(override)];commands=[]
def run(cmd,label,timeout=600):
 commands.append(cmd);(o/('suite-'+a.action+'-commands.json')).write_text(json.dumps(commands,indent=2));f=open(o/(label+'.log'),'w');q=subprocess.run(cmd,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=timeout);print(label,q.returncode,flush=True);assert q.returncode==0,label
if a.action=='build':
 for target in ['api','web']:run(['docker','build','--target',target,'-t','t29-suite-'+target,str(s)],'suite-build-'+target)
 for image in ['checks']:run(['docker','tag','t29-tools','t29-suite-'+image],'suite-tag-'+image)
elif a.action=='run':
 run(base+['up','-d','--wait','auth-database','restore-db','ssr-body-api','ssr-body-web','password-api','password-web'],'suite-up')
 run(base+['run','--rm','--no-deps','checks','npm','test'],'suite-full',600)
 run(base+['run','--rm','--no-deps','checks','npm','run','typecheck'],'suite-types')
else:run(base+['down','-v','--remove-orphans'],'suite-down')
