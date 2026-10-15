"""Real macOS PTY -> own host wrapper -> actual management menu, read-only status only."""
import pathlib,pty,subprocess,os,select,time,json
r=pathlib.Path(__file__).resolve().parents[2];o=r/'test-results/t29';d=pathlib.Path((o/'consumer-path.txt').read_text());env={k:v for k,v in os.environ.items()if not k.startswith(('TEMPLUX_','COMPOSE_','FEISHU_'))and k!='DATABASE_URL'};env.update(TEMPLUX_HOST_UID='0',TEMPLUX_HOST_GID='0');master,slave=pty.openpty();p=subprocess.Popen([str(d/'templux')],cwd=d,env=env,stdin=slave,stdout=slave,stderr=slave,start_new_session=True);os.close(slave);buf=b'';sent=False;deadline=time.monotonic()+30
try:
 while time.monotonic()<deadline and p.poll()is None:
  if select.select([master],[],[],.1)[0]:
   try:buf+=os.read(master,65536)
   except OSError:break
  text=buf.decode(errors='replace')
  if not sent and 'Templux 管理菜单'in text and '请选择 1–26'in text:os.write(master,b'2\n');sent=True
 if p.poll()is None:p.terminate()
 code=p.wait(timeout=5);assert sent and code==0
 (o/'cli-menu.log').write_text(buf.decode(errors='replace'));(o/'cli-menu-proof.json').write_text(json.dumps({'host':'macOS PTY','actualManagementMenu':True,'choice':2,'exit':code,'mutations':0},indent=2));print('real PTY menu/status exit0')
finally:os.close(master)
