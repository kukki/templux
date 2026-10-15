# T21 验收：持续维护提醒与停服入口

Gitea #22 / 父#1故事85、86；基线 `aa5f0c53b769e9ff800c0697b6a7262cd9e7a1e4`，保留67个既有本地提交。实现合同[maintenance-operations.md](../specs/maintenance-operations.md)，设计/实施顺序[计划](../superpowers/plans/2026-10-15-t21-maintenance.md)。只操作自有`t21-dev`和`t21-other`项目；原部署0004、.env、现用presentation、Ego31、真人权限和飞书均未改动。#4真实组织人工验收仍独立pending，不以密码测试冒充完成。

## 交付范围与失败合同

宿主授权CLI菜单18–24及完整参数入口管理提醒和业务停服，明确确认/最新版本CAS/维护操作锁。SQL状态及关键审计同事务；计时归零不自动停服/只读，提醒独立持续显示，不占普通通知容量。entry长期运行，正常反代Web，offline提供项目风格503维护页；DB或释放状态未知显示不同的不可用503，不删除会话Cookie。

写屏障覆盖8个既有核心表INSERT/UPDATE/DELETE/TRUNCATE，事务共享锁持续到提交/回滚；停服先独占锁排空在途写，再提交offline/审计后停止Web/API。审计/维护/迁移元数据保留恢复职责；新业务表及外部写者须显式接入，不声称任意表或DB owner均受约束。

恢复先启动/健康检查既有镜像，再确认SQL提交，最后原子发布版本回执。提交ACK未知不发布；缺失/损坏/旧回执不能开放entry或业务API。SQL已online但回执尚未发布/不匹配仍公开关闭，核验后明确resume重建，并要求新的强审计。新库gate=0且无回执可首次启动；维护后不能靠删除回执绕过。服务/数据库/共享卷不是跨系统原子事务，不自动重试或部署。

## 源码验证点（严格区分时间）

| 验证点 | 结果与证据（均位于test-results/） |
| --- | --- |
| 追加0010后完整SQL/HTTP/CLI/真实Web回归 | `t21-full-verified.log` **279/279，0fail/cancel/skip，59.8s**；当时checks镜像`3572e7210af9…`。包含完整维护协议、写屏障、恢复回执、API/页面及此前认证/授权/会话/审计/控件回归。**之后只补人工CLI显示accessReady，以及仅清理自己已创建临时文件的保护；未把279冒充最后两处改动之后的全套运行。** |
| 最终源码专项 | `t21-package-targeted.log` **21/21，0fail/cancel/skip**，维护/HTTP/CLI三文件；包含实际子进程的人类/JSON状态输出、确认拒绝、事务/锁/回执故障。最终image内测试源码，无宿主测试覆盖旧镜像冒充 |
| 最终类型检查 | `t21-package-typecheck.log` API和Web均退出0 |
| 构建 | 初始正常Dockerfile API/Web/management/checks成功；registry HEAD后续超时，改已有本地依赖镜像离线派生构建，`t21-offline.Dockerfile`保留确切步骤。最终API/management日志`t21-{api,management}-delivery-final.log`，Web`t21-web-final-latch.log`，最终checks`t21-checks-package-final.log`均成功。未更改发布Dockerfile/依赖锁、不推送镜像或部署原服务 |
| 最终真实文件发布失败 | `t21-delivery-atomic-publish.log`：真实共享卷目标为目录，临时文件写入/fsync后rename失败，SQL确已online但entry/API保持503、内部health200、临时文件0；明确核验后resume强审计重建成功0644 |
| 最终实际回执异常 | `t21-delivery-release-faults.log`：缺失、坏JSON、旧gate、旧schema、错误类型、多余字段、不可读共7类，entry/API503且不清Cookie，内部health200；显式CLI重建后entry200，匿名业务API恢复正常401，非绕过认证 |
| 人工菜单 | `t21-menu-tty.json`：真实TTY显示菜单18–24，选择18退出0，人类结果含accessReady。旧输出遗漏该字段的真实子进程RED为`t21-human-cli-red.log`；最终21项验证true/false均可见，机器JSON仍仅一条结果 |

可复跑最终专项：

```sh
docker run --rm --network t21-dev_default -e TEST_AUTH_DATABASE_URL=postgresql://templux_test:isolated-test-only@database:5432/t21_unit_final t21-checks node --test --test-concurrency=1 tests/maintenance.test.mjs tests/maintenance-http.test.mjs tests/cli.test.mjs
docker run --rm t21-checks npm run typecheck
```

