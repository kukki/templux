# T06 独立审查：管理员网页账号与角色管理

审查日期：2026-10-15；审查者：审查。范围：`af15b9cdd4890cf18f7ab65066f2817ef91342c4..387b38de689b5ab9d926c248e38bc51d96a623d3`。开始时 HEAD 为后者、工作目录干净。依 Team 权限由同一独立审查者依次完成 Standards 与 Spec，不另派成员。

## 结论

| 轴 | 结论 | 阻塞发现 |
| --- | --- | --- |
| Standards | 通过；本次范围内未发现需修复的问题 | 0 |
| Spec | T06 可按 #7 验收；有下述明确验证边界 | 0 |

本结论覆盖本票网页查询、审批、预定义角色授权及启停，不代表完整首版全部交付。T03 的真实飞书组织人工验收仍未完成，不能以本票协议模拟或密码认证替代。

## Standards 审查

读取 #7、父规格 #1、仓库规范、ADR0009/0022/0028、账号管理合同、实施计划、验收记录以及全部15个变更文件，并复核现有认证、CLI、事务及前端会话路径。

- 新 API 遵循独立前后端、运行时严格校验和参数化 SQL。POST 精确 Origin、confirm、字段白名单及16KiB上限，浏览器不能指定操作者或认证投影（`apps/api/src/account-management.ts:37`）。ID 在转 SQL 前检查 PostgreSQL bigint 上界，ID/授权版本保留字符串，不以 JavaScript Number 表示（`authorization.ts:18`）。查询页码/数量有界，搜索转义通配字符（`account-management.ts:13`）。
- 网页与宿主 CLI 复用 `setAuthorization`；graph inbound 明确两条调用者为 registerAccountManagement 与 authorizationCommand。独占授权锁后同一客户端重读操作者会话和权限，再锁定目标行检查版本（`authorization.ts:24`）。没有前端判断代替后端鉴权。
- 角色、状态、版本、关键审计在同一事务；返回成功必须在 COMMIT 确认后。提交故障保留未知结果语义、丢弃连接并发送脱敏错误，不重试写操作（`auth-store.ts:9`、`auth-routes.ts:21`、`account-manager.tsx:24`）。审计 source/actor/目标前后值来自已验证身份与 SQL，不信任请求声明。
- 通用文案集中在 auth-copy.json；项目互斥仅扩展预定义角色配置，不引入后台角色编辑器。前端 effect 在 body 读取后检查过期响应，并清理 timeout/abort（`account-manager.tsx:13`）。Context7 核对 React useEffect 清理与 Fastify 校验/bodyLimit，手工字段校验不依赖默认 AJV removeAdditional。
- 浏览器准备 fixture 显式限制独立测试库并使用现有 CLI；发行 API 镜像不含 tests。未新增迁移、业务范围模型、测试登录入口或秘密输出。

结构探索先用 codebase-memory search_graph、trace_path、get_code_snippet，再读取源文件。覆盖检查包含全部15个变更路径及依赖的 auth-store/auth-cli/database/session-client/session/Compose/Dockerfile/ADR；均为 no_recorded_issue、metadata_match，无报告缺口。此为 best-effort 索引信号，结论仍以实际源码和行为验证为依据。Postgres 技能用于核对短事务、同客户端和共享/独占 advisory lock。

## Spec 审查

