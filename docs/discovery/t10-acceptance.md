# T10 受保护且可移除的控件示例验收

2026-10-15。Gitea Swython/Templux #11及父规格#1；基线8c114cfef8c81653de07ec98c3fe4a11afc9f81b，保留已有29本地提交。本文件为开发验收，TL另排独立审查。合同见 [component-examples-implementation.md](../specs/component-examples-implementation.md)。

## 交付

/examples通过既有真实/api/protected、持久Cookie/no-store/latest session和application:read检查准入；页面与合成数据目录独立，使用通用品牌、元素默认与SessionGuard。没有新示例业务API/SQL表、认证模拟入口或真实管理授权。

COMPONENT_EXAMPLES_ENABLED=auto/true/false；未设置/auto：DEV/UAT开启、PROD关闭，true/false显式覆盖。开关及部署环境的显式空/非法值拒绝Web启动和CLI start/config-check；Compose只在未设置提供默认，隔离工具默认DEV。开关不能开启Agent生产登录或授角色。关闭404且无合成内容，账号页隐藏链接。

三个独立合成样例，名称及标准/紧凑布局仅当前页面内存修改；重置、刷新恢复，不写Cookie/URL/浏览器存储或业务后端。展示已有分页/通知默认，必填/可选适配、数据失败演示、后续T11–T20合同已记录，不声称本票完成全部控件。正式模块不import示例目录/独立文案，删除路径分别实测。

结构探索codebase-memory search→trace→snippet，逐依赖及最终修改源码/测试coverage为metadata_match/no_recorded_issue，best-effort；配置、规范和SQL边界直接读。Context7核对Next request-time连接/notFound/redirect以及React lazy state初始化。前端技能沿既有蓝色设计变量，两栏桌面/窄屏单列、原生键盘控件与明确示例标识。

## 容器命令与结果

均在仓库根目录；只启动tools独立auth-database（tmpfs/templux_auth_test/0008）及自有容器，未迁移重启默认真人0004。没有新迁移或数据库对象；必要真实账号/角色/会话/审计仍为既有正常SQL合同。

| 命令/场景 | 结果与证据（test-results/） |
| --- | --- |
| 旧镜像checks挂载新tests/examples.test.mjs，TEST_WEB_URL=password-web | /examples404与预期匿名登录307不符，真实红灯；t10-red.log |
| docker compose build api management checks web | 退出0；t10-build.log；只更新镜像，不重建原默认容器 |
| docker compose up -d --wait --force-recreate password-api password-web | 仅工具服务，DEV与独立库；t10-services.log |
| checks node --test tests/examples.test.mjs，TEST_WEB_URL=http://password-web:3000 | 5/5，fail/cancel/skipped0；t10-examples.log |
| docker compose run --rm --no-deps checks npm run typecheck | API/Web退出0；t10-typecheck.log |
| checks npm test，TEST_API_URL=http://password-api:8080、TEST_WEB_URL=http://password-web:3000，SSR故障工具启动 | 152/152，fail/cancel/skipped0，约58秒；t10-suite.log |
| python3 tests/examples-config.py | 最终10组真实Compose+一次性Web/CLI通过；t10-config-matrix-final.log/json |
| 源码副本物理删除apps/web/app/examples及config/examples-copy.json，再docker build --target web -t templux-t10-no-examples test-results/t10-removal-source | 生产Web构建成功；t10-removal-build.log；不是仅设开关 |
| checks显式node --test tests/examples-removal.mjs，TEST_REMOVAL_WEB_URL=http://templux-t10-removal-web:3000 | 1/1；真实登录/账号/protected/admin/audit与移除404通过；t10-removal-http.log |

完整版152包含旧认证、强审计、会话、Agent、失败限制、OAuth用途竞态、SSR故障和本票准入。此后只调整Compose部署环境的unset-only插值及增加环境非法对照，正常默认不变；重新跑最终10组配置矩阵，没有盲目重复整套SQL/Web构建。

## 权限、配置与移除矩阵

