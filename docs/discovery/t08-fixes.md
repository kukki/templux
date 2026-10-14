# T08 F1/F2修复验收

基线1dde7e7c7d50ffda436c84ae11b3aa6d7583fc14，2026-10-15；初审t08-review.md保留原结论和历史。按receiving-code-review/systematic-debugging先复现再修复，不把已验证外部身份误称为目标绑定或权限提升。

## 核验与修复

旧镜像运行初审reproduction脚本，F1旧回调实际创建独立Pending并发行Cookie，F2reset-person首次启用实际exit1；t08-fix-red.log。首次临时Postgres还未ready使migrate/复现失败，健康后重跑0006迁移与同一复现成功；不把该启动失败当缺陷复现。0006隔离pg_dump自定义格式0600（t08-fix-pre7.dump），scratch pg_restore --exit-on-error恢复确认版本6，再预置普通/关联state应用0007；记录t08-fix-backup-migration.log，关联回填request800、普通purpose保持login。原0001–0006不变，原部署0004未迁移或重启。

F1新增0007用途/不可变服务器请求关联，consume单条SQL原子消费并捕获purpose/request/current mapping，不一致拒绝；远程兑换后按捕获请求ID及当前state复验，查不到/替换不能返回false降级普通登录。没有在SQL锁内等待外部网络。Callback普通和关联分支显式分离。

F2本人未验证只提示证明阶段，verified本人password请求显示具体complete-login-link与安全新文件命令，去掉Web完成按钮；已有密码重置显示合法ASCII文件名的reset-person。本人飞书、他人正常Web完成入口保持。没有修改管理员自身Web生成密码的409后端保护。

## 新真实回归

```sh
docker compose build checks api web
# 独立7，绝不修改部署4；工具服务均连接auth-database。
docker compose run --rm --no-deps checks node --test tests/login-link-race.test.mjs
docker compose run --rm --no-deps \
  -e TEST_API_URL=http://password-api:8080 -e TEST_WEB_URL=http://password-web:3000 checks npm test
docker compose run --rm --no-deps checks npm run typecheck
```

新tests/login-link-race.test.mjs仅外部协议等待/响应模拟，账号、Cookie、SQL、权限、审计与CLI真实。受控等待确认第一个state已消费，第二begin真实成功，释放兑换后断言旧回调302登录原因、无新会话Cookie、accounts/auth_sessions/identities数量均不变、目标未绑定且请求pending；第二state正常verified再最终绑定。分别覆盖取消/过期/版本变更/请求缺失，拒绝后新请求仍可正常完成。额外不一致用途（关联映射声称普通用途）/错误请求ID在消费阶段invalid_state，无账号/会话/身份新增。正常普通OAuth继续持久登录；本人Feishu-only已验证启用按实际集中指令spawn执行，0600、重复文件拒绝、stdout/stderr不含密码、旧Feishu401及新密码管理200。

首轮定向7/7（t08-fix-race.log）；完整首轮126/126（t08-fix-suite.log）。补持久用途不一致拒绝后最终完整127/127、fail/cancelled/skipped均0，API/Web typecheck退出0；见t08-fix-final-suite.log/t08-fix-final-typecheck.log。新定向共8项包含在完整suite。API/checks/Web真实构建退出0，最终API/checks构建t08-fix-final-build.log。不重跑无关截图、安装或SQL压力矩阵。

## 实际本人网页/CLI

Ego TaskSpace39，仅隔离127.0.0.1:31030，正常外部协议模拟Feishu登录得到Pending测试人员，再受控CLI授admin、正常重登。没有操作Ego31/实际人员。网页自身Feishu-only创建密码请求，验证前hasComplete=false/hasWrongReset=false且有证明提示；账号页本人验证后，编辑页面展示实际request11命令且没有Web完成按钮。读取DOM命令原样参数在隔离CLI执行，exit0，新person-8-link-11.json0600，重跑exit1不覆盖、输出秘密检查false。新密码从正常表单进入同账号8/admin；旧Feishu401。

已有密码后网页给reset-person账号8/person-8-reset.json指令；同参数实际CLIexit0，已持久旧密码与旧Feishu均401、新密码正常HTTP和网页200，角色admin保持。文件仅0700私有测试目录，读取只用于表单和检查，未打印。t08-fix-browser-{command,cli,reset-command,evidence}.json及t08-fix-browser-reset.log保留非敏感结果；TaskSpace39已finish。未新增截图，字符串/按钮实际页面已核验。

## 覆盖与限制

codebase-memory index/search/trace/snippet及每个依赖路径coverage，修改代码与0007无记录缺口（best-effort）；SQL仍直接读取。PG技能先于DDL，读取短事务/FK索引规则。Context7读取node-postgres同客户端事务/单语句RETURNING、React条件渲染。协议端点和兑换规则未改；同日完整官方授权码395行/token-v3 544行/user_info408行资料已核对，链接见login-methods.md，修正官方token-v3链接。

原.env、真人权限/Ego31/通知未操作。T03真实组织人工验收仍未完成；没有用模拟证明真实组织关联。0007实际部署升级须备份并按原流程切换服务，未在用户0004环境实施。生产镜像无fixture，Web安全交付/COMMIT未知原局限保持；Linux/WSL2和实际TLS矩阵未新增验收。工具容器及明文测试目录已清理，保留0600隔离备份和非敏感证据。20项本票日志/JSON、2份随机凭据扫描无明文命中（t08-fix-secret-scan.json）；生产API无tests且含0007（t08-fix-production-boundary.log）。t08-fix-original-status.json仍ready/0004，t08-fix-final-services.json仅原API/Web/database healthy，清理日志t08-fix-cleanup.log。提交后干净，不推送/关工单。
