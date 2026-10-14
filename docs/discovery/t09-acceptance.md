# T09 管理审计查询与运行日志留存验收

日期：2026-10-15。来源：Gitea Swython/Templux #10及父规格#1，ADR0026/0027/0028。实现基线：f904dc39ca5added39e1d73d8992cf1fc8078f20（已有24个本地提交全部保留）。本文件是开发验收，独立审查由TL另排。

## 实现范围

- 管理员 /admin → /audit，只读真实持久审计。API在共享授权事务锁后复验会话/最新权限，要求accounts:manage与audit:read。查询事件/安全操作者、来源、目标、结果、时区时间及分页；总数与分页同语句快照，原始微秒保留。空结果有表头，失败不报空结果。
- 新0008增加结果、操作者可信度/账号、人员或Agent归属责任快照、system来源与时刻/来源时刻索引；0001–0007未改。历史记录legacy，不捏造身份。安全DTO与审计writer显式允许字段，CLI宿主声明和应用验证身份区分，责任人不冒充Agent。
- 审计90天默认阈值，可配置；启动/周期后台短批清理，try事务锁及SKIP LOCKED，多实例防争用。删除与摘要同事务，失败回滚；每周期批次有界，关闭停止下一批并等待当前批后再关池。
- API/Web结构化允许字段日志；错误类别/阶段/状态保留，原请求URL、载荷、原始异常文本/stack及凭据丢弃。Docker json-file默认每容器10MiB×10，三长期服务约300MiB；工具服务额外预算，约14天是目标而非保证。Docker/CLI查看，JSON结果stdout、诊断stderr，无运行日志网页/导出。
- 关键管理强审计与正常登录单独审计失败例外保持；认证拒绝匿名最佳努力、普通运行日志不改变业务结果，非DB运维动作后最佳努力审计且不阻塞停服救援。完整逐类合同见 [实现合同](../specs/audit-and-runtime-implementation.md)。

## 隔离、迁移与先失败后通过

原安装api/web/database和真人授权环境保持原容器、原0004；未读取/修改部署秘密、.env、真人权限或Ego31，未发通知。使用tools auth-database的templux_auth_test（tmpfs），生产镜像没有测试认证入口；HTTP登录/CLI/持久SQL真实贯通，外部Feishu协议仍仅隔离模拟。

新增SQL前加载supabase-postgres-best-practices，按事务/索引/锁规则实施。先将隔离库迁至基线0007，docker compose exec -T auth-database pg_dump -U templux_test -d templux_auth_test -Fc保存test-results/t09-pre8.dump，权限0600；独立scratch PG用pg_restore --exit-on-error恢复，验证最高版本0007后销毁scratch。证据t09-restore.log。随后仅隔离库应用0008，完整suite逐次验证历史迁移/ready，不在真人0004强行升级。

先在旧实现真实HTTP查询 /api/admin/audit：得到404（期望未认证401），t09-red.log。实现第一权限回归通过，t09-first.log。后续扩展事件、时间、清理/锁、日志故障及真实页面。

结构探索按codebase-memory索引→search/trace/snippet，依赖文件检查coverage；SQL旧文件部分范围直接读取，修改源码最终18文件coverage metadata_match/no_recorded_issue（best-effort，不把无记录等同全量证明）。配置、文案、Compose、迁移直接读取。Context7核对Fastify LogController/日志流、Next自定义服务器目录与React使用、Node输出流和Docker轮转语义，实际安装版本/真实容器复验。

## 容器命令与结果

以下均在仓库根目录执行，不使用根部署数据库。构建只更新镜像，不重建原部署容器。