- 匿名启用入口307→/login?reason=login_required；普通有角色人员与Agent200，含示例标签/初始内容/重置。两者直接accounts/audit API403，未授予管理权限。
- 零角色及Pending307→/account，实际/api/protected403且账号页无入口。Pending只在隔离SQL固定该状态（正常CLI创建、授权和密码登录后），不新增生产认证fixture。
- CLI正常禁用后旧会话401/页面account_disabled；重新授权登录恢复，真实当前退出后页面session_revoked。后端最新授权版本及持久状态沿原合同。
- 管理员正常Web/admin、真实accounts/audit API200，SQL审计存在实际login_succeeded，templux无example表。示例数据没有从真实账号或来源项目读取。
- 配置矩阵unset(PROD)/DEV/UAT/PROD/PROD+true/DEV+false及开关空/错误、部署环境空/错误。启用匿名307，关闭404，均不输出样例；非法Web实际exit1与web_start_failed，CLI非零且JSON错误。完整Compose config仅内存解析，证据只公开DEPLOYMENT_ENV、COMPONENT_EXAMPLES_ENABLED与结果，没有其它环境/.env全文。
- 移除副本按git已跟踪/未忽略源码白名单复制，不复制.env、凭据、node_modules或构建产物；先物理删除目录/文案，生产Web重建。自有templux-t10-removal-api使用正式API镜像、真实0008测试库，Web正常代理来源在API明确允许，正常CLI创建随机人员并授admin，页面密码登录。/examples404，/account无链接，真实protected/admin/audit及API均200，审计目标是实际登录账号。
- imports字面检查只显示示例目录内部依赖data/独立文案，t10-dependency-literals.log；实际删除编译与真实功能验证为主要证据，不仅靠grep推断可移除。

## 真实浏览器与项目变体

Ego TaskSpace41，仅本票独立工具服务；普通人员/Agent均通过正常密码表单，凭据在test-results/t10-private三个0600指定文件，不打印。未操作Ego31、真人权限或组织登录。初始测试CLI因缺已有认证可用性投影被拒绝，随后使用auth-config-probe从隔离禁用Feishu配置生成可信非秘密投影，管理校验保持；没有自报布尔绕过。初次使用与APP_PUBLIC_URL不匹配的来源被正常拒绝，浏览器最终使用隔离127.0.0.1:31040并匹配TEST_AUTH_PUBLIC_URL，不放松同源检查。

- 从/account进入/examples，修改首条“仅在内存中的改动”，Tab→Enter真实键盘提交，切紧凑布局。观测只有正常POST /api/auth/activity，无示例业务请求。
- 聚焦重置→Enter恢复首条及标准布局；再次修改后真实刷新恢复名称/输入/标准布局。t10-browser-memory.json。
- 同一正常Cookie访问独立31050变体Web（正式镜像挂载独立presentation）：实际显示默认条数20、集合10/20、通知7秒及2/1，表明读取项目配置而非硬编码默认；未改现用presentation。
- 1680桌面两栏完整、390窄屏单列，scrollWidth=390无整页横溢；t10-examples-desktop.png、t10-examples-narrow.png，已人工查看。
- Agent正常DEV登录进入示例，实际身份kind=agent/负责人独立，审计API403；t10-browser-agent.json。
- 将工具API/Web重新创建为PROD且显式开启示例，Agent旧会话立即按agent_login_denied回登录；普通人员正常登录仍可进入，t10-browser-prod.json。示例开关与Agent策略各自生效；未修改角色来迎合结果。
- TaskSpace41已finish关闭。三个随机密码对25份T10日志/JSON扫描零泄露，t10-secret-scan.json；随后受限交付文件删除。截图不含密码/敏感交付。

## 清理与局限

自有移除API/Web、变体Web、所有10组配置一次性容器、工具password/SSR服务及auth-database已清理；仅原api/database/web仍running，t10-cleanup.log、extra-cleanup.log、final-services.json。源码副本和无秘密证据留在忽略目录便于复核。

原/api/status ready/database connected/schemaVersion0004，原/login200，t10-original-status.json；.env、Ego31、真人授权、通知和历史迁移不动。原部署未套本票新Web或新开关环境，需要后续安排升级重建；不宣称原真人环境已实现该入口。T03真实组织人工验收仍独立未完成。

平台本机macOS/Docker Desktop、Linux容器与Ego Chromium，不代替Linux/WSL2宿主/TLS/真实组织全矩阵。本票不建设全部控件、数据持久化或完整样例业务；默认值展示不是完整分页/通知行为验收。物理删除必须先禁用并重建，运行开关不能自动卸载已打包代码；正式共享控件后续不得反向依赖演示目录。

仅本地提交、不push/关工单，开发验收后由TL安排独立审查。
