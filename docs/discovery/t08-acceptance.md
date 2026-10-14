# T08 实施验收记录

2026-10-15，开发；Gitea #9/#1，基线cdf61c61e7ecca5b4c44ef67a8833992285662fb。保留原20本地提交；不推送、不关闭工单，交TL独立审查。合同见[login-methods.md](../specs/login-methods.md)，不改T03真实组织人工待办。

## 实现与隔离

新增0006持久验证请求和person/realm身份唯一索引，Web管理员发起、目标本人正常登录证明、管理员最终提交；CLI同服务。人员随机密码启用/重置单次交付，Agent原受限文件规则保留。状态/角色同一账号，版本失效和关键审计同事务；共享原授权锁和最新操作者检查，没有生产认证fixture或身份POST后门。

原运行环境仍0004，API/Web/database未重启/迁移；测试只auth-database/templux_auth_test与工具API/Web。旧checks镜像先将隔离空库迁移0005，pg_dump自定义格式0600备份，scratch库pg_restore --exit-on-error恢复后max(version)=0005且login_method_requests不存在（t08-backup-restore.log），再新镜像应用0006。历史SQL未改写；备份t08-pre-migration.dump仅隔离测试数据。

## 命令与结果

```sh
docker compose build checks api web management
# 正常部署保持0004，安装状态测试明确指向隔离0006。
TEST_AUTH_PUBLIC_URL=http://127.0.0.1:31040 \
  docker compose --profile tools up -d password-api password-web ssr-body-api ssr-body-web
docker compose run --rm --no-deps \
  -e TEST_API_URL=http://password-api:8080 -e TEST_WEB_URL=http://password-web:3000 checks npm test
docker compose run --rm --no-deps checks npm run typecheck
```

构建退出0；API/Web typecheck退出0。完整119/119（t08-suite-final.log）；初轮118/119唯一失败为旧CLI帮助文本期望未包含四个新命令，定位后更新断言，完整重跑通过。此后补菜单密码完成必须提示受限文件的CLI输入校验，同票真实定向回归和类型检查再次验证，见t08-final-cli.log（19/19）及t08-final-typecheck.log。真实management容器完整参数TTY直接退出；首轮人工文本完成undefined已定位为结果缺command字段，补元数据及人工输出回归后再次通过。t08-management-tty.log记录0600文件正常密码与管理员HTTP均200；宿主文件mode0600/UID501/GID20（jkoo/staff，t08-secret-scan.json），Docker Desktop bind mount在另一个checks容器看到uid0属于映射，不当作宿主属主证据。最初旧镜像新路由404对401期望失败（t08-red.log），实现后真实回归。

tests/login-methods.test.mjs共15项（含父测试），真实SQL/HTTP监听与spawn的管理CLI，不stub会话、权限或审计。只有外部Feishu transport模拟；覆盖：

- 未登录/普通用户拒绝，同源/确认/未知字段；目标身份而非管理员身份，新密码正常登录后新OAuth验证，不绑定未验证身份，回调不给登录Cookie。
- 飞书identity占用/已有不同身份、用户名占用、不合并；重放OAuth/最终确认/重复验证、取消/过期请求、15分钟默认值/5分钟两个正常方式截止、目标版本变更。
- 同请求并发确认只成功一次，两个目标先各自验证同一subject再并发最终确认只一方成功；第二次开始OAuth废弃第一state；已撤销的证明会话回调失败，无新身份。
- Web随机启用及重置no-store/no-cache/Expires:0，查询无法复取秘密；旧密码和旧Feishu Cookie全401，新密码正常保护请求成功，同账号user角色保持。
- CLI启用/人员重置/Agent重置0600独占文件，不打印密码，缺文件不提交、已有文件拒绝；自身Web重置409，只有最后密码管理员时CLI新文件重置后可正常管理访问。
- 关联审计故障：密码未写、请求可恢复、CLI临时文件删除；重置审计故障：版本/旧会话保留、Web503不报成功、CLI文件清理。
- 锁等待期间操作者版本已提交变化，HTTP重置401且目标未改；T07失败计数重置后不清除；停用密码重置后仍不可登录。

完整suite同时覆盖T04有效管理员/责任Agent、T05持久会话/并发授权边界、T06角色权限及CLI/Web降权、T07多实例失败限制和真实Next SSR故障等既有链路。未重跑无关独立安装/主题全矩阵。

## 真实网页

使用ego-browser TaskSpace38，仅本票隔离127.0.0.1:31030页面；结束finish关闭，不操作Ego31。普通密码账号与admin用真实管理CLI创建，随机秘密仅读私有文件填正常表单，不打印；外部Feishu页面、token/user_info只在auth-browser工具fixture模拟，真实SQL、会话与权限保持。测试fixture可选TEST_AUTH_PUBLIC_URL和JSON授权URL改写不进入生产镜像。

真实页面依次：管理员重置下载完成（failure=null）；发起飞书、目标正常密码登录/账号页验证、隔离外部OAuth回调、管理员确认，再正常Feishu登录仍同ID13/零角色；启用停用密码方式请求、本人正常Feishu验证、管理员完成下载；浏览器注入一次URL.createObjectURL抛错模拟交付故障，页面明确已提交但下载失败，刷新最新版本再次明确重置下载并正常登录恢复。禁用密码是隔离SQL场景准备，没有生产模拟入口或实际人员改动。

t08-browser-evidence.json：DOM与浏览器存储未含生成密码，下载failure=null，profileId13/roles空/业务403；证明关联/启用不隐式授业务权限。390px窄屏scrollWidth=390，代表性t08-narrow-delivery-failure.png检查同品牌变量、确认/错误完整可读。没有依赖浏览器控制台/请求体捕获秘密。取消下载后无法复取，只能明确再次重置；本票不声称浏览器自动保证文件权限或安全交付。

## 文档、边界与限制

codebase-memory先index/search/trace/snippet，依赖文件check_index_coverage，新代码及0006无记录解析缺口；这是best-effort信号，SQL和配置另直接读/实际验证。Context7核对Fastify Reply头、React异步Effect清理；SQL写前Postgres技能。官方授权页首抓仅壳内容，重新wait/max-age=0后得到完整395行；完整token和user_info文档同读，来源链接在合同。复用既有Confidential Client/client_secret协议、一次性state/browser及严格组织验证，不请求新增外部权限。

Web下载与文件/SQL非原子、网络或COMMIT未知恢复步骤明确记录；没有强行宣称未知结果未提交。真实飞书组织/个人授权关联验收仍未完成，T03保持人工待办；生产TLS及Linux/WSL2矩阵另待部署验收。原.env未修改/回显，不操作真人权限/通知。原0004升级要另行计划与备份，不因本票测试迁移。

生产API镜像tests目录不存在、login-methods模块及0006存在（t08-production-boundary.log）。随机凭据扫描37项本票日志/证据无明文命中（t08-secret-scan.json）；私有随机凭据和工具容器清理后保留非敏感日志/截图及0600测试备份。最终服务和清理证据t08-final-services.json/t08-cleanup.log，工作区本地提交后干净。