| 命令/步骤 | 结果与证据（test-results/） |
| --- | --- |
| docker compose build api checks management web | 成功；t09-current-build.log，包含单语句归属快照writer |
| docker compose run --rm --no-deps checks node --test --test-concurrency=1 tests/audit.test.mjs tests/audit-lifecycle.test.mjs tests/runtime-log.test.mjs | 20/20，零跳过；t09-targeted-serial.log |
| docker compose up -d auth-database password-api password-web ssr-body-api ssr-body-web | 隔离工具服务启动；t09-suite-services.log及后续web-dir-services.log |
| docker compose run --rm --no-deps -e TEST_API_URL=http://password-api:8080 -e TEST_WEB_URL=http://password-web:3000 checks npm test | 147/147，fail/cancel/skipped均0，约55秒；t09-suite-final.log |
| docker compose run --rm --no-deps checks npm run typecheck | API/Web均退出0；t09-final-typecheck.log |
| docker compose build web checks；隔离password-web重建 | 新文案审计总数与桌面宽度通过浏览器；t09-audit-count-build.log、t09-audit-width-build.log |
| python3 test-results/t09-logfixture/verify.py | 真Docker文件轮转及CLI读取成功；t09-rotation.log/evidence.json |
| python3 test-results/t09-logfixture/rescue.py | 隔离三容器真实stop退出0；DB不可达审计诊断仍有；t09-rescue.log/evidence.json |
| docker compose rm -s -f password-api password-web ssr-body-api ssr-body-web auth-database | 全部本票隔离服务删除；t09-cleanup.log/final-services.json |

调试历史保留：第一次针对性测试遗漏serial，多个文件并行撞已有迁移锁，正确拒绝；改用serial后20/20。首次完整suite为136/140通过：Web直接node入口的根工作目录使Next找不到app，4项系统/Web失败；明确next dir为当前apps/web后重新构建，最终147/147包含SSR断流/401/403/恢复。修复的是真实入口问题，不删测试。后续仅审计总数文案/CSS宽度变更，重新构建并typecheck/实际浏览器验证；未盲目重复SQL锁/整套昂贵构建。

## 真实SQL/HTTP/CLI矩阵

| 验证 | 实际结果 |
| --- | --- |
| 未认证/普通账号审计API | 401/403；授权管理及审计读取都需满足，no-store |
| 真实登录→CLI授权→HTTP网页管理事件→查询 | verified_identity、host_claim、application_session及真实before/after均对应已提交SQL；CLI声明无应用actor账号 |
| Agent后改责任人 | 历史actor/target责任快照仍原负责人；人员/Agent独立身份 |
| 历史任意actor/details | legacy未知，不显示秘密，不允许用隐藏原actor搜索秘密 |
| source/target/result/q、分页夹紧 | 13行/每页5/超末页夹至3，稳定倒序；百分号按字面匹配；非法参数400 |
| 时间边界 | 含时区from含、to不含，000002微秒精确筛出唯一记录；Asia/Hong_Kong显示09:02:03，不截断原微秒；非法日期/反向微秒区间拒绝 |
| 查询与CLI并发变更 | 查询实际等待授权锁，提交降权版本后按最新会话401，不沿旧权限快照放行 |
| 匿名拒绝与审计故障 | 拒绝不带用户名/推测目标；触发器使拒绝审计故障，仍401且诊断，无成功记录 |
| CLI init正常结果 | 使用临时presentation路径，SQL实际maintenance_command成功/host_claim，JSON可解析；不改项目配置 |
| 清理时间/批次/锁 | 严格cutoff之前删除；正好cutoff及更新保留；30天覆盖、batch1/max2只删2；try lock跳过、多实例有界 |
| 清理摘要或DELETE失败 | 当前批旧行保留，摘要失败回滚删除；API仍ready且安全诊断不带原触发器文本 |
| 清理与正常强审计并发 | 真实trigger阻塞清理摘要事务，CLI授权正常提交，再释放清理；两方记录均保留，无互相覆盖 |
| 关闭清理 | onClose在真实锁阻塞时不完成；释放后仅当前批提交，不开下一批 |
| 登录/关联/密码/会话/最后管理员/限流既有风险 | 完整147项保留原HTTP/CLI、持久SQL、Feishu隔离协议、密码/Agent、T05会话、T07限制、T08用途竞态、SSR断流等回归 |

