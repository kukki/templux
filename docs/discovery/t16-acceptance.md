# T16：顶部通知、队列与显式键合并验收

2026-10-15，Gitea#17/#1故事83–84；基线`fcbd5dbda737d92782cff7f5d9be66e1c9ee7bf2`，保留既有47个本地提交。开发交付待独立审查，不推送/关闭工单。采用合同见[顶部通知](../specs/top-notifications.md)，设计及执行清单见[t16-plan](t16-plan.md)。

## 范围与选择

- `shared/notifications.mjs/.d.mts`提供单调时间控制器、不可变快照和有界活动集合；通用React视图在`components/elements/notifications.tsx/.css`。不依赖examples，不新增API/SQL、维护通知、消息中心或外发。
- 默认15000ms、桌面3/≤700px窄屏1，可见项才扣时；hover/focus原因并集。同显式键同级只增count，首次内容/时长/位置/剩余/暂停保持；无键不按文字去重、结束项不合并。
- 实施选择：info/success/warning/error四级均FIFO，不插队；等待容量50、范围1–500，可见数1–10。溢出只移最早从未显示等待项，累计数字摘要；断点移走的尾部显示项独立暂停（最多9）、保留剩余，清失效DOM暂停原因，优先恢复。省略摘要到clear/end/卸载结束，无正文历史。
- 独立polite/atomic播报区域不随进度变化，通知不自动夺焦点；关闭/移走当前焦点项返回可见关闭入口或调用方returnFocus。触屏正文不新增暂停手势，键盘随后进入仍暂停；实际已有鼠标悬停不因触屏而解除。
- 呈现配置旧三字段分支补queueCapacity50，整个缺分支补默认；显式null/空串/不完整或越界拒绝，重启载入快照。现用presentation未修改。示例仅合成内存，未把提示当其它真实操作成功依据。

## 最终源码验证

所有正式代码变动在`t16-final-build.log`构建之前完成，此后仅文档；测试容器与宿主6个关键文件逐字节对应及SHA256见`t16-final-source.json`。下列本机证据存ignored `test-results/t16-*`，已提交可复跑控制器/配置测试、实际组件fixture及浏览器场景模块。

```sh
docker compose build checks web
docker compose up -d --wait auth-database password-api password-web ssr-body-api ssr-body-web
docker compose run --rm --no-deps -e TEST_API_URL=http://password-api:8080 -e TEST_WEB_URL=http://password-web:3000 checks npm test
docker compose run --rm --no-deps checks node --test tests/notifications.test.mjs tests/presentation.test.mjs tests/editor.test.mjs tests/editor-deadline.test.mjs
docker compose run --rm --no-deps checks npm run typecheck
```

| 验证 | 结果/证据 |
| --- | --- |
| RED/GREEN | 新控制器测试在实现前缺模块失败：`t16-controller-red.log`；实现后初始10项全通过`t16-controller-green.log`，随后增加真实CLI配置与重启快照测试。 |
| 构建 | `t16-final-build.log`退出0，checks/web完成；生产路由不含fixture。 |
| 完整集成 | `t16-suite-correct.log`：194/194、0失败/跳过/取消，约58秒；真实隔离Postgres0008、SQL/HTTP/CLI、既有登录/授权/审计/会话/示例门及新通知配置均贯通。 |
| 最终专项 | `t16-targeted.log`：40/40，0失败/跳过；包含通知11项、呈现、T14/T15编辑状态回归。 |
| 类型 | `t16-typecheck.log`及`t16-final-typecheck.log`：API/Web退出0；实际挂载fixture的`t16-fixture-typecheck.log`亦0。 |
| 可控时间 | `tests/notifications.test.mjs`：14999/15000精确边界、同时到期、晚90秒协调不消耗未显示时间、hover/focus并集、同键/级别/首次内容/剩余/排队位置、无键、结束后新项、1000次入队容量、溢出、收缩/恢复、clear/end、无效输入及真实config-check/重启快照。 |

首轮完整suite的`t16-suite.log`有5个失败（含父场景汇总）：为正常浏览器Cookie隔离，我提前把自有API origin设为127.0.0.1，但既有examples集成明确发送localhost Origin，实际403而预期200。核对两端后仅将自有API切回默认localhost，重跑完整suite得到上述194通过；不是修改测试/生产同源保护。正常浏览器阶段再把自有API切回127.0.0.1。

## 实际组件与正常密码页面

