# T20 独立审查：导航偏好隔离与窄屏抽屉

## 范围与结论

- 固定范围：`baf0fbbd96c85615c28c7ceda066d0c2048f02a1..fc7c239a6183b229ca61af77e350f12d0e1547f8`；审查时 HEAD 为后者，初始工作树干净。
- 同一独立审查者依次执行 Standards / Spec，遵循 Team 权限，不新增成员。读取 #21、父规格 #1、仓库规范/ADR、T02 导航约定、`application-navigation.md`、T20 计划及验收记录，审查全部 23 文件差异及相关 EditNavigation/session 依赖。
- Standards：**0 项发现**。配置严格校验、集中中文文案、公共组件依赖方向、纯内存示例和服务器授权边界未见本范围新增问题。
- Spec：**1 项 F1 / P3**。建议修复抽屉拖动误关闭后再完成 #21 验收；其它已检查合同未发现阻塞问题。此问题不造成草稿丢失或权限绕过。

## F1 / P3：遮罩拖入抽屉后抬起仍被当作外点关闭

定位：`apps/web/app/components/application-shell.tsx:19`，抽屉 `onPointerDown` / `onClick`。

触发条件与独立复现：390×844，打开导航；原生鼠标在遮罩 `(385,300)` 按下，连续移动至抽屉标题 `(150,40)` 后抬起。实际事件依次为：

1. `pointerdown`，target 为 `navigation-drawer`，坐标在框外。
2. `pointerup`，target 为内部 `drawer-heading`。
3. 浏览器按共同祖先派发 `click`，target 为 `navigation-drawer`，坐标在框内。

实际：抽屉关闭、body 滚动锁释放。字段仍为原值；没有数据损失。独立证据：`test-results/t20-independent-backdrop-drag.json`，并非直接派发 DOM click 的模拟。

原因：只保存合格按下的 pointerId，click 时只判断 target 与记录非空；没有匹配抬起的位置、指针或拖动。浏览器的共同祖先 click 不能证明发生了遮罩点击。合同要求主指点击关闭，拖动不得误当外点。

建议：记录该手势的指针及起始位置，只有匹配的抬起仍位于框外且没有形成拖动才允许关闭；取消、多触点和生命周期结束清理记录。补原生“外按内抬”和“内按外抬”对照，同时保留正常遮罩点击、Escape、焦点恢复与 dirty 状态。不要用延时补关或以 click target 单独判定。

## 独立执行与证据

复用最终 `templux-checks` 镜像；专项只读挂载最终 shared/tests，组件页仅挂载到自有开发容器，没有创建数据库或凭据。

| 检查 | 实际结果 / 证据 |
| --- | --- |
| `node --test --test-concurrency=1 tests/navigation.test.mjs tests/presentation.test.mjs tests/editor.test.mjs tests/editor-deadline.test.mjs tests/overlays.test.mjs` | 60/60，fail/cancel/skip 均 0；`t20-independent-targeted.log` |
| 镜像 `npm run typecheck` | API、Web 均退出 0；`t20-independent-typecheck.log` |
| 自有组件容器 Web typecheck（含 fixture） | 退出 0；`t20-independent-fixture-typecheck.log` |
| 源码与镜像对应 | navigation、ApplicationShell、ProjectShell、Logout、navigation.css 五文件 SHA-256 全部一致；`t20-independent-{image,source}-hashes.log` |
| 真实 React 保存锁 / ending | blocked 导航保持、两种退出入口不发请求；ending 释放抽屉和锁；`t20-independent-blocked.json` |
| 消费者取消与 dirty 拒绝 | native preventDefault 时零确认；随后真正离开触发确认，拒绝后原路由、值和抽屉保持；`t20-independent-dirty-cancel.json` |
| 真实双标签 storage 事件 | 同账号 key 展开/收起同步、删除恢复默认；仅操作并恢复本 fixture 的准确 key；`t20-independent-storage.json` |
| storage 故障 / 键盘 | 页面限定注入 SecurityError/Quota：默认可用、内存切换、刷新回默认；移除注入后恢复正常；连续 12 次 Tab 留在抽屉，Escape 返回菜单且释放 overflow；`t20-independent-fault-and-focus.json` |

