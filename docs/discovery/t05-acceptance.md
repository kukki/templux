# T05 实现与验收记录

日期：2026-10-15（Asia/Hong_Kong）。Gitea Swython/Templux #6，父规格#1；工程/审查基线 `f169a27f2d9205988121662c7c1b75e11c25fb01`。保留全部12个先前本地提交，不推送、不关工单。

## 交付与实施选择

- 会话读取在同一客户端短事务取得授权共享锁；版本/状态/撤销/角色与活动校验不再跨管理变更读取。授权/登录/重置/退出/范围失效使用同一独占锁，保护已提交变更后的新请求。最长/闲置校验用当前时钟，避免锁等待前事务时钟延迟；活动单调更新。
- 新增真实heartbeat（只读）、同源activity、当前/全部退出，持久撤销与退出审计同事务；范围失效接口接入项目自己拥有的范围事务和审计，不内置范围模型。
- 账号/受保护/管理员页装SessionGuard，可见在线默认30秒（配置1–300）；恢复可见/在线立即检查，取消旧请求，6秒请求界限。真实输入节流5秒更新活动，后台心跳/合成事件不续闲置，退出按钮不另发活动。
- 跨标签页仅通知服务器重查，不信任localStorage为授权；明确401立即回登录持续原因；正常403/网络/5xx不退出，服务器渲染故障在原路由重试。清理未保存守卫与整合事件见合同，无T14编辑器。
- 复用0004现行结构，无新迁移或部署SQL对象更改；测试专用范围表/触发器仅在独立库创建并删除。人员/Agent默认12小时/10分钟及原独立环境参数保持。

合同 `docs/specs/session-lifecycle.md`；步骤 `docs/superpowers/plans/2026-10-15-t05-sessions.md`；集中通用文案config/auth-copy.json。

## 容器、SQL/HTTP/CLI验证

| 命令/场景 | 结果/证据 |
| --- | --- |
| 修改前heartbeat HTTP | 404而预期401，红测试失败；t05-red.log。 |
| `docker compose build api checks management auth-config-probe web` | 退出0；t05-backend-build.log、t05-final-build.log、t05-final-rebuild.log。 |
| `docker compose up -d --wait --wait-timeout 90 api web`及最终Web更新 | 健康、结构0004不变；t05-start.log、t05-final-web-start.log。 |
| 专项SQL/HTTP/CLI | 41/41通过；t05-targeted.log（随后增加退出审计故障覆盖）。 |
| `./templux test --non-interactive --json` | **69/69、0失败/跳过、退出0**；t05-final-test.json/.log，包括T02/T03/T04/F1回归。 |
| `./templux typecheck --non-interactive --json` | API/Web通过、退出0；t05-final-typecheck.json/.log。 |
| Shell/补丁 | sh -n templux tests/presentation-installation.sh与git diff --check通过。 |

测试采用明确TEST_AUTH_DATABASE_URL/templux_auth_test，tmpfs隔离库，无生产连接回退；正常HTTP password建立真实会话，CLI authorize明确确认并真实保存。

关键覆盖：心跳多次不改变SQL last_active_at；明确同源活动/交互保护请求推进时间，攻击Origin不推进；已闲置/最长过期不能由activity复活；valid403仍heartbeat200；当前退出只一设备、另设备仍可用，新服务器实例仍拒绝已撤销Cookie并接受有效Cookie；全部退出含当前和所有同账号设备、不影响另一个账号，之后正常登录可建新会话；人员/Agent独立期限生效；CLI状态/版本变化旧会话401；退出审计故障503且不清Cookie/不撤销持久会话；项目范围数据/版本/审计同提交，审计故障三者回滚且原会话200。

并发边界用实际Postgres锁观察：独占授权事务先提升版本但未提交，发起正常保护HTTP，pg_locks显示真实共享锁等待、请求尚未结束；提交后该请求401 authorization_changed，后续正常重登200。没有用类型检查或纯定时断言代替边界验证；不声称撤销已通过权限检查的在途操作。

