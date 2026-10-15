# T05 持久会话、活动与失效合同

依据Gitea #6/#1、ADR0020/0021/0023；日期2026-10-15。以下接口、边界及参数校验为本票实施选择。

## 后端与并发边界

会话继续存PostgreSQL：随机256位HttpOnly Cookie只在SQL保存哈希，认证方式、账号状态、角色、版本、闲置和最长期限每次检查。默认人员/Agent12小时、闲置10分钟；PERSON_SESSION_MAX_SECONDS/PERSON_IDLE_TIMEOUT_SECONDS与Agent对应项独立，沿用60–604800秒边界。普通重启不会更换会话密钥或恢复已撤销记录。

`readSession`在同一短事务/客户端获取授权共享事务锁，读取版本、状态、撤销、角色及活动；账号授权、Agent重置、登录、退出和项目范围失效使用同一授权独占事务锁。多个只读请求可并行，管理变更不插入版本与角色读取之间。等待变更提交后才开始的权限检查读到已提交新状态；已开始并通过权限检查的请求不保证撤销执行效果。最长/闲置比较使用当前时钟，不使用锁等待前的事务起始时间；活动时间单调推进。

- GET `/api/auth/heartbeat`：只核验真实会话，绝不更新last_active_at。
- GET `/api/auth/session`：同样不续闲置，供账号信息/服务端渲染。
- POST `/api/auth/activity`：精确同源Origin、有效会话后更新活动；不能复活过期/撤销/失效会话。
- 交互型业务/管理员API当前选择touch=true；未来后台业务轮询必须选择touch=false，不把所有请求都当作活动。浏览器预取和心跳不得调用activity。
- POST `/api/auth/logout`：同源，持久撤销当前Cookie对应会话并清除Cookie；其它设备会话不变，已撤销/无Cookie当前退出幂等。
- POST `/api/auth/logout-all`：同源且当前会话有效，在同一独占事务中撤销该账号全部现存未撤销会话（包含当前），清除当前Cookie；不列设备、不影响另一个账号。之后明确重新登录可创建新会话；并发登录与全部退出按锁取得顺序串行。

当前/全部退出与相应审计一起提交，审计失败不给成功或Cookie清除；数据库整体故障不能放行。提交不确定按既有事务合同处理，不自动重试写操作。正常登录的审计单独故障例外仍沿用T04。

## 项目范围失效接口

`invalidateAccountAccess(client, accountId, {source, actor})`位于apps/api/src/session-lifecycle.ts。新项目必须先完成自身服务端权限核验，用现有 `transaction(pool, ...)` 获取客户端、`authorizationLock(client)` 获取独占锁，再更新自己拥有的范围数据，调用该接口并在同一事务提交。接口提升auth_version并保存scope_access_invalidated审计；失败抛出，调用者不得吞掉失败后提交。actor/source必须来自可信宿主或已验证身份，不使用未验证的浏览器自报者。

该接口也获取同一锁，必须传入当前事务客户端，不能传pool或在自动提交上下文执行。模板不定义范围表、供应商/店铺/仓库字段、编辑器或授权范围模型。旧密码/飞书会话共用版本检查，失效原因使用authorization_changed（文案涵盖访问范围变更）。测试专用范围表只存在于隔离测试库。

## 前端控制器与活动

账号、受保护和管理员页面均挂SessionGuard。成功会话响应返回公共heartbeatSeconds；HEARTBEAT_INTERVAL_SECONDS缺省30，整数1–300秒，配置错误拒绝。可见且在线周期检查；恢复visible或online立即检查，并取消旧的未完成校验。隐藏/离线暂停新周期请求；请求6秒超时和清理中止避免重叠/旧响应在卸载后导航，不承诺操作系统后台精确计时。

实际pointerdown/keydown/wheel且isTrusted、可见在线时，最多每5秒上报一次activity；纯鼠标移动、合成事件、后台定时器、可见性恢复与心跳不报活动。退出按钮不额外发活动，避免退出与活动请求竞态。页面本身的正常交互业务API也可更新服务端活动。

