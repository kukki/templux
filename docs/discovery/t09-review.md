# T09 独立审查：审计查询与日志留存

日期：2026-10-15；审查者：审查。范围 `f904dc39ca5added39e1d73d8992cf1fc8078f20..b075577b817ba08ac0748724af6ee2bda523661a`，开始时HEAD为后者、工作树干净。同一独立审查者依次完成Standards/Spec，没有新增成员。

## 双轴结论

| 轴 | 结论 | 发现 |
| --- | --- | --- |
| Standards | 无需另立规范问题；以下配置合同偏差归入Spec F1 | 0项独立发现 |
| Spec | 核心查询、清理、日志与救援实测通过；先修复F1再按 #10 验收 | 1项P2 |

读取Gitea #10/#1、ADR0026/0027/0028、仓库规范、实现合同、验收、计划及全部34变更文件。未以开发报告代替本次独立执行；未修改实现/部署/.env/真人权限或原0004安装。

## F1 · P2：Compose把显式空的审计配置静默换成默认

**位置**：`compose.yaml:4`–`:7`；同一回退模式还存在于`:8`、`:9`、`:31`、`:32`及Web/management运行日志环境。应用侧对应 `apps/api/src/audit-settings.ts:2` 与 `shared/runtime-log.mjs:4`。

**触发与实证**：操作者将新配置设为空，例如shell或.env中的 `AUDIT_RETENTION_DAYS=`。Compose使用 `${AUDIT_RETENTION_DAYS:-90}`，在应用收到环境前将空值变成90。实际执行六项显式空shell配置的 `docker compose config --format json`，只选择并输出api环境中这六个非秘密键：四项AUDIT分别变成90/1000/10/3600，运行容量两项变成10485760/10。原部署没有被重建，完整渲染中的其它环境没有输出。证据 `test-results/t09-independent-empty-config.log`。

**合同/影响**：`docs/specs/audit-and-runtime-implementation.md:43`明确审计清理配置“空值/非法/越界拒绝启动”。auditSettings直接收空值确实拒绝（独立专项已执行），但正常Compose入口将其吞掉，使validator永远看不到该错误，静默采用操作者未明确设置的保留/清理策略。此发现是配置合同及检测缺口，不是认证绕过，也不声称正常默认值不安全。已有测试仅直接给Node环境空值，未验证Compose实际插值。

**建议**：对本票新配置使用只在未设置时默认的 `${VAR-default}`，或在宿主实际入口显式拒绝空值；同步API/Web/management环境及Docker容量选项，避免同一值在不同层再次吞掉。补Compose/实际工具入口的“未设置默认成功、显式空拒绝、合法覆盖成功、非法/越界拒绝”对照，并保持DB不可达时stop救援语义。不要扩大修改既有无关配置。

进一步独立渲染三组对照（t09-independent-config-controls.json）：使用 `docker compose --env-file /dev/null config --format json`，子进程环境中仅为这六项移除/赋空/赋合法值；stdout完整内容仅在内存解析，文件和工具输出只含六个api环境键。未设置与显式空均得到90/1000/10/3600/10485760/10；合法覆盖得到30/200/3/120/32768/4。即合法覆盖工作正常，缺陷仅是明确的空输入与未设置被混同，不涉及基线其它env变量；没有更改或输出用户.env。

## 已核对的Standards与Spec范围

- `/admin`进入只读`/audit`，SSR audit-access与查询API都要求accounts:manage和audit:read。query在共享授权锁后同客户端重读会话/版本/状态；HTTP等待CLI变更后401，无旧权限放行。普通用户直接403，Agent责任人/开关沿既有会话规则；没有导出或运行日志网页（`audit-query.ts:6`、`auth-routes.ts:42`）。
- 查询明确事件/安全actor文本、source/target/result及含时区时间；字面LIKE、正bigint ID、合法日期、from含/to不含和六位微秒均验证。计数/夹页/行列表同SQL语句快照，稳定时间/ID倒序，错误不装为空结果（`audit-query.ts:3`、`:13`）。时区默认Asia/Hong_Kong到秒，原时刻不截断。
- 0008仅追加结果、身份可信度、类型/Agent责任快照和索引，0001–0007未改。旧记录legacy；CLI数字UID或unknown仍仅host_claim，任意自报名称丢弃，不映射应用账号。writer的INSERT SELECT同语句捕获归属，后续改责任人不反写旧事件；详情与DTO只保留名单，历史原actor不能成为隐藏搜索字段（`audit-store.ts:20`、`:26`）。
- 自动清理try事务锁、SKIP LOCKED、有界批次与精确cutoff；删除和摘要强审计同事务，摘要/DELETE失败当前批回滚。并发正常强审计继续提交；同实例防重入、onClose等待当前批且不再开下一批，随后API关闭池（`audit-retention.ts:3`、`:11`、`server.ts:10`）。没有精确90天时钟承诺。
- 密码/飞书正常登录独立成功审计例外保留；关键创建/授权/关联/撤销等仍同事务审计。匿名认证拒绝最佳努力，不猜用户名/目标；非数据库运维动作后记录实际结果，审计不可达不改变stop结果。完整147项复核共享writer对既有强审计和认证路径的影响。
- API Pino destination、Web console/error adapter允许字段输出保留阶段/HTTP/已知错误码，丢弃原URL、请求、异常message/stack和秘密。Docker json-file同时有max-size/max-file；按每容器预算轮转，不宣称全宿主硬配额或保证14天。CLI日志在stderr，stdout仅JSON结果；未知服务选择和未知参数非零拒绝。

