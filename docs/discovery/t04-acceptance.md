# T04 实现与验收记录

日期：2026-10-15（Asia/Hong_Kong）。工程/审查基线 `151e3fcb293a90040d830152cbad4e37091801f7`。Gitea Swython/Templux #5，父规格#1；保留全部先前本地提交，不推送、不关工单。T03 #4仍开放追踪真实飞书个人授权后的独立验收，本票没有修改.env、操作Ego31或授予真人权限。

## 交付

- 新增0004不可变迁移：人员/Agent身份、责任人FK、唯一规范化密码用户名/哈希、会话method、密码来源审计。既有身份/会话升级仍为person/feishu；API结构校验要求password_credentials存在。
- CLI create-person/create-agent/reset-agent与菜单11/12/13；创建active零角色，角色另行明确authorize；Agent责任人必须active人员。scrypt及受限文件安全合同见 `docs/specs/password-authentication.md`，实施决策和计划见 `docs/superpowers/plans/2026-10-15-t04-password-auth.md`。
- 真实POST密码认证与SQL会话；密码不依赖飞书配置、不假定飞书组织身份。Agent环境开关与角色独立，每次访问核对开关/责任人/密码方式、当前版本/撤销/期限；Agent独立默认12小时/闲置10分钟。
- 关键创建/重置/授权管理与审计原子提交；成功登录审计单独故障只记录login_audit_failed，已提交会话可用；整体DB故障不给Cookie。最后有效管理员包括密码人员及允许环境/有效责任人的Agent，禁用唯一Agent管理员责任人也受到保护。
- 正常登录页表单、身份/责任人账号页；受保护业务检查与只读管理员访问证明页。管理员页没有T06账号管理功能，不增加授权HTTP入口。
- 无公众注册或短期换票；隔离页面测试直接运行正式API镜像+真实PostgreSQL，密码流程没有模拟认证。生产镜像不含测试目录或受限凭据目录。

## 验证命令与结果

| 命令或场景 | 结果/证据 |
| --- | --- |
| 修改前正常密码HTTP回归 | 返回404，预期401失败；test-results/t04-red.log。 |
| 初次SQL集成回归 | 新CASE参数被推断text造成503；安全诊断仅错误码42883/运算类型，不包含凭据。补显式integer转换后专项通过；t04-password-integration.log。 |
| `docker compose build checks management api web`及最后Web/checks重建 | 退出0，前后端构建通过；t04-final-build.log、t04-backend-rebuild.log、t04-final-rebuild.log。 |
| `docker compose exec -T database pg_dump -U templux -d templux -Fc` | 迁移前以umask077保存忽略的t04-before-migration.dump，0600；不输出内容。 |
| `docker compose run --rm --no-deps migrate` | schemaVersion0004/applied1；t04-migrate.log。 |
| `docker compose up -d --wait --wait-timeout 90 api web` | 健康；t04-start.log，最终Web重启t04-web-final-start.log。 |
| `./templux test --non-interactive --json` | **50/50通过，0失败/跳过，退出0**；t04-final-test.json/.log。包括T02/T03及本票真实SQL/HTTP/CLI、部署页面回归。 |
| `./templux typecheck --non-interactive --json` | API/Web通过，退出0；t04-final-typecheck.json/.log。 |
| 真实PTY管理菜单11 | 输入用户名/名称/新文件→展示目标和零角色摘要→yes→“完成：create-person”，退出0；仅隔离数据库。没有输入或输出密码。 |
| 生产边界 | 默认 `/api/fixture-authorize`404；API容器内tests/credentials目录均不存在；密码测试没有特殊登录后门。 |
| `git diff --check`、`sh -n templux tests/presentation-installation.sh` | 通过。 |

SQL/API/CLI验收覆盖：正常及错误密码、未知账号、同源检查；规范化用户名唯一性；人员和Agent创建默认零角色；缺必填/确认立即非零；Agent责任人不存在或为Agent拒绝；exclusive文件/符号链接/既有内容不覆盖；umask077与指定UID/GID1001保持0600属主，密码不在普通JSON/stdout/stderr/审计；普通角色与admin显式区分；旧会话失效与跨服务器重启持久会话；DEV/UAT/PROD默认和true/false；关开关/禁用责任人拒绝已有会话；Agent独立最长/闲置期限；Agent重置文件/旧密码/旧会话；管理审计故障回滚和文件删除；deferred COMMIT故障返回未确认并保留私有文件供核对；成功登录审计单独故障仍访问成功，整体数据库不可用503且没有Cookie；拼错安全配置拒绝。

测试入口使用明确TEST_AUTH_DATABASE_URL，独立tmpfs auth-database；没有生产连接回退。多个认证测试文件共享隔离库，因此Node test-concurrency=1避免其迁移/清理互相影响；并发授权测试内部仍并行，未削弱并发验收。

## 正常浏览器验收

使用ego-browser新空间32/33（未操作用户Ego31）。password-web31040→正式API镜像password-api→独立auth-database，受控CLI创建专用人员责任人/Agent，正常 `/login` 输入随机密码。

1. Agent零角色身份登录成功；业务/管理员API均403，账号页显示独立agent/责任人，未出现业务入口。
2. CLI授予user；旧Cookie/account跳 `/login?reason=authorization_changed`；重新密码登录后业务200、管理员403。
3. CLI明确授予admin,user；重新登录 `/admin` 显示“管理员访问已验证”，业务/管理员API均200。
4. 1440×1000及390×844无页面横溢出，人工查看窄屏管理员/登录拒绝截图；截图t04-agent-zero-roles.png、t04-agent-user-desktop.png、t04-agent-admin-desktop.png、t04-agent-admin-narrow.png。
5. 隔离API重启为PROD无覆盖开关，已发会话业务401，真实密码表单保留/login并显示Agent环境/责任人拒绝。显式true重启后同一明确授权Agent可正常登录/admin，API200。拒绝截图t04-agent-prod-denied.png（密码输入先清空）。
6. 首次快速页面自动操作暴露客户端尚未就绪时原生表单提交风险；补显式method=post/action与就绪前禁用按钮，客户端待提交禁重复。部署SSR页面回归断言POST/action，不把密码放URL，最终正常拒绝及允许流程复验成功。未记录包含凭据的URL/页面输入。

关闭本轮Ego32/33并清理password-web/password-api/auth-database；测试密码受限文件目录已删除，tmpfs测试账户消失。部署API/Web/database保留健康。忽略日志/截图/0600迁移备份保留，凭据未纳入Git/Docker上下文。普通结果JSON仅账号/文件名等元数据。

## 官方文档、结构与局限

通过Context7先resolve再query Node v24 scrypt/timingSafeEqual及fs exclusive/fchmod/fchown/fsync；React官方文档核对客户端useEffect与阻止原生提交。链接见密码认证合同。

codebase-memory索引/结构调用链/覆盖核对已执行。0004第10–11行password_hash长度及enabled约束为parse_partial，直接读取并用真实迁移/SQL核验；图为best-effort，无缺口信号不代表全仓证明。

平台：macOS/Docker Desktop、Linux容器、Ego Chromium；未执行完整Linux/WSL宿主矩阵、实体移动设备、外部HTTPS代理或负载测试。T07持久化失败限制、T08验证关联及人员重置、T05心跳/全部退出仍属后续工单，已在合同列明，不声称本票完成它们。文件与数据库跨存储不能物理原子提交，崩溃/未确认提交须核对私有文件和SQL结果，不能自动覆盖或重试。真实飞书组织验收保持另列未完成状态。