客户端仅对服务端明确401及已知原因立即结束当前页面，用location.replace到带原因的登录地址，不倒计时或等待确认。原因包括login_required、authorization_changed、account_disabled、session_idle、session_expired、session_revoked、all_sessions_revoked、organization_denied、agent_login_denied；登录页文案集中配置且URL原因刷新仍保留。网络、超时、5xx与普通业务403不撤销登录。服务器渲染瞬时失败在原路由显示重试，不把连接故障跳到登录页。未来客户端业务调用使用sessionFetch来应用相同401处理，不能把403当会话失效。

收到明确失效后不再渲染旧登录内容；失效Cookie不能访问后端，重新登录会替换它。失效响应不额外撤销其它设备，也不在旧请求中清除可能已由另一标签页重新登录的新Cookie。后台校验发现当前Cookie身份/版本与已渲染页面不同也要求重新进入，避免静默替换权限内容。

## 标签页与未保存整合

同浏览器共享Cookie的标签页共用会话，退出按钮通过localStorage发非授权性质的检查通知；其它标签页立即向服务器核验，包括隐藏页。通知本身不能注销有效会话或授予角色；存储不可用时仍由周期/恢复检查发现失效。独立设备/浏览器会话各自计时，当前退出只影响当前会话。

`endSession`先标记sessionIsEnding、清除window.onbeforeunload、发送templux:session-ending，再完整导航；认证页的捕获beforeunload处理阻止随后注册的未保存提醒监听器。新项目的未保存守卫应检查sessionIsEnding并在该事件释放自己的导航/弹窗守卫，不能阻挡强制结束会话。任意外部代码抢先注册的捕获监听器或自建路由拦截须遵守该整合合同，模板不声称能移除未知第三方监听器。本票没有提前建设T14编辑器或完整未保存UI。

## 验证与后续

真实SQL/HTTP/CLI覆盖当前/全部退出、多设备、重启、活动/期限、审计回滚、范围事务和并发锁边界；正常密码Agent页面覆盖标签页/离线恢复/可见性/403/网络及未保存整合。真实飞书组织验收仍由T03另列；常规测试仅模拟外部飞书协议，不绕过本地SQL、会话或权限。

Context7核对[React effects/cleanup](https://react.dev/reference/react/useEffect)、[pg同客户端事务](https://node-postgres.com/features/transactions)和[Chrome网络状态协议](https://chromedevtools.github.io/devtools-protocol/tot/Network)。遵循Postgres短事务和既有版本迁移规范；本票复用现有结构，无新迁移或部署数据变更。

## T05 F1：SSR响应体失败的恢复边界

fetch在响应头到达后即可完成；200响应的JSON body仍可能断流、解码失败、超时中止或语法错误。profile仅在成功response.json消费/解析的Promise上捕获这些失败并返回null，由/account、/protected、/admin显示本路由重试；不清Cookie、不误跳登录。映射及页面渲染不被广泛catch覆盖，401/403的Next redirect仍在body catch之外。

使用真实Next Web和独立HTTP故障服务回归，服务只注入上游响应故障/协议元数据，没有登录、session发行或授权操作，且仅作为tools测试容器，生产镜像不包含该脚本。依据 [Next redirect控制流](https://nextjs.org/docs/app/api-reference/functions/redirect) 与 [Response.json异常](https://developer.mozilla.org/en-US/docs/Web/API/Response/json)、[响应头后body中止](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)。

## T23 数据恢复

容器恢复在同一恢复事务中清除所有人员/Agent持久会话及未完成OAuth/关联证明，可靠审计并设置offline后才允许后续显式开放。独立目标未来接入也拒绝旧Cookie；正常服务重启不调用此清理。恢复runId和故障闭合/人工救援见[恢复合同](backup-and-recovery.md#t23明确目标恢复)。