## 实际Docker日志容量与救援

命名独立fixture项目templux-t09-rotation，使用真实生产API镜像/shared runtimeRecord，在api/web/database三个自有容器生成各9000条安全记录；这是Docker驱动容量验证，不声称三者运行了各自完整产品服务。16KiB×3配置，readonly stat只访问各自LogPath目录，不读其它容器或宿主秘密。

| 容器 | 真实文件数 | 合计字节 | 最新计数 |
| --- | --- | --- | --- |
| fixture api | 3 | 47544 | 8999 |
| fixture web | 3 | 47537 | 8999 |
| fixture database | 3 | 47535 | 8999 |

三者均小于48KiB，旧事件已淘汰，说明容量可早于14天。Docker tail与实际management logs --json均读到最新记录；stdout仅ok/command，stderr有日志。私有marker被名单丢弃。配置范围、错误原文/请求/token/code/state剥离、Pino完整record过滤与write故障另由runtime tests实测。

随后同一自有fixture替换为实际持续运行容器，通过真实management stop --confirm --json，DATABASE_URL为隔离不可达localhost:1：退出0，三容器均停止，出现maintenance_audit_unavailable；未把无法保存审计说成已保存。两fixture均down销毁，没有执行原安装stop。

## 真实浏览器

Ego独立TaskSpace40，地址127.0.0.1:31040，仅正常密码表单；CLI创建隔离admin、user、Agent，Web给隔离user授普通角色并保存真实审计。受限0600密码文件只由本地脚本读用于填写，不打印。

- 管理员从/admin打开/audit，实际呈现真实password登录、CLI授权和Web角色变更、Agent负责人快照；9字段列，品牌变量沿既有模板。
- 搜索authorization_changed、来源password、目标5筛出真实已提交Web授权，安全摘要before空角色→after user。非法时间有明确错误；未来时间空结果保留9表头。t09-browser-query.json。
- 普通人员及Agent正常登录后直接审计API均403，审计页返回/account且不误退登录；Agent账号6的负责人4单列。t09-browser-permission.json。
- 每页5、下一页2/8、末页8/8禁后翻、首页按钮状态均正确；t09-browser-pagination.json。
- 最新1680桌面表1390px/内容1390px，所有列完整；390窄屏页面scrollWidth390，表viewport348/content1040，横滚只在表内。t09-browser-layout.json；t09-audit-desktop.png、t09-audit-narrow.png。审计总数标注已修正为事件数。
- TaskSpace40完成并关闭，未接触用户Ego31；本票三受限交付文件清理。真实随机密码扫描42份T09日志/JSON零命中，t09-secret-scan.json，不将私密dump扫描结果当全文公开保证。

## 交付边界与局限

实际平台为本机macOS/Docker Desktop及Linux容器/Chromium；不代替Windows/Linux宿主全矩阵。没有真实组织外部飞书凭据调用；T03真人授权验收仍独立未完成。

自动清理是过期阈值加有界批次，积压/服务停机/审计故障会延迟，90天非精确删除时钟。运行日志14天只是容量规划目标，单条Docker驱动末记录/元数据有小额边界，非全宿主硬配额。工具容器各自额外预算，生产数据库原生日志由Docker JSON封装而非应用事件格式，不扩大集中日志基础设施。

原/api/status最终ready/database connected/schemaVersion0004，原/login200，见t09-original-status.json。现存原服务不声称应用0008/新轮转；正式升级需要另排备份与容器重建。测试库/工具容器和自有fixture已销毁，私密临时交付删除，保留0600隔离备份及忽略目录中的日志/图像便于独立复核。

实际生产API镜像内部检查：tests目录不存在，审计模块、0008迁移和安全runtime模块存在；t09-production-boundary.json。仅这三项文件存在检查不替代真实HTTP/SQL验证。

仅本地提交，不推送、不关闭工单。代码范围、运行合同及此验收可供TL安排独立审查；不改变T03真人待办或先前初审历史。