组件浏览器为自有 Ego73、合成账号与受控 EditSession；不将其称为真实 SQL 身份或真实撤权验证。没有发送真实退出/外发请求。

源码确认：偏好 key 使用 projectKey、项目名和稳定账号 ID；仅持久化版本及 expanded。配置禁用不读取/写入旧偏好；错误缓存回默认，写失败保留内存行为，结束后的 store 不可再用。账号/配置 key 重建壳，SSR 不读取旧身份 storage；允许从项目默认到本人偏好切换。导航由 profile 的状态、权限及 feature 生成，服务端授权未被可见菜单替代。壳与内容共享 EditNavigationProvider，pathname 提交才关闭抽屉，两个主动退出走同一 requestLeave。

结构查询遵循 search → trace → snippet；本范围 23 个差异路径及相关编辑导航/session 依赖均做覆盖检查，报告为 metadata_match，并直接读取源码核对。图谱只作为结构线索，不据此宣称动态调用完整性。

## 开发证据复核（与独立执行区分）

- 核对人员、管理员及 Agent 的实际登录、隔离偏好、重登、两种退出记录；CLI 撤权后持续原因登录页、抽屉/滚动锁清理的 114ms 记录属于开发实际身份验证。本轮未重复创建身份或 SQL 操作。
- 核对配置 7 组、storage 故障、生产 fixture 404 和源码 hash 记录。开发早期 255 项早于最后 Tab / 配置捕获 / 壳 key 修正，**不作为最终全套重跑**；最终独立范围是上列 60 项及组件交错。
- 逐张查看 `test-results/t20-shots/` 全部 **16 张真实 PNG**（四主题 × 两方向 × 桌面/窄屏）及 **4 张拼图**。桌面栏宽、横向换行、图标/当前项、窄屏文字抽屉、账号和两退出无明显裁切；结合矩阵 DOM 数据核对尺寸与可达性。来源为 agent-browser 真实密码会话的隔离配置矩阵，原 CDP 截图失败后的成功替代，不是生成图片。本轮没有重新拍摄矩阵，也不将人工视图核对声称为定量对比度或读屏认证。
- 开发 suite 首次错误 origin / 原 schema0004 诊断与改显式隔离 URL 后结果分开，未据此弱化同源检查或迁移原部署。

## 清理与局限

Ego73 自有页面已 finish，`t20-review-components` 已删除。原服务未重启、重建或迁移；结束时 `/api/status` 为 ready、database connected、schemaVersion `0004`，见 `t20-independent-original-status.json` / `t20-independent-cleanup.log`。未修改 .env、presentation、部署、真人权限或 Ego31，没有推送或关闭工单。

未重复 255 全套、生产构建、身份矩阵或全平台浏览器；受控 storage 故障不等同所有隐私模式，Chromium 键鼠/组件结果不保证物理触屏、所有软键盘或辅助技术。T03 真实组织人工 OAuth 验收仍单列待办；本次不操作或等待该链路。以上结论限定固定范围与所列证据。

## F1 定向独立复核附录

固定修复范围：`b264529fa87f7cb3484b18ee7d7d54adcf347c58..68e87bfc1b80726f8097c32577239d069accee2b`。读取全部 8 文件差异、修复验收及更新合同，保留以上初审历史。

### Standards

新增 **0 项**。手势状态提取到无浏览器依赖的共享模块并提供类型合同；ApplicationShell 只承担几何判断和原生事件接线。事件监听与生命周期清理成对，无定时补跳、click 重放、业务 API/SQL 或配置范围扩大。

### Spec

**F1/P3 关闭；新增 0 项。结合初审与本次复核，建议按 #21 验收。**

原复现使用同一鼠标坐标独立执行：遮罩 `(385,300)` down → 标题 `(150,40)` up → click 共同祖先仍为 dialog，但最终 `open=true`、overflow 保持 hidden。修复核对了完整手势而非仅更改 click 目标判定。

`createBackdropGesture` 记录活动指针、候选及已完成轻触；起终点与 click 必须指针 ID/类型一致、主键、真实遮罩几何合格，距起点不超过 5px。超限不可返回恢复；第二触点取消本次候选，须全部结束后才接受新手势。活动 capture 丢失作废，正常 pointerup 后隐式释放保留已完成轻触。关闭、断点、卸载、ending 的 layout cleanup 与 window blur 均清空状态。监听覆盖打开期间的完整指针流，内部第二触点也会被登记。

