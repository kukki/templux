# T03 独立 Standards / Spec 审查

日期：2026-10-15（Asia/Hong_Kong）。范围：`75a56b0d341b56a6faf045e7024a2c9980f5cee1...2ff46d6cbbfaca5140bd33a6be807b9de8f4b169`，37个变更文件，终点与审查时HEAD一致。

审查者独立于实现者。按TL已确认的Team权限，由同一审查者依次执行两个轴，未创建并行子审查。使用code-review、codebase-memory、Context7、Firecrawl、Postgres best practices及verification-before-completion流程。已读取Gitea Swython/Templux #4、父规格#1、认证/CLI/审计规范、相关ADR、开发计划与验收记录；结论基于源码、官方文档及本轮实际执行，未仅采用开发报告。

## Standards

**0项需修复发现；本范围通过。**

- ADR0018：直接使用pg和参数化SQL，不引入ORM；新表有身份唯一约束、外键、状态/版本约束及相关索引。ADR0019：生产Web/API不自行迁移，仍由部署步骤执行；0003新增迁移移除verifier，没有修改已应用0002历史。
- ADR0020/0021/0022：持久会话使用随机凭据的哈希，权限与账号版本在后端检查；多预定义角色取并集。界面显示不能替代后端权限判断。
- ADR0025/0026：完整命令与菜单共用授权服务，明确确认及JSON/诊断分离；CLI依据宿主执行权限，不把host-uid自报值描述为已验证人员身份。未新增浏览器授权角色入口。
- ADR0028：授权状态、角色、版本及关键审计在同一SQL事务；提交异常报告结果未确认并销毁连接。事务锁只覆盖本地SQL，没有持锁调用外部飞书HTTP；符合Postgres锁与短事务指南。
- Fowler基线异味作为判断性启发检查，未发现值得报告的重复逻辑、范围外抽象或接口耦合问题。新的ProjectShell复用既有品牌合同，认证协议、存储、路由、授权与CLI职责可分别定位。类型/工具已检查的事项不再当作人工规范发现。

此结论限于指定差异及其依赖路径，不表示全仓库没有问题。

## Spec

**0项需修复发现；代码与可独立执行的#4验收范围通过。真实组织人工验收仍未完成。**

| 检查范围 | 源码位置 | 审查证据与结论 |
| --- | --- | --- |
| 官方协议、组织来源与密钥分离 | `apps/api/src/feishu.ts:15`、`apps/api/src/auth-config.ts:16` | 固定官方授权/token/user_info端点；v3表单带必需App Secret，无不兼容PKCE参数；tenant来自Bearer用户信息结果并严格匹配部署配置。运行token只用于本次服务端请求。 |
| state浏览器绑定、单次、到期与重放 | `apps/api/src/auth-store.ts:35`、`apps/api/src/auth-routes.ts:32` | 32字节随机state/browser，仅保存哈希；带到期条件的DELETE RETURNING原子消费。缺绑定/重放由35项测试覆盖，过期及两个并发消费者由本轮额外SQL检查覆盖。 |
| Pending、零角色、disabled及权限并集 | `apps/api/src/auth-store.ts:49`、`apps/api/src/auth-store.ts:93` | 初次注册Pending/零角色，不自动管理员；受保护API独立调用requirePermission。账号身份按provider/app/tenant/subject区分，不按姓名/邮箱合并。 |
| 会话持久化与授权版本/身份域 | `apps/api/src/auth-store.ts:73` | Cookie为256位随机值，HttpOnly/SameSite，HTTPS使用Secure；SQL只保存SHA256。每次请求检查最新状态、撤销、授权版本、有效期/闲置及部署组织/App ID；新实例保留有效会话，授权变更后旧Cookie401。 |
| 当前最后管理员及并发保护 | `apps/api/src/authorization.ts:6` | 同一advisory事务锁串行注册和授权，锁目标行；当前身份域中的active/admin才算备用管理员。首次零管理员可建立；两次并发降权只允许一次成功。 |
| 强审计及提交边界 | `apps/api/src/auth-store.ts:9`、`apps/api/src/authorization.ts:27` | 状态/角色/版本及authorization_changed审计同事务。插入故障完整回滚；deferred触发器在COMMIT失败报告未确认，异常连接丢弃。首次注册必要审计失败亦不留下账号/身份/会话。 |
| CLI与前后端访问边界 | `apps/api/src/auth-cli.ts:6`、`apps/api/src/manage.ts:80`、`apps/web/app/components/session.ts:4` | CLI缺确认拒绝，完整参数不进入字段补齐；菜单/interactive仍展示目标并确认。前端请求真实后端session/protected，403转账号页、401引导重登；生产无授予角色的公开API。 |
| 生产/fixture隔离与日志隐私 | `apps/api/src/application.ts:10`、`tests/fixtures/auth-browser-server.mjs:1` | 生产默认fetch与固定端点，模拟只在测试构造器/工具服务注册；一次性生产API镜像实查没有tests目录。错误诊断只输出阶段/状态/安全错误码，禁默认请求日志、敏感header脱敏。独立测试日志未出现fixture code/token/secret标记。 |

账户/权限示例只展示受保护访问，不夹带来源业务数据。密码认证、心跳/全部退出、网页管理与审计查看器按后续票交付，本票没有通过临时入口绕过现有权限边界。

### 独立官方文档核对

