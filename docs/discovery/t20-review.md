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
