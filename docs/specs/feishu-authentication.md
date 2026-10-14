# 飞书登录与初始授权（T03）

## 当前官方合同

核对日期：2026-10-15，来源为飞书官方完整文档，Context7用于定位，官方Markdown用于核对完整限定。

| 步骤 | 固定生产端点/合同 | 官方来源 |
| --- | --- | --- |
| 取得授权码 | GET `https://accounts.feishu.cn/open-apis/authen/v1/authorize`；client_id、response_type=code、redirect_uri、一次性state | [获取授权码](https://open.feishu.cn/document/common-capabilities/sso/api/obtain-oauth-code) |
| 兑换用户令牌 | POST `https://accounts.feishu.cn/oauth/v3/token`；application/x-www-form-urlencoded，grant_type=authorization_code、client_id、必需client_secret、code、完全相同redirect_uri | [获取用户令牌v3](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/authentication-management/access-token/get-user-access-token-v3) |
| 验证人员/组织 | GET `https://open.feishu.cn/open-apis/authen/v1/user_info`；Bearer user_access_token，成功code=0，严格检查open_id/name/tenant_key，tenant_key须等于部署允许组织 | [获取用户信息](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/authen-v1/user_info/get) |

当前授权码文档的code_challenge限定：“在该接口使用 PKCE 时，可以暂时搭配…v2版本…后续将尽快支持最新的Token端点。”实际v1授权+PKCE/v3兑换曾返回400/20049；T03因此采用官方支持的 **Confidential Client** 流程，App Secret必需，state单次、绑定浏览器且有10分钟期限，v3不发送不兼容的PKCE字段。不存在不带App Secret的Public Client入口。已应用0002迁移保持原校验记录；0003迁移移除不再使用的verifier列。

v3令牌与基本用户信息接口的API权限要求均为“无”；open_id、name、tenant_key为基础返回字段。本票不申请邮箱、手机号、受雇信息、offline_access、消息或其它业务scope，不存refresh_token。应用须已安装/启用/发布且人员在应用可用范围；首次用户授权、企业应用可用范围及回调登记仍由应用管理员控制。错误20029是回调登记问题，20010为人员不可用，20049为PKCE校验问题；运行诊断只保留请求阶段、HTTP状态和安全错误码。

## 配置

`.env`：

- `FEISHU_APP_ID`：应用ID。
- `FEISHU_APP_SECRET`：长期App Secret。用户原APP_TOKEN键已由TL按用户要求改名；本实现不提供APP_TOKEN兼容别名。
- `FEISHU_TENANT_KEY`：用户已有的允许组织配置来源。也接受规范名`FEISHU_ALLOWED_TENANT_KEY`；两个非空值须一致，冲突拒绝启动且不回显值。
- `APP_PUBLIC_URL`：浏览器公开同源地址，默认`http://localhost:31000`。生产使用HTTPS；HTTP仅允许loopback本地开发。
- `FEISHU_REDIRECT_URI`：缺省由公开地址生成`/api/auth/feishu/callback`。须同源、无查询/片段、路径精确。当前本机需在开发者后台安全设置登记 **http://localhost:31000/api/auth/feishu/callback**。
- `PERSON_SESSION_MAX_SECONDS`：默认43200（12小时）；`PERSON_IDLE_TIMEOUT_SECONDS`默认600（10分钟），允许60–604800整数。

三个必需凭据不完整时公开认证可用性为false，登录入口明确不可用，认证/受保护API返回503。长期凭据只传给API容器；运行user_access_token仅用于本次服务端用户信息请求，不写配置、Cookie、会话表或审计。NOTIFY_CHAT_ID未用于本票，不发送飞书通知。

## 持久化和访问边界

0002建立accounts、identities、account_roles、auth_sessions、oauth_requests、audit_events及必要唯一/FK/有效期索引；0003按已部署历史前进。相同(provider,app_id,tenant_key,open_id)只对应一个账号，不按姓名/邮箱合并。首次经组织校验的登录创建Pending、零角色；账号创建与必要注册审计同事务。已有账号成功登录的独立成功审计故障允许建立已验证会话，同时记录login_audit_failed，不声称审计成功。整体数据库故障不绕过认证。

浏览器Cookie是32字节随机会话值，HttpOnly/SameSite=Lax；HTTPS为Secure，无Domain，Path=/。数据库只存SHA256哈希及账号、授权版本、有效期、活动时刻、撤销原因。正常服务重启保留有效会话。每次受保护请求查最新数据库状态/版本和当前允许组织/App ID绑定；变更部署认证组织或应用后，原绑定会话拒绝访问；Pending、disabled、零有效角色及缺少所需权限均被拒绝。改角色/状态提升版本，旧会话必须重新登录。当前会话退出检查同源Origin并持久撤销。T05继续交付心跳、全部退出、完整闲置交互及失效提示协调，本票没有自动后台活动延长闲置。

`config/roles.json`是受版本管理的预定义角色配置，运行时加载、重启生效。默认admin（application:read、accounts:manage、audit:read）、user（application:read），额外角色可增加合法permission字符串；权限取并集。保留admin/user和admin必要权限，没有网页角色编辑器。`config/auth-copy.json`集中管理简中认证文案，替换已有值后重启Web生效；不改T02呈现版本1合同，不引入个人语言主题切换。

授权变更共享`setAuthorization`：事务取得授权advisory lock，检查目标并锁行，阻止当前组织/App ID中最后一个active/admin被停用或降权（旧组织身份不计作当前有效管理员），再更新状态/角色/授权版本并写CLI来源审计，全部提交或全部回滚。COMMIT响应异常时明确报告“提交结果未确认”，须核对账号/审计且不自动重试；回滚失败或提交异常的连接销毁，不回池复用。首次零管理员可建立第一位；不会自动提升首位登录者。宿主操作者依赖宿主Docker执行授权，actor记录host-uid但不将自报值视为已验证人员身份；浏览器没有授予角色的公开API。

## 宿主管理入口

```sh
./templux users --non-interactive --json
./templux authorize --account 1 --roles admin --confirm --non-interactive --json
./templux authorize --account 2 --roles user,auditor --state active --confirm --non-interactive --json
./templux authorize --account 2 --roles none --state disabled --confirm --non-interactive --json
```

roles可为逗号分隔的预定义键或none；state默认active，也可disabled；未知角色/重复角色/非法ID/缺参数/缺确认立即退出1，JSON与诊断分离。无参数菜单9只读查看账号，10补齐授权并展示目标、角色、状态及旧会话失效摘要，输入yes确认。`authorize --interactive`同样补齐；完整命令在TTY也直接执行，不等待可选字段。账号查询首版返回最前100条；Pending页面同时展示本人的账号ID，可直接作为目标。浏览器登录身份不会获得宿主CLI权限。

## 容器与浏览器验收

```sh
./templux start --non-interactive --json
./templux test --non-interactive --json
./templux typecheck --non-interactive --json
```

test在独立`auth-database`的tmpfs中运行真实SQL认证测试，永不回退到部署数据库；同时检查部署API/Web。测试用`createApplication`构造注入外部HTTP响应，生产固定使用fetch和官方URL，API镜像不含tests目录。可移除的auth-browser/auth-web工具服务仅用于模拟外部授权页的浏览器验收，默认31030，包含明确测试标记；这个测试路由不在生产镜像/进程中注册。用完清理：

```sh
docker compose rm -s -f auth-web auth-browser auth-database
```

实际组织验收必须另外：登记精确回调并等待配置生效；从本地登录页发起新请求，由本人完成飞书个人登录/授权；确认真实用户信息和部署组织验证后进入Pending；宿主操作者明确核对账号ID后用上述CLI授予角色，重新正常飞书登录才可访问受保护页面；再检验拒绝错误组织、最后管理员保护和审计记录。常规模拟协议测试证明本地逻辑，不能替代该实际凭据链路。