通过 Context7 核对 [MDN Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) 的隐式 capture 及 pointerup/pointercancel 后释放语义，以及 [click 共同祖先规则](https://developer.mozilla.org/en-US/docs/Web/API/Element/click_event)。真实触屏轻触回归确认正常释放没有误禁关闭；未以纯逻辑测试代替浏览器时序证据。

### 本次独立验证

复用旧 checks 镜像 `sha256:54624e8a05378346234f0c012df011128372f1a14260285cdf1b8508f17d7c2d`，**只读挂载最终 shared/components 和现有 fixture**；不是新生产镜像或生产构建验收。自有端口 31043、工具路由 `/t20-component`，内部 API 为不可达 `127.0.0.1:1`，没有数据库或测试身份服务。

- 最终专项：原 60 项命令追加 `tests/backdrop-gesture.test.mjs`，**67/67**，fail/cancel/skip 均 0；`test-results/t20-f1-independent-targeted.log`。
- API/Web：旧镜像只读挂最终 shared 与 Web app 后 `npm run typecheck` 退出 0；fixture 所在自有容器的 Web typecheck 退出 0；`t20-f1-independent-{typecheck,fixture-typecheck}.log`。
- 关键源码：主机/容器 SHA-256 一致且两文件 `cmp` 均退出 0。ApplicationShell 为 `6d0054c40529fafec2f7f7b604b8d0351c08757938fe13a2024e11f781ef03d5`；手势模块为 `9ea790b90878e6277468012a752e198982619d60f9bde56d50edab6753c7b1e9`；见 `t20-f1-independent-{host,container}-hashes.log`。
- 版本化 `drawerBackdropGestures` **12 个命名场景全部通过**：鼠标内外双向、遮罩拖动及返回、正常 mouse tap；CDP touch 内外双向、拖动、原生 cancel、标题第二指、全结束后新 touch tap；实际活动期间 releasePointerCapture。附带 Escape/桌面断点关闭、重新窄屏开启、菜单焦点和 overflow 断言通过，底层 click=0，值 Initial。结果 `t20-f1-independent-browser.log`。
- 同日志的 `drawerGuardRegression`：dirty 导航和当前退出均弹确认，拒绝保留草稿/抽屉；遮罩关闭不丢草稿；9 次 Tab 在抽屉内；按住指针 Escape 关闭再开，旧手势不残留。
- 同日志的 `controlledNavigationLock`：保存 blocked 不确认/不离开、logout 请求 0；公开 session-ending 事件清空抽屉、释放滚动锁并结束等待。此为真实 React 消费者与受控编辑器验证，**不是本轮真实 401/SQL 撤权重跑**。
- 额外纯逻辑对照：精确 5px 允许、5.0001px 拒绝，错误 pointerId/type 拒绝，down/up 两阶段 reset 均清旧候选且新 tap 可用；`t20-f1-independent-boundaries.log`。blur/unmount 的监听移除与 reset 通过源码核对，不冒称本轮执行了所有原生窗口失焦矩阵。

结构核对使用 search → 双向 trace → snippet；涉及的修复路径、fixture、原导航场景、合同、历史审查及相关 ADR 均做覆盖检查，均 metadata_match，并直读本次源码；仍为 best-effort 信号，不证明动态图完整性。

### 沿用证据、清理与局限

账号 storage/配置、布局 CSS 及原 16 张 PNG + 4 拼图没有本次修改，沿用初审核对结果。开发修复 RED/GREEN、67 项及组件日志已核对，本附录列出的独立结果与其分开。未重复历史 255 全套、截图矩阵、生产构建、SQL 身份或凭据操作。

Ego75 已 finish，自有 `t20-f1-review-components` 已删除；原 API ready、数据库 connected、schemaVersion 仍 `0004`，见 `t20-f1-independent-cleanup.log` / `t20-f1-independent-original-status.json`。仅追加本审查文档，不改实现、部署、.env、presentation、真人权限、Ego31 或飞书，不 push/关票。原平台/物理触屏/辅助技术及 T03 真人 OAuth 人工验收局限继续保留；本次 CDP 触控不等同物理多指全平台验收。