本轮先Context7 resolve飞书官方库，查询 `/websites/open_feishu_cn_document`；摘要包含v2旧材料，未直接据此作v3兼容判断。

- [获取授权码](https://open.feishu.cn/document/common-capabilities/sso/api/obtain-oauth-code)：Firecrawl首次只得到导航壳，随后独立从官方同路径 `.md` 成功取得完整中文文档，保存 `test-results/t03-review-authorize-full.md`。字段说明明确当前该授权入口的PKCE暂配v2，后续才支持最新Token端点；scope为可选。最终代码不发送code_challenge/code_verifier，未将导航壳当作证据。
- [获取用户令牌v3](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/authentication-management/access-token/get-user-access-token-v3)：独立Firecrawl抓取完整页，保存 `test-results/t03-review-official-token.md`。确认当前accounts/v3端点、推荐form-urlencoded、自建应用为Confidential Client且必须client_secret；不使用Public Client入口。
- [获取用户信息](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/authen-v1/user_info/get)：独立Firecrawl抓取完整页，保存 `test-results/t03-review-official-user-info.md`。确认Bearer user_access_token、成功code=0、基础用户信息含open_id/name/tenant_key。当前请求不申请邮箱、手机、offline_access或业务消息权限。

此外通过Context7 resolve/query官方Fastify与Next.js文档核对自定义错误处理、日志脱敏、异步cookies、Route Handler Response/Set-Cookie转交。Fastify5.12.7/Next16.4.0没有对应的Context7版本快照，文档来自当前官方分支；本项目实际容器运行提供行为证据。Fastify的disableRequestLogging废弃警告不代表当前失效，未当作本票功能错误。

### 本轮独立实际验证

复用已有镜像，仅启动工具服务 `auth-database`（tmpfs、templux_auth_test），所有SQL写入/故障注入均在该独立库，无部署库回退。

| 命令/检查 | 实际结果 |
| --- | --- |
| `docker compose run --rm --no-deps checks npm test` | 35/35、0失败/0跳过、退出0；日志 `test-results/t03-independent-test.log`。含实际SQL、HTTP、CLI、并发管理员/身份域/强审计/COMMIT故障及T02回归。 |
| `docker compose run --rm --no-deps checks npm run typecheck` | API/Web通过、退出0；日志 `test-results/t03-independent-typecheck.log`。 |
| 额外风险检查脚本 `test-results/t03-review-boundaries.mjs` 挂入checks运行 | 退出0，日志 `test-results/t03-independent-boundaries.log`，结果如下。 |
| state过期和并发消费 | 过期拒绝；两个并发consume只有一个成功，另一个invalid_state。 |
| 首次注册必要审计失败 | 实际SQL触发器失败，注册报错，没有对应账号/身份/会话残留。 |
| 已有正常登录的独立成功审计失败 | 实际SQL触发器只拒绝login_succeeded，已验证会话仍能读取，失败记录回调准确执行一次；不宣称审计保存成功。 |
| 绝对期限/闲置期限 | 在独立SQL中设置已过期expires_at/last_active_at，分别拒绝session_expired/session_idle。 |
| 生产镜像隔离 | 一次性API容器确认tests目录不存在；未启动新的生产API进程。 |
| Shell/补丁 | `sh -n templux tests/presentation-installation.sh`、指定差异 `git diff --check`退出0。 |

已核对开发最终35项/类型检查日志与本轮结果一致。查看已有Pending窄屏及protected桌面截图，Pending只显示本人账号ID/角色及重登退出入口，protected显示隔离测试身份与admin,user；没有重跑截图或操作Ego空间31。CLI菜单的PTY演练与浏览器Pending→授权→旧会话失效→重登→protected流程采用开发记录和源码核对，不冒充本轮重新操作浏览器。

额外检查结束后清理测试身份/触发器及自有auth-database容器；部署API/Web/database继续健康，未改.env、部署配置、实现或真实个人授权。

### 图覆盖与局限

图项目 `Users-jkoo-git-Templux`，generation `2026-10-14T17:42:52Z`。使用图定位、原文及双向追踪核对authorize→事务/审计与CLI，以及consumeOAuth→认证路由；证据文件覆盖与相关实现/SQLscope均检查。0002第3–6、20–21行parse_partial，已直接读取全部迁移并执行真实SQL验收。其余相关文件没有已记录缺口；覆盖为best-effort，不证明图或全仓库完整。

代码/容器闭环和当前官方支持的请求组合可独立验收。**真实本人点击后的实际v3兑换、真实user_info tenant验证及真实Pending尚未证明**；20029解除、20049兼容修复的开发记录不能替代最终真实组织成功。真实人工链路和错误组织人员验证依合同另列步骤，属于验收局限，不作为已发现代码错误，也不自动授予真人管理员。

本轮限macOS/Docker Desktop上的Linux容器；未执行完整Linux/WSL2宿主矩阵、实体移动设备、真实provider超时/全部故障组合、提交已成功但网络响应丢失的实际链路故障注入或全面性能/渗透测试。COMMIT阶段SQL失败已实际验证，连接丢弃及不自动重试逻辑经源码检查。后续心跳、全部退出等范围不在T03结论内。

结论：Standards 0项发现；Spec 0项发现。T03代码与本轮可独立验收部分无审查阻塞项；真实飞书组织人工验收仍待完成，不能报告为已通过。仅本地提交本审查记录，工单处理由TL决定。