code-review采用双轴；结构按codebase-memory search→trace→snippet并逐路径coverage，全部34变更文件metadata_match、无报告缺口；SQL直接完整读取，图为best-effort。Postgres技能核对短事务/锁/批清理，Context7核对Fastify LogController/custom stream、Docker轮转与两种默认插值语义。配置/文案及非代码规范直接读取。

## 本次独立执行

复用镜像，独立auth-database应用0008及工具password/SSR服务；原默认API/Web/database仍0004、未迁移重启。共享writer及Web真实入口变化涉及已有强审计/SSR，故在20项专项后执行一次完整回归；未重建或重跑浏览器矩阵。

| 命令/风险场景 | 实际结果与本次证据 |
| --- | --- |
| checks `node --test --test-concurrency=1 tests/audit.test.mjs tests/audit-lifecycle.test.mjs tests/runtime-log.test.mjs` | 20/20，fail/cancelled/skipped均0；t09-independent-targeted.log |
| checks `npm test`，明确 `TEST_API_URL=http://password-api:8080`、`TEST_WEB_URL=http://password-web:3000` | 147/147，fail/cancelled/skipped均0；t09-independent-suite.log |
| checks `npm run typecheck` | API/Web退出0；t09-independent-typecheck.log |
| 独立项目templux-t09-review-rotation，复用生产API/runtimeRecord生成3×9000记录，读取各自Docker文件 | 每容器3文件，47748/47529/47525字节，最新计数8999；16KiB×3预算内，旧事件淘汰，私有marker不见；t09-independent-rotation-evidence.json/log |
| 同自有fixture实际management `logs --json --non-interactive` | exit0，stdout仅ok/command，stderr有保留日志，无marker；包含上项证据 |
| 同自有fixture实际 `stop --confirm --json --non-interactive`，DATABASE_URL指向隔离不可达127.0.0.1:1 | exit0、三个自有容器均停止、maintenance_audit_unavailable明确存在；t09-independent-rescue-evidence.json/log |
| CLI logs未知服务选择/未知选项 | 非零，JSON错误“只允许一个管理命令”/“未知参数”，诊断为结构化management_failed；t09-independent-cli-service.log、option.log |
| 真Web镜像内预占3000再启动产品入口 | 仅安全JSON framework_runtime/EADDRINUSE，未见原异常/stack；t09-independent-web-port-error.log。日志候选已排除；测试预占server保持句柄，随后明确停止该自有容器，不声称此实验验证产品退出码。 |

独立轮转/救援使用复制至本次忽略目录的fixture脚本与新项目名/证据文件，不覆盖开发证据；只读取自有容器LogPath目录。三fixture均用API镜像产生安全记录，验证的是Docker驱动容量，不称为完整API/Web/Postgres业务运行。它们以及本次工具库/服务、启动故障自有容器均已移除。

开发浏览器query/permission/pagination/layout证据另行读取：普通人员与Agent直接403、页面回account；1680px桌面表1390px，390px页面不横溢、表内348/1040横滚；本次未操作浏览器。开发0007备份恢复日志最高版本0007，生产boundary显示无tests且有审计模块/0008/runtime；本次核对源码与记录，未重复备份恢复或秘密文件全文扫描。

## 剩余局限

- F1需修复复核；其它本次范围没有发现需要另立的问题。现有147项通过不覆盖Compose吞空值场景。
- T03真实飞书组织人工、生产TLS及Linux/WSL2/其它宿主矩阵保持另列，未操作Ego31或真人身份。
- 未注入真实网络COMMIT回复丢失、长期磁盘/I/O丢失、无流量多日调度或大规模积压。清理90天是可淘汰阈值，14天日志是目标，容量先到可早淘汰；停用/并行工具容器另占预算，不包含全Docker宿主硬配额。
- 轮转验证并不证明每种原生Postgres错误均经过应用JSON adapter；Postgres由Docker JSON封装，协议与密码输出边界仍需实际部署控制。默认旧容器未自动获得本票轮转配置，正式升级另行备份/安排。