完整点命令是同网络、显式TEST_AUTH_DATABASE_URL指向隔离templux_auth_test、TEST_API_URL=http://api:8080、TEST_WEB_URL=http://web:3000、TEST_SSR_WEB_URL=http://ssr-body-web:3000的`npm test`。其部署API按既有suite Origin合同临时用localhost:31040；浏览器前恢复自有127.0.0.1:31121。最终21另用`t21_unit_final`，避免改动浏览器/演练库。新空测试库无需迁移前备份。

`t21-delivery-images.log`、`t21-running-images.log`和`t21-source-integrity.json`记录最终镜像、运行实例以及主机/镜像源文件、编译文件SHA256匹配。Web最终镜像`32f255498ddb…`；4张截图对应该Web及未再修改的shared维护页模板/样式。后续仅CLI人类输出和API文件临时清理调整，不声称重做无关控件矩阵。T02配置重启脚本加入entry；独立Web配置工具明确无entry代理，shell/Python语法检查及`t21-direct-web.log`真实直接Web200，未重复昂贵T02/T10矩阵。

## 迁移与独立新安装

0001–0008不变。隔离0008先pg_dump -Fc到`t21-before-0009.dump`，chmod0600，再scratch `t21_restore`真实pg_restore --exit-on-error；`t21-scratch-restore.log`验证0008与600权限。0009已应用后，增强回执时追加0010，未改已应用0009；再0600备份到`t21-before-0010.dump`，scratch `t21_restore_0009`恢复，`t21-scratch-restore-0009.log`确认0009/8条合成账号。随后`t21-migrate-0010-real.log`确认0010/applied1。备份包含测试数据，保留0600，不是环境/.env备份，不据此承诺后续备份产品功能已完成。

`t21-other-install.log`为第二独立Compose从空库实际迁移10项并启动API/Web/entry；`t21-other-isolation.json`确认gate=0、无回执、正常登录页200、无默认账号授权。两个实际维护卷为`t21-dev_t21-release`与`t21-other_t21-release`；`t21-cross-project-fault.log`另一项目错误回执使其entry/API503而主项目仍200，恢复新安装条件后200。默认根Compose另以无.env/清空秘密环境渲染两个项目，`t21-root-compose-isolation.json`确认各自maintenance卷名、entry/API只读/management可写、公开31000归entry且Web不发布端口。不得手工让不同项目共享该卷；回执不是跨项目认证凭据。

## 实际停服、失败与救援

版本化驱动`tests/scenarios/maintenance-{operations,release-faults,publish-failure}.mjs`只允许自有test-results/t21-deploy及t21-dev项目，不打包入API或Web生产入口。挂tests只读到一次性management容器，entrypoint node，operations显式执行halt/recover两阶段；截图位于两阶段之间。

- `t21-real-halt.log`：缺confirm拒绝；关键gate审计故障回滚，版本/phase不变且页面200；真实写事务持共享锁，CLI未提前停止，随后真实HTTP活动写也等待；原事务ROLLBACK后CLI提交offline并实际停止业务，排队HTTP503、last_active_at未变，entry与DB仍运行、维护页503。离线cancel/end均拒绝，不绕过恢复。
- 同日志验证实际三级代理来源：伪造XFF/私有头连续变换仍401/401/401/401/429/429，真实客户端IP+规范用户名对应同一SQL key/failures5；另一独立容器同用户名仍401，未塌缩成entry/Web单IP。
- `t21-real-health-failure-verified.json`及stderr：实际注入Web health probe失败，Docker观察unhealthy、resume非零，SQL版本不变/offline/accessReady=false；恢复原测试配置后再明确resume。早一份脚本错误地从后续status读取stderr的布尔不作此证据，已保留。
- `t21-real-recover.log`：恢复后停服前真实密码会话仍200，提醒active；Docker目录故障后SQL已offline但不假成功；恢复启动失败不改offline；发布文件失败SQL可online而entry及API仍503，status明确accessReady=false，显式强审计重建后正常0644。
- 同日志：实际停止自有DB，entry仍存活且显示未知503；rescue真正停业务，JSON只声称containersStopped，barrierVerified/auditSaved=false且stderr有maintenance_audit_unavailable。status非零，DB回来状态仍保留、业务仍停；先halt建立可靠屏障，再resume/end；另一次start/cancel真实清除提醒。无自动重试/部署。
- `t21-entry-restart.log`、`t21-browser-restart-notice.log`：entry/API真实重启后持久active、gate6回执及提醒仍在；普通业务重启不冒充撤销。最终原子rename故障和7类回执异常均使用最终publisher代码重验。

