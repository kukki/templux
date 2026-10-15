# 锚定浮层与单个非模态面板

T19 / Gitea #20，父规格 #1 story91。辅助浮层和独立面板是两种元素，不替代通知、图片预览或模态编辑。共享实现位于 `components/elements`、`shared/overlays.mjs`，不依赖 examples；无业务 API、表或身份模拟入口。

## 锚定辅助浮层

`AnchoredPopover`要求稳定 identity、操作 label、可见 title 和项目内容。默认宽320，配置范围160–800。使用原生 auto Popover 及 invoker，语义是含交互内容的非模态 dialog，不是 tooltip。触发后焦点留在按钮，Tab按原生invoker次序进入；Escape/关闭返回仍存在、可聚焦的触发控件。外部点击轻关闭并保留外部操作；不圈禁焦点、不使页面 inert。辅助内容可含链接/轻操作；需要保存和dirty判断的编辑应接入面板，不放未登记的表单。

按当前锚点及实际内容测量定位，间距8px、视口边距12px，下方不足向上翻转，水平夹紧，过高时正文内部滚动。监听窗口/容器滚动、尺寸、VisualViewport和内容变化；锚点离开视口或被滚动祖先完全裁切时关闭。异步观察器失效后不得重新定位旧元素。identity更换重建旧浮层；不对新目标强行恢复旧焦点。浏览器无原生Popover API时入口禁用并提供本地解释，不模拟部分可用的弹层。

## 单个独立面板

在 `EditNavigationProvider` 内、采用项目适当的路由/授权作用域放置一次 `FloatingPanelProvider`；多个触发控件使用 `useFloatingPanel()`。不得用多个Provider建立多窗口层级系统。

`open({id,title,content}, origin?)`：稳定ID应包含项目需要区分的目标/版本。同ID聚焦现有面板、保留草稿和内容；新ID先通过当前关闭边界，接受才替换。描述在本次打开期间固定；外部数据刷新不得悄悄重建编辑基线。`close()`和Escape走相同判定；Escape仅从面板内部冒泡处理。内容使用 `content({requestClose,registerClose})`：

```tsx
<EditSession registerClose={registerClose} manageFocus={false}
  onClose={requestClose} /* 其余真实校验、保存、核验合同 */ />
```

`registerClose`接受公共 `CloseBoundary`（request/getSnapshot/subscribe），将dirty取舍和blocked状态交由现有编辑器。回调同步且只在接受后执行；过期epoch的清理不可移除新面板边界。保存中UI和API均拒绝关闭、替换和重复提交；失败解锁，超时解除等待但结果未确认，明确核验且不自动重试。继续遵守[T15](row-and-dialog-editing.md)的晚返回/receipt/新编辑规则。未登记边界的普通内容直接关闭；消费者有责任为可编辑内容登记。

面板为 `role=dialog, aria-modal=false`，无遮罩。打开聚焦标题，Tab可离开，页面仍可操作。实际关闭且焦点仍在面板内才返回仍可用的origin；替换、已移到页面的焦点、强制会话结束均不抢回旧焦点。面板拥有焦点时对子EditSession设置manageFocus=false；其默认true继续用于既有行/模态消费者。

## 几何、指针与窄屏

桌面默认420×360，可配置宽280–1200、高180–1200、draggable/resizable。名义最小280×180、视口边距12px；更小视口以可达性为先。标题拖动、右下角调整；键盘独立移动/调整按钮方向键10px、Shift40px、Home恢复默认。调整固定左上角，仅允许增长到视口右/下边界。关闭按钮保留在标题内，长标题独立滚动。

整个面板capture阶段统一记录触点，正文/工具栏第二或nonprimary触点取消首个拖动；全部抬起前不能重启。pointercancel、lostcapture、外部up、视口/断点/目标更换、卸载、ending清理旧手势和capture。拖动或多指后的兼容click被抑制，新主动单指手势恢复。桌面可滚动标题禁用原生触摸手势，避免浏览器接管拖动；窄屏恢复默认原生行为。没有捏合缩放。

可见视口宽≤640时改为底部非模态面板，无自由拖动/调整入口，最大60%可见高度（有空间时最少64px），正文内部滚动，页面未覆盖区域仍可交互。使用VisualViewport offset/size及resize/scroll，缺API回退布局视口。Provider仅在内存保留一个非敏感桌面首选矩形，不记目标历史/存storage；临时缩小/窄屏的派生夹紧不覆盖首选值，恢复桌面可继续使用。授权作用域卸载/ending清空。

## 配置与真实消费者

`elements.popover:{width:320}`、`elements.panel:{width:420,height:360,draggable:true,resizable:true}`。旧文件缺整分支补默认；显式空、部分/未知字段、错误类型、越界拒绝。启动配置快照，重启读取；本票不改现用presentation。

强制401/session-ending优先移除所有浮层/面板、清理等待与旧内容，不受dirty或保存锁阻挡。403和网络故障不冒充身份失效；真实写操作无法确认结果时映射unconfirmed。项目必须使用正常sessionFetch/endSession，最终服务端授权、目标版本校验和持久操作核验独立有效，界面可见性或ID不是权限。

/examples使用独立内存合成信息及A/B编辑面板，正常/字段/表单/403/网络、4秒等待、1秒超时而3秒后可核验；刷新重置，无自动保存或产品后端。硬件软键盘、不同浏览器Popover/辅助技术和后台调度需目标平台验收；可见视口缩小仿真不等同真实输入法键盘。证据见[T19验收](../discovery/t19-acceptance.md)。
