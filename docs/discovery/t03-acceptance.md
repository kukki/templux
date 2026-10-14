# T03 实现与验收记录

日期：2026-10-15（Asia/Hong_Kong）。审查基线：`75a56b0d341b56a6faf045e7024a2c9980f5cee1`。保留T01/T02全部6个本地提交。本票为Gitea Swython/Templux #4；工单由TL在独立审查后处理。

## 实现与合同

- TypeScript后端新增配置/飞书协议/账号会话存储/授权事务/HTTP路由/CLI模块；前端同源API转交及登录、Pending、受保护页面沿用项目品牌、设计变量、区域配置。
- 0002建立带唯一/FK/状态约束和必要索引的账号、飞书身份、角色、会话、OAuth请求、审计表；0003以新增迁移移除不再使用的verifier，已应用0002内容/校验历史未改。启动检查认证表存在。
- OAuth仅使用固定官方端点，App Secret必需，单次state+浏览器绑定+10分钟期限；运行token只用于验证基本身份，不存入本地会话或审计。
- 未授权人员为Pending/零角色，无受保护访问；多角色取并集，预定义角色可扩展。CLI users/authorize与菜单9/10通过同一授权服务，明确确认、最后active/admin保护、串行并发校验、授权版本提升、变更与审计原子提交。
- 256位随机HttpOnly/SameSite Cookie对应SQL哈希会话；每次访问检查有效期、闲置、撤销、账号状态、授权版本及当前组织/App ID绑定。正常重启持久会话有效；配置改成另一组织/应用时旧绑定会话拒绝。
- 生产API没有fixture授权路由，镜像没有tests目录；模拟仅在checks/tests构造的HTTP传输与工具服务，真实SQL/权限/会话/审计不被替换。
- 使用与官方协议详见 `docs/specs/feishu-authentication.md`。密码登录、网页账号管理、心跳/完整闲置交互、审计查看器等仍属后续票。

## 官方协议核对与真实尝试

Context7先resolve飞书官方库与Fastify，再按概念query；Next.js的async cookies/Route Handler/请求期读取同样核对。飞书协议关键限定另外通过官方完整Markdown读取，没有仅凭摘要选择端点。