## 正常浏览器验证

ego-browser新空间34/35，测试主机 `127.0.0.1:31040` 与用户Ego31的localhost分离。正式API/Web镜像→隔离真实SQL；受控CLI创建人员责任人及独立Agent、随机密码受限文件，明确授予user，正常密码表单登录。

- 可见页2秒测试配置心跳多次200；仅心跳期间SQL活动时间精确相同（t05-browser-heartbeat-before/after.txt）。首轮比较夹带管理员API403交互请求，按设计活动推进；重新限定只心跳后不变。保护页实际指针点击推进SQL活动（t05-gesture-before/after.txt）。
- 普通管理员API403，仍停/protected，心跳200；停止隔离password-api时在线页请求503仍停/protected；另页访问/account显示重试而不跳登录。恢复容器心跳200；正常重启该API仍接受原Cookie，未重新登录（t05-api-outage.log、t05-api-recovery.log、t05-browser-restart.log）。
- 两个共享Cookie页面当前退出共同回/login?reason=logged_out，刷新仍显示“已退出当前会话”；正常重新登录后全部退出共同回/login?reason=all_sessions_revoked并显示持续原因。独立设备/另一账号范围由实际多Cookie HTTP测试覆盖。
- 隐藏可见性信号下心跳请求计数57→57，CLI变更后隐藏页仍保留页面，恢复信号约110ms内完成校验并回带authorization_changed的登录页。**Ego把两个WebContents均显示为visible，故visibilityState/visibilitychange由测试页面模拟；未宣称真实OS后台标签调度已验收。** 请求、定时器、认证与SQL保持真实。
- Chromium Network.overrideNetworkState控制navigator.onLine：同一脚本/协议连接中离线true、真实CLI变更后仍离线true且停/protected；恢复在线约102ms完成校验回登录。工具断开协议连接会恢复覆盖，已重新按同一连接验证，不将早期跨脚本状态当作离线证据。正常网络/503单独按实际容器停机验证。
- 带未保存window.onbeforeunload和后注册监听器的页面失效后立即跳转，无确认/倒计时。补可核验对照：普通导航真实beforeunload回调写标记1；再次装守卫后CLI失效，回调标记0、后注册监听器0，直接到/login?reason=authorization_changed。工具未展示原生弹窗，因此证据为真实回调绕过与最终导航，未伪称OS原生弹窗外观已验证。
- 测试库把真实登录会话活动时间设为601秒前，浏览器心跳返回session_idle并持续显示闲置原因，未等待实体10分钟；未添加生产时钟或认证测试入口。
- 390×844失效页截图t05-invalidated-narrow.png，密码输入为空，已实际查看；T05沿用现有品牌/响应式布局，无额外示例业务。

测试流程没有操作真人/Ego31/.env或发飞书通知。Ego34/35已关闭，password-api/password-web/auth-database移除，test-results/t05-credentials私有初始密码文件删除，部署API/Web/database继续健康。普通结果/日志不含明文密码或Cookie；忽略日志/截图/活动时间证据保留。

## 依据与局限

Context7核对React effect/清理、pg同客户端事务及Chrome网络状态协议；Postgres技能在SQL对象/事务改动前加载。codebase-memory图定位/调用链/源码/覆盖均完成，本票14条代码证据路径无已记录缺口，信号best-effort不证明全仓完整；旧迁移的解析缺口此前已直接读取，未修改迁移历史。

平台macOS/Docker Desktop、Linux容器、Ego Chromium；没有完整Linux/WSL宿主、实体移动设备、负载或OS后台调度矩阵。可见性信号模拟和原生弹窗显示边界如上。项目自建未保存/路由守卫必须遵守sessionIsEnding/templux:session-ending整合合同，不保证移除未知抢先捕获的第三方监听器。T07失败限制、T08人员关联/重置、T14完整编辑UI仍属后续票；T03真实组织人工验收仍另列未完成。