- 安全 DTO 区分人员/Agent及责任人名称/ID，仅返回管理所需字段；不返回密码哈希、用户名、会话或部署秘密。查询/筛选/分页边界、字面包含语义与合法页数夹紧符合本票合同（`account-management.ts:24`）。
- 匿名、Pending、disabled、零角色和 user 均不能直接管理；明确授权 admin 的人员和 Agent 走相同持久会话检查。等待授权锁期间操作者降权/停用或版本变化会在锁内重验，不能沿用旧权限（`authorization.ts:25`）。
- 目标 expectedVersion 防旧页面覆盖；Web/CLI 共用最后有效管理员保护，当前认证可用域、Agent开关与责任人有效性继续参与计数。首次零管理员 bootstrap 可用（`authorization.ts:30`、`:34`）。测试涵盖 Web/CLI 并发降权及停用，不会提交零有效管理员结果。
- 默认多角色权限并集；任何方向的 excludes 均拒绝冲突，非法配置拒绝，Web/CLI 共用验证（`authorization.ts:11`）。Pending 审批后旧版本会话无权继续，重新正常认证后获得访问；外部 OAuth 响应为测试模拟，账号/角色/会话与审计使用真实 SQL。
- 编辑显示目标、状态、角色和确认摘要；更改后重新确认，保存期间防重复提交/误关闭。自改成功立即使用 T05 持续失效原因导航；401 按统一会话处理，普通403/网络失败不误退出；失败保留编辑，不伪报成功（`account-manager.tsx:22`）。
- 沿用既有 CLI 完整参数、显式确认及 JSON/诊断边界；本票不提前实现 T07 登录关联、T08 限流、T09 审计查询及后续通用控件。

## 独立执行证据

复用已构建镜像，启动独立 auth-database 与 SSR 协议工具；未重建 Web，也未重复浏览器全链路。命令结果均实际读取后确认。

| 验证 | 结果/证据 |
| --- | --- |
| `docker compose run --rm --no-deps checks npm test` | 90/90，fail/cancelled/skipped 均0；`test-results/t06-independent-suite.log`。T06 为父测试+12子验收，共13计数。包含直接权限、审计失败、锁等待重验、互斥、Pending审批、Web/CLI最后管理员竞争及bootstrap。 |
| `docker compose run --rm --no-deps checks npm run typecheck` | API/Web 均退出0；`test-results/t06-independent-typecheck.log`。 |
| checks 容器执行独立补核 `test-results/t06-review-boundaries.mjs` | 真实 HTTP、正常密码登录与独立 PostgreSQL；退出0，`test-results/t06-independent-boundaries.log`。 |

额外补核在执行前断言 TEST_AUTH_DATABASE_URL 指向 `/templux_auth_test`，仅创建本次独立账号与故障函数/触发器，并在 finally 清除：

1. Pending 会话直接 GET/POST 管理均403；已发行的会话对应账号停用后均401。失败前后目标状态、角色、版本与授权审计完全不变。
2. 同一个 expectedVersion 同时发起两次网页授权：恰好一次200、一次409；只提升一次版本、只提交一条授权审计。
3. 延迟约束触发器在 COMMIT 时抛错：HTTP503 `service_unavailable`，无 Set-Cookie；查询确认目标状态/角色/版本/审计完全不变，操作者仍可管理。日志只含脱敏 authentication_request_failed。此用例验证实际 SQL COMMIT 失败，不把它误称为网络断连后的提交结果证明。

开发浏览器证据另行读取 `t06-browser-evidence.json`，包括保存、旧版本冲突、审计失败保留编辑、普通人员/Agent403、零角色拒绝、显式admin、Pending审批/重登与自改持续原因登录页；本次查看 narrow 截图确认目标/角色/确认布局，390px无横向溢出由开发浏览器记录提供。本次未另行操作浏览器，未把这些记录写成审查者重跑结果。生产镜像 `t06-production-boundary.log` 记录 tests 不存在，管理模块存在；源码 fixture 隔离与构建入口同时核对。

已清理本次启动的 auth-database/ssr-body-api/ssr-body-web 容器；未修改实现、部署、.env或真实个人授权。

## 局限

- 真实飞书 token 兑换、组织 tenant/Pending 人工链路仍等待 T03 单独验收；未操作 Ego31。
- 没有注入 COMMIT 回复丢失的真实网络故障；该未知结果分支通过源码审查和实际 COMMIT 错误响应检查。没有新增浏览器超时/跨标签故障演练，采用既有 T05 证据、本票开发记录与源代码核对。
- 本次不是容量/超大账号规模、完整无障碍或 Linux/WSL2/移动设备矩阵验收；不会据90项通过推断这些行为全部成立。

参考文档：[React useEffect](https://react.dev/reference/react/useEffect)、[Fastify validation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)。