提交回执丢失在专项中以真实Postgres COMMIT完成后客户端包装器抛错控制，确认SQL确已online、afterCommit发布调用0、旧回执不匹配。不是生产测试开关，也未破坏原环境网络；实际HTTP故障验证缺/旧回执时公开入口及业务API拒绝。强审计失败包括offline恢复及已有online修复的fresh release授权，均不发布门闩。

## 真实浏览器与风格

Ego自有76，正常密码页随机CLI凭据登录人员与责任人关联Agent，分别protected200、accounts管理403；管理员正常密码登录audit200，26条维护相关记录可查询，包含release授权；CLI actor均host_claim/actorAccountId=null。文件只交付自有0700目录/0600JSON，未打印秘密。`t21-browser-{login-queue,persistence,restart-notice,admin-audit,cancel-channel}.log`、`t21-agent-login.log`及setup记录保存证据；版本化浏览器helper为`tests/scenarios/maintenance-browser.mjs`。

维护出现时实际3条普通通知、32条等待，倒计时从13秒变化并到点仍显示；真实protected写活动仍200。刷新/导航后仍在，Hong_Kong时区正确；1440和390均无页面横溢出，窄屏菜单/Escape不取消提醒。另一次满队列：维护bottom72.09、普通top88.09，普通bottom563.22<1000视口，3条显示/50等待；取消后提醒消失/高度变量清理，普通top回16，3条显示/20等待仍在，未清理普通通道。

Ego负责交互；已知Ego截图超时不重试矩阵，使用独立agent-browser命名会话`t21-maintenance-proof`实际Chromium截图，逐张查看：

| 状态 | 1440×1000 | 390×844 |
| --- | --- | --- |
| 公共登录页上的持续提醒 | t21-notice-desktop.png | t21-notice-narrow.png |
| 业务确已停止后的独立维护页 | t21-offline-desktop.png | t21-offline-narrow.png |

PNG为真实页面，不是生成图或DOM仿画。品牌/配色/文字清楚，无页面横溢出或截断关键入口；维护页不依赖已停止Web的脚本/图片。未重复4主题×方向16图或物理设备/软键盘/读屏/全浏览器矩阵。

## 失败尝试、来源及收尾

初始SQL/模块RED为`t21-red.log`；最初工具配置副本漏auth-copy，补齐公开配置后服务健康，未掩盖产品错误。第一轮完整suite Origin不匹配导致5失败，隔离配置修正后275全过；该275仍是追加回执增强之前历史点。registry构建超时曾留下旧镜像标签，其后13项旧代码结果不作最终证据；改set -eu及离线本地源构建后0010、279、最终21和实证分开记录。早期HTTP测试清理顺序错误已修复，最终不用force-exit，均正常结束。浏览器驱动语法笔误修正后采到真实13秒→到点，不用失败输出冒充验收。

结构按codebase-memory索引/search/trace/snippet及37路径覆盖检查，信号best effort；0009 PL/pgSQL局部解析缺口直接通读并以真实SQL/并发验证，新驱动变更后读源码/重索引；0005既有解析缺口同样直读，未把图完整度当安全证明。Postgres写改前已加载技能。Context7核对[Postgres锁](https://www.postgresql.org/docs/18/explicit-locking.html)与[Node HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html)；React Context7请求超时，改[React官方effect cleanup](https://react.dev/reference/react/useEffect)核对取消及过期响应原则。

最终源码点不是跨平台SLA：默认本地持久卷、受控宿主Docker、入口/DB仍活为前提；连接/进程异常须核对在途Docker动作，不以session锁冒充跨系统原子事务。直接DB owner或未接入表不在业务屏障保证内。约14天运行日志仍是容量目标，新增entry有独立json-file预算，不建集中日志或网页日志浏览器。

`t21-secret-scan.json`只记录自有生成凭据/会话在公开证据中的匹配结果，不扫描或输出实际.env秘密。交付前关闭Ego76/命名截图会话，删除自有两套Compose容器/数据及维护卷/私有交付目录和工具缓存；`t21-cleanup.log`与`t21-original-status.json`记录结果。保留可审查镜像、公开日志/截图和0600隔离备份，不push、不关闭#22，待TL独立审查。
