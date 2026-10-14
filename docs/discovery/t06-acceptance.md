# T06 账号与预定义角色管理验收

日期2026-10-15；工单Swython/Templux #7，父规格#1；审查基线 `af15b9cdd4890cf18f7ab65066f2817ef91342c4`。所有已有16个本地提交保留；本票未推送或关闭工单。

## 实现

- `/admin` 从只读权限证明接入账号查询/筛选/分页、Pending审批、预定义多角色及启停；人员、Agent和责任人清楚展示。沿用品牌变量和集中认证文案、呈现配置分页选项；默认零权限清楚提示。
- 新GET/POST管理API严格字段、有界输入、精确同源、明确确认和目标版本冲突保护。账号ID包含Postgres bigint上界校验。没有浏览器自报actor、部署可用性开关、公众注册或认证测试后门。
- 网页/CLI共用setAuthorization、有效管理员计算及授权独占锁；网页取得锁后重验操作者，状态/角色/版本/审计在同事务提交。新项目预定义角色excludes互斥由同一校验实施。
- 成功仅在COMMIT确认后报告；自身授权变化立即统一重登，原因保留。审计明确回滚显示失败；网络/数据库/提交不确定不自动重试、不显示成功。没有新增迁移或修改历史数据库对象。

## 容器命令与日志

以下均在仓库根目录、macOS Docker/Compose、Node24.21.0/Next16.4.0/Postgres18.6执行。隔离库始终为auth-database/templux_auth_test，不使用部署数据库作测试fallback。

```sh
docker compose --profile tools up -d --wait auth-database
docker compose build checks api web
docker compose --profile tools up -d ssr-body-api ssr-body-web
docker compose run --rm --no-deps checks node --test tests/account-management.test.mjs
docker compose run --rm --no-deps checks npm test
docker compose run --rm --no-deps checks npm run typecheck
```

- 新测试写入后先在旧checks镜像挂载执行：新增管理路由404、锁等待断言失败，记录test-results/t06-red.log。实现后首轮8/8、扩展10/10通过，记录t06-api-first.log/t06-api-expanded.log。
- 最终完整suite为90/90；含T06组13个计数（12项子验收+父组），真实SQL/HTTP/CLI贯通：匿名/普通/零角色拒绝、查询安全DTO及字面搜索、有界分页/ID/严格参数/同源/confirm、版本冲突、权限并集及零权限、启停、审计失败回滚、操作者等待锁后失效、互斥配置Web/CLI/非法配置、正常外部OAuth模拟Pending审批后重新登录、Web/CLI并发降权与停用最后管理员、零管理员CLI初始化。完整日志test-results/t06-suite.log；最终构建t06-final-build.log，类型检查t06-typecheck.log，均退出0。
- 其余T02配置/TTY/umask、T03飞书协议及组织限制、T04密码/Agent/最后有效管理员投影、T05撤销/闲置/SQL锁/SSR body故障回归均包含在上述suite。
- 首轮完整suite的唯一子失败是SSR正常页面断言误把RSC脚本中传给客户端的文案当作可见错误。现只从脚本外实际HTML验证不出现网络错误；原截断body、坏JSON、解码、超时、401/403及Cookie/原路由重试断言保持。

## 真实浏览器

使用ego-browser技能新建本票TaskSpace36，只操作自己拥有的页面，结束后finish关闭；未操作Ego31。所有密码通过CLI生成至本票0700目录、0600文件，读取只用于真实密码表单，不输出明文。可复用tests/fixtures/account-management-browser-setup.mjs，它只在checks内对显式隔离库调用CLI，无HTTP认证或生产入口。

```sh
# 使用当前宿主UID/GID；凭据目录必须为本次新建空目录，不静默覆盖。
mkdir -p test-results/t06-credentials
chmod 700 test-results/t06-credentials
docker compose run --rm --no-deps \
  -v "$PWD/test-results/t06-credentials:/opt/templux/credentials" \
  -e TEMPLUX_CREDENTIAL_DIR=/opt/templux/credentials \
  -e TEMPLUX_HOST_UID="$(id -u)" -e TEMPLUX_HOST_GID="$(id -g)" \
  -e DEPLOYMENT_ENV=DEV checks node tests/fixtures/account-management-browser-setup.mjs
TEST_AUTH_PUBLIC_URL=http://127.0.0.1:31040 TEST_HEARTBEAT_INTERVAL_SECONDS=2 \
  docker compose --profile tools up -d password-api password-web
# 独立外部飞书协议模拟（checks镜像）；本地SQL、会话和权限均为正常实现。
docker compose --profile tools up -d auth-browser auth-web
```

浏览器访问127.0.0.1测试端口，避免与用户localhost Cookie混用；不同时在共享Cookie标签页使用不同身份。最终证据test-results/t06-browser-evidence.json：

| 行为 | 结果 |
| --- | --- |
| 正常人员管理员搜索Agent并保存user角色 | 显示提交成功及重新登录提示，列表显示责任人/普通角色 |
| 网页已编辑后CLI修改相同账号 | 显示版本冲突，不显示成功；刷新后重新确认 |
| 管理授权审计触发器故障 | 明确“变更未提交”、无成功提示、保留编辑；真实SQL回归同时证明状态/角色/版本不变 |
| 普通人员和user Agent访问/admin/直接API | 管理页回账号页、没有管理链接；直接API403 |
| Agent零角色 | 页面提示无有效角色；受保护和管理API403 |
| Agent明确admin+user | 管理页及直接API200；权限由正常角色链路授予 |
| Agent在网页降权自身 | 立即login?reason=authorization_changed，持续原因，管理内容移除 |
| Agent网页停用再启用 | 列表先显示停用再启用，均真实提交 |
| 外部飞书协议模拟下Pending | 页面Pending、业务/管理403；密码管理员网页审批后，再走正常OAuth模拟重新登录可访问受保护页 |
| 390px窄屏 | 无全局横向溢出，编辑区焦点定位目标，未确认保存禁用 |

1440×1000管理页保存结果截图t06-admin-desktop.png；390×844编辑确认截图t06-admin-narrow.png，人工已检查。截图不作像素差门禁。浏览器脚本遇到服务重建瞬时空响应及loading期间DOM移除的等待断言问题，均属验收调度，使用原本票页面恢复，不增加应用测试入口；不以这些失败宣称额外分页浏览器验收通过。列表分页接口由真实API回归验证。

## 结构与限制

codebase-memory按要求索引、search/trace/snippet探索共享授权链路并检查依赖文件覆盖；信号为best-effort。0002/0004 SQL解析缺口直接读取；非代码规范/配置也直接读取。Context7核对React过期响应清理、Fastify默认字段处理；加载Postgres技能后作者编写SQL查询及隔离审计故障对象。

没有操作.env、真人账号权限、Ego31或通知。T03真人飞书个人授权/组织验收仍开放另列；这里只模拟远端协议并贯通真实本地链路。Linux/WSL2、其它主题完整矩阵尚未本票重跑；没有重复无关隔离安装/全套截图。正常部署API/Web/database保持原运行，本票只重建镜像及运行隔离工具服务，不将本票变更上线到真人测试服务。

已清理本次tools容器及本票受限明文凭据目录；test-results/t06-cleanup.log、t06-final-services.json记录结果。原API/Web/database仍运行且健康。生产API镜像实查tests目录不存在、管理模块存在，日志t06-production-boundary.log；本票14项日志/JSON文本检索未发现本次随机凭据明文。仅保留忽略的非敏感测试日志/截图及结构化证据。独立审查由TL安排。