Ego TaskSpace56、同一p1，未触碰31或用户页面。实际组件fixture仅挂载自有t16-components：`tests/fixtures/notifications-page.tsx`，受控单调时钟由可见按钮推进；场景为`tests/scenarios/notifications-browser.mjs`。开发容器用官方next dev命令，临时next.config仅允许127.0.0.1开发资源；未改正式next.config。正常页面使用CLI正常创建的自有人员、随机密码0600文件及user授权，正式API/真实SQL登录，没有fixture认证入口。

| 场景 | 实测证据 |
| --- | --- |
| 8组真实组件 | `t16-components.json/log`：hover后14秒余量保持、合并×2且保留原内容；hover离开但focus保留及内部移动仍14秒；均离开后减至13秒。8条入队显示3/等待2/省略3；同刻到期提升7、8号且各15秒。断点收缩保留两条各14秒，移走焦点后返回可见关闭；扩展优先恢复，键盘关闭补位/焦点可达，end后空且后续push无效。 |
| 真触控事件 | `t16-touch.json`/`t16-touch-green.log`：CDP真实touchStart/End产生pointerType=touch，正文获焦但不暂停，推进1秒余14秒；随后Shift+Tab进入关闭按钮，保持14秒且paused。不是仅派发合成PointerEvent。 |
| 正常页面15秒 | `t16-browser.json/log`：初始14991ms，hover与焦点/内部移动均停在13939ms；离开继续并过期，总墙钟18215ms（含暂停及操作开销）。不声称浏览器调度精确到毫秒。 |
| 正常合并/容量 | 同键同级×2、首条标题保留且未重置剩余；同键不同级两条，无键相同文字两条。连续60条，桌面3/等待50/省略7；390px显示1、暂停隐藏2/等待50，页面宽390无横溢出。 |
| 长文/关闭焦点 | 正文content1322/client192、键盘End滚动210；通知左右16/374，页面390，关闭始终可达；键盘关闭后回“显示通知”。 |
| 权限变化 | 已有通知时正常CLI撤user至none，受保护API200→401；online检查114ms重登，旧通知0，刷新仍authorization_changed，`t16-browser-revoke.log`。未改真人权限。 |
| 生产边界 | 最终Web `/t16-component`404，匿名`/api/protected`401，`t16-production-boundary.json`。 |

已实际查看`t16-notices-desktop.png`、`t16-notices-narrow.png`、`t16-notices-long.png`：沿用品牌变量，桌面3条、窄屏1条与摘要在视口内，长文独立滚动且关闭/进度可见。

初始触控脚本先用鼠标点击发布，提示刚好出现在鼠标位置，已有合法hover暂停；随后touch不应取消这个独立原因，因此“不暂停”断言失败。`t16-touch-diagnosis.json`记录事件顺序与纯触控对照；改为不产生鼠标悬停的发布、再实际touch操作，得到上述通过，没有移除暂停原因并集。浏览器脚本另修正一个4按钮模糊selector；均属测试操作修正。开发容器起初误用不存在的npm dev脚本，改为官方next dev；初次启动未就绪请求失败后增加HTTP readiness，不改应用逻辑。

## 清理与限制

TaskSpace56已finish({keep:[]})一次（`t16-browser-finish.log`）。已删除t16-components与自有password-api/password-web/SSR/auth-database测试容器，tmpfs测试身份销毁、私有0600凭据目录删除。公开37个本轮证据文件匹配实际测试密码0次（`t16-secret-scan.json`）。原api/database/web仍健康，status ready/schema0004、login200（`t16-final-services.json`、`t16-original-status.json`），未迁移/重启原服务，未改.env/实际presentation、Ego31、真人或发送飞书通知。

浏览器为本机Chromium视口及触控仿真，不等于物理手机、全部软键盘/OS/读屏产品；读屏仅验证live语义和无逐帧文本变动，不声称真人读屏测试。后台/休眠仅保证恢复按单调时钟协调，非精确后台15秒，也不保证OS休眠时performance.now一致推进。无跨导航/重启恢复、维护通知或真实消息外发。T03真实飞书组织人工验收仍单列未完成，密码链路不替代它。


## 初审后修复

F1到期与断点收缩交错的队列修复及最终45项专项/实际组件证据见 [T16 F1修复验收](t16-fix-acceptance.md)。上述初次交付验证点与独立审查历史保留，不将194项旧完整suite声称为修复后重跑。