本次仅可提交本审查文档；工作范围没有修改实现/部署/.env/真人权限、推送或关闭工单。官方文档核对：[Docker json-file](https://docs.docker.com/engine/logging/drivers/json-file/)、[Compose interpolation](https://docs.docker.com/reference/compose-file/interpolation/)、[Fastify logging](https://fastify.dev/docs/latest/Reference/Logging/)。

## 2026-10-15 F1 修复定向复核附录

范围 `fd037daaff73b3e3125861379a1b2f5e30b74e77..e57c3252037a79f0496c9c3e14b397757c4d5ed7`；开始时HEAD为后者、工作树干净。读取修复验收、合同补充及全部5文件差异，保留以上初审历史。

**最新结论：F1关闭，无新增发现。Standards/Spec通过；结合初审正常路径及本次复核，T09可按 #10 验收。T03真实组织、生产TLS/宿主矩阵等既有局限仍另列。**

- Compose仅对六个T09新键改用unset-only默认；API六项、management六项、Web两项容量以及所有服务Driver options一致，未扩大既有env修改。start/config-check在任何build/up/migrate动作前调用同一auditSettings，容量仍复用runtimePolicy且CLI给明确安全错误。四项AUDIT校验没有全局加到stop/status/logs等救援动作（`compose.yaml:4`、`:31`、`:118`，`manage.ts:87`、`:137`）。
- 本次实际复用tests/compose-audit-config.py的独立副本，仅改证据输出文件名，执行23组/45次一次性入口：unset得到原默认；合法六值30/200/3/120/32768/4实际生效；六键逐一empty/越界/非数字均原样到容器且非零拒绝。API真实createApplication→listen→/health/live HTTP成功后输出有效设置；CLI config-check正常JSON成功或安全非零错误。probe数据库固定不可达127.0.0.1:1，CLI DATABASE_URL为空，不接触原部署数据；健康指live，不据此宣称数据库readiness。
- 两容量空值在Docker options层先被Engine拒绝，非零/stderr且容器尚未执行，不能要求存在应用JSON；再以正常Driver options、container环境覆盖空值，API application_start_failed和CLI management_failed同样非零，证明应用不会依赖Engine偶然默认。start空AUDIT值精确返回审计留存配置错误，未进入Compose部署动作。
- 23组都在内存解析完整config，只保留六键及退出/安全诊断分类；API/Web/management与所有Driver options同值逐项断言。新Python文件仅为测试宿主回归，正常templux Shell包装及生产镜像不新增Python依赖、校验逻辑仍在容器。没有SQL迁移或新的数据库对象变更。

| 本次独立命令 | 结果与证据 |
| --- | --- |
| `python3 test-results/t09-fix-review-config.py`（原tests脚本仅独立输出名） | 23组/45入口全通过；t09-fix-independent-config.json/log |
| checks `node --test --test-concurrency=1 tests/audit.test.mjs tests/audit-lifecycle.test.mjs tests/runtime-log.test.mjs` | 20/20，fail/cancelled/skipped均0；t09-fix-independent-targeted.log |
| checks `npm run typecheck` | API/Web退出0；t09-fix-independent-typecheck.log |
| 自有项目templux-t09-fix-review-rescue、实际management stop、不可达DB | exit0，三个自有容器均停止、maintenance_audit_unavailable明确；t09-fix-independent-rescue-evidence.json/log |

本次20项仍包含强审计/清理摘要故障回滚、最新权限锁等待、匿名拒绝与审计例外、生命周期关闭及运行秘密剥离；既有跨认证/关联/会话完整147项证据保留，本次没有重跑147或浏览器/Web构建。救援是独立真实复测，不代替或覆盖开发t09-fix-rescue-evidence.json。

codebase-memory search→trace→snippet与coverage覆盖全部5变更及auditSettings/operational-audit/runtimePolicy/包装/Dockerfile依赖，metadata_match、无记录缺口；main的片段裁剪部分通过源文件直接读，图仍为best-effort。Context7再次核对Compose两种默认语义；Docker日志选项资料及初审实际轮转证据复用。

已删除本次自有救援fixture及auth-database；一次性probe --rm，默认API/Web/database原镜像持续healthy/原0004，没有迁移重启。没有改实现/部署/.env/真人、push或关闭工单。局限保持：Engine错误文本依版本可能不同、真实组织/TLS/跨平台未新增验收，约14天非保留保证及非宿主硬配额；实际应用空值拒绝已有独立证据，不依赖某版本Engine错误文本。