- [授权码](https://open.feishu.cn/document/common-capabilities/sso/api/obtain-oauth-code)：当前固定GET accounts.feishu.cn/open-apis/authen/v1/authorize，基本API权限无。code_challenge说明短摘录：“在该接口使用 PKCE 时，可以暂时搭配…v2版本…后续将尽快支持最新的Token端点。”
- [用户token v3](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/authentication-management/access-token/get-user-access-token-v3)：POST accounts.feishu.cn/oauth/v3/token；推荐application/x-www-form-urlencoded，也兼容JSON；自建应用为Confidential Client，client_secret必需，PKCE为可选字段。成功顶层code=0/access_token等字段。
- [用户基本信息](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/authen-v1/user_info/get)：Bearer user_access_token，基础API权限无；name/open_id/tenant_key不要求邮箱手机号等额外权限。实现未申请offline_access或业务/消息scope。
- [v2历史token说明](https://open.feishu.cn/document/authentication-management/access-token/get-user-access-token)：提示迁移v3。该页摘要的PKCE迁移说明未包含授权入口的实际兼容限定；真实运行与完整授权码文档决定最终采用Confidential Client的支持组合。

真实过程如实记录：

1. 初始只检查键名，未发现凭据。随后用户提供配置，TL按用户要求把APP_TOKEN键原值改名为APP_SECRET。开发未修改.env，仅核对名称并在一次性API容器检查必需项是否非空，结果missingOrEmpty=[]；不输出值。支持用户FEISHU_TENANT_KEY，规范别名非空冲突拒绝。NOTIFY_CHAT_ID未用于发送任何消息。
2. 从真实本地 `/login` 进入飞书，起初出现20029“重定向URL有误”。实际回调固定 `http://localhost:31000/api/auth/feishu/callback`；用户登记该地址后等待生效，重新从本地入口发起新请求，成功到真实授权页，20029解除。
3. 初始PKCE/v3组合在实际点击授权后，token阶段HTTP400/providerCode20049。仅记录阶段/状态/数字码，未保存code/state/token/secret。完整官方文档定位兼容限定，补新回归观察失败，改为v3 Confidential Client+必需App Secret+单次浏览器绑定state，采用标准表单请求，不发送不受支持PKCE字段；0003滚动迁移成功。
4. 修复后真实页面重新从本地入口发起，正常到飞书个人授权页，pkceRequested=false。按TL要求把Ego空间31交给用户完成本人授权。**本记录时最终实际token兑换/租户身份验证/真实Pending尚待本人点击后的检查，不能以enabled=true或非空检查替代已验证凭据链路。** 原20029已解除，原20049是已定位修复的实现兼容问题，最终真实兑换结果仍待确认。

官方Markdown核对副本位于忽略的test-results/t03-official-authorize.md、t03-official-token-v3.md、t03-official-user-info.md、t03-official-token-v2.md。没有保存授权URL查询、个人授权码或令牌。

## 已执行容器验证

| 命令/场景 | 结果 |
| --- | --- |
| 修改前公共认证入口回归 | 旧API `/api/auth/config` 404，对预期200测试失败，证明初始缺失功能。 |
| `docker compose exec -T database pg_dump -U templux -d templux -Fc` | 在迁移前保存 `test-results/t03-before-migration.dump`，文件0600/目录0700，仅本地忽略产物；未输出内容。 |
| `./templux start --non-interactive --json` | 前后端独立构建，真实数据库0002 applied1，API/Web健康，JSON ok。 |
| `docker compose run --rm --no-deps migrate`（0003） | schemaVersion0003、applied1，随后API健康。保留既有迁移校验。 |
| `./templux test --non-interactive --json`（最终） | 最终35/35通过、0失败/0跳过、退出0；覆盖部署真实API/Web、CLI/T02回归及独立auth-database真SQL。 |
| `./templux typecheck --non-interactive --json` | API/Web通过，退出0。 |
| 实际PTY管理菜单 | 对独立auth-database选择10，目标1、角色user、状态留空active，先展示目标/角色/状态及旧会话失效摘要，输入yes；“完成：authorize”，退出0。没有授权真实个人账号。 |
| 生产隔离边界 | 默认API `/api/fixture-authorize` 返回404；一次性生产API容器确认tests目录不存在。 |
| Shell/补丁 | `sh -n templux tests/presentation-installation.sh` 与 `git diff --check`通过。 |

关键行为覆盖：有效组织正常登录；state缺浏览器绑定、重放/篡改拒绝；错误/缺失tenant不创建账号/会话；首次Pending拒绝；CLI缺confirm拒绝、明确授权后旧会话401、重新认证后受保护200；admin/user/自定义auditor权限并集；零角色与disabled拒绝；持久哈希会话在新服务器实例继续可用；最后管理员拒绝与并发两个降权只有一个提交；审计触发器故障造成角色/状态/版本完整回滚，旧会话仍有效；退出同源Origin限制与持久撤销；缺配置503关闭访问；TENANT_KEY别名及冲突；协议失败只携带安全诊断元数据；实际deferred审计触发器在COMMIT阶段失败时报告结果未确认、数据仍原子回滚，并销毁异常连接；部署组织/App ID变更时旧会话拒绝，旧组织管理员不能作为当前最后管理员保护的备用计数。

协议请求断言校验真实固定v3 URL、标准Content-Type、client_id/client_secret/grant_type/redirect_uri，确认不发送PKCE不兼容字段。tenant信息来自用户信息API而非浏览器传入的组织参数。独立测试数据库名templux_auth_test、服务auth-database、tmpfs，不回退到部署连接。

最终日志：t03-final-test.json/.log、t03-final-typecheck.json/.log；构建t03-final-build.log；启动t03-start.json/.log；迁移t03-migrate-0003.log。先前协议/realm回归红记录为 t03-protocol-form-red.log、t03-protocol-compatibility-red.log、t03-realm-red.log（realm旧实现200而预期401，修复后测试覆盖）、t03-commit-red.log（提交边界故障的结果说明回归）、t03-realm-admin-red.log（有效管理员按当前身份域计数）。这些日志均在忽略的test-results/。

## 隔离浏览器验收

agent-browser独立命名会话 `templux-t03-auth`，Web31030/仅测试外部协议模拟页；相同本地授权、SQL会话与权限代码。

- 浏览器登录→测试授权页→正常OAuth回调→Pending，不能显示受保护入口。
- 真实CLI对该测试账号授权admin,user→原Cookie访问/account被后端401，前端/login?reason=authorization_changed持续显示要求重登。
- 再次正常模拟外部授权→账号active→访问/protected显示“受保护访问已验证”，角色admin,user。
- 1440×1000和390×844检查，无页面横向溢出；截图 `t03-pending-desktop.png`、`t03-pending-narrow.png`、`t03-protected-desktop.png`、`t03-protected-narrow.png`。
- 模拟浏览器空间已关闭，auth-web/auth-browser/auth-database工具容器清理；部署API/Web/database继续健康。真实Ego空间31因等待本人授权保留用户控制，没有关闭用户待操作页面。

## 范围和局限

本次平台为macOS/Docker Desktop、Linux容器、Chromium。未执行完整Linux/WSL宿主矩阵、真实错误组织的另一位人员登录或实体移动设备。完整真实飞书链路待用户个人授权后继续，模拟通过不会被写成真实组织通过。没有自动授予本人管理员，没有发送飞书通知。

schema图在0002的3–6、20–21行记录parse_partial；已直接读取这些状态/长度/版本约束，并执行真实迁移及SQL测试核验。其它相关文件覆盖无已记录缺口，信号best-effort，不声称证明全仓完整。
