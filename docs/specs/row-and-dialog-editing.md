# 按行编辑与编辑弹窗

T15 / #16，父规格故事81–82；ADR0012、0020、web-elements及forms-and-unsaved-edits为上层合同。正式组件在components/elements，示例在可移除examples；无示例API或数据库。

## 采用及数据所有权

- `EditableTable`未传editing配置时使用既有ReadonlyTable，不渲染操作列或编辑入口。显式配置提供version(row)、session(row)，本票采用表下的当前行编辑区（标题标识记录ID），同表同时只编辑一行，其它入口禁用，完成/取消后才可选另一行。
- rowKey必须是唯一稳定ID；version必须随已存记录变更而变化，项目负责不可变记录及真实服务端乐观并发校验。session提供明确初始字符串字段、normalize/validate、save、可选verify和onCommit，字段/权限/后端规则不由表格猜测。
- 选中时冻结本行、基线、回调与字段配置；刷新/删除/加载/取消editing配置不悄悄替换草稿，仍显示编辑区域。源缺失/版本变化会显示冲突并禁用保存；等待中的旧成功改为未确认，不覆盖最新数据。取消后重新打开最新行。关闭只丢本行，不reset其它编辑器。
- `EditDialog`每次挂载表示一个编辑目标，targetKey变化会保留原草稿并禁止旧目标提交。相同ID的新版本应体现在targetKey中，或显式设置conflict；不能用React key强制卸载来绕过提醒。项目onCommit也必须核对目标/版本，真实服务端仍作最终检查。
- 示例选择单行编辑与弹窗互斥；组件不强制所有表共享单个编辑器。多个编辑器可注册同一个导航Provider，局部requestDiscard只处理指定源，普通表单“还原编辑”也只还原自身；离开页面requestLeave统一处理全部。

## 保存、截止与核验

共用createEditor/useEditor，继承T14所有校验/最新反馈/消费者取消语义。EditSession默认30秒截止，可显式timeoutMs覆盖（1–300000ms整数，配非空timeoutMessage）；普通T14表单不配置deadline时保持既有等待方式。EditSession显式启用lockWhileSaving：UI禁用字段、保存、取消/关闭；控制器也拒绝改值、reset和重复submit，导航Provider拒绝主动离开。低层cancel只供强制结束/卸载，不能冒充用户保存中取消。

save(values, signal, {attemptId})返回saved/fields/error/forbidden/ended/unconfirmed。attemptId是每次明确提交生成的128位随机标识，不是凭据/权限或已实现的服务端幂等保证；使用getRandomValues，避免新增仅安全上下文可用的randomUUID依赖。项目在服务端将操作标识与已验证操作者、目标、版本及结果关联，并独立授权；不得将包含业务字段的receipt写入普通日志。

- submit只返回仍被控制器接受的结果；取消、卸载、新代次后旧结果不提交到父记录。
- 超时释放saving/blocked，保留输入和`uncertain:{attemptId,values}`，标示结果未确认。abort只结束本地等待，可能的远端写入不因此取消；传输忽略abort也不能晚返回假saved。
- uncertain期间禁止再次submit，不自动重试写操作；verify(receipt, signal)由项目显式核验，可返回saved、not-applied或unknown。unknown保留未确认状态；reconcile只接受当前receipt ID。saved推进确认基线而保留后来编辑/已暴露错误；not-applied解除阻止，用户仍须明确再次保存。
- 保存结束后默认成功关闭；核验成功但期间已有新编辑时保持编辑器，不能把新值假报已存。失败保留输入、字段错误就近/其它错误表单级；提交错误聚焦首个错误字段或表单错误。
- cancel/reset/卸载使旧保存与核验无效。cancel/reset会丢本地receipt，**不取消远端提交**；关闭未知结果的编辑器前，真实项目须在编辑器外保留操作标识及后续核验能力，重新编辑前核对最新数据/版本。本组件不建立持久操作台账，也不承诺刷新恢复草稿。
- 401使用现有sessionFetch/endSession并返回ended；强制结束会取消等待、释放弹窗和导航守卫，无确认阻挡。403与网络故障保留页面；写操作网络/读取故障若不能确认是否提交，应返回unconfirmed而非假报明确未提交。

## 关闭与可访问性

EditDialog使用原生dialog.showModal()、aria-labelledby和可见标题。初始焦点进入首个字段，浏览器使背景不可操作，并通过局部Tab边界处理将首尾焦点循环在弹窗内；关闭返回触发元素（仍存在时，可传returnFocus）。提供关闭按钮、取消及Escape，全部调用同一关闭判定；遮罩不关闭。dirty先确认，取消保留；等待中UI及事件层都拒绝关闭/取消/Escape/重复提交。会话结束无条件优先，不恢复失效访问。

弹窗宽度随视口缩放、最大高度基于dvh、内容可滚动；窄屏表格全部列在自己的容器横滚，行编辑区域保持视口宽度，不将字段压成不可读的窄列。浏览器原生focus/inert/Escape能力随平台；beforeunload及未接入历史边界沿T14合同。消费者onClick/onNavigate同步取消先执行，不能为一个已取消的导航丢弃草稿。

## 内存示例

`/examples`默认仍无行编辑入口，勾选“启用按行编辑”后可体验保存/取消；另可打开编辑弹窗。三个合成记录与操作回执仅本页内存，正常/字段/表单/403/网络、等待约6秒、超时约1.5秒而结果约4.5秒后可核验。提交次数帮助观察显式保存与核验没有自动重试。刷新示例记录演示冲突保持。显示数据只在接受提交/明确核验后更新，远端实际数据以项目服务端为准，不把该模拟当真实业务后端。

## T19外部关闭边界接入

EditSession可选registerClose注册公共CloseBoundary，将requestDiscard及blocked订阅交给单个非模态面板；不复制保存/超时/dirty逻辑。可选manageFocus=false由外部面板负责进入/返回焦点，避免旧编辑器卸载抢走替换目标焦点；默认true保留原行/模态行为。具体见[面板合同](anchored-and-floating-panels.md)。
