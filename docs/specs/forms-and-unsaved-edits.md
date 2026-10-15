# 普通表单、编辑状态与离开保护

T14 / 工单 #15，父规格故事79–80；沿用 ADR0012、0020及 session-lifecycle.md。不改变统一搜索、多选列表、分页的状态合同。

## 采用方式

`shared/editor.mjs` 的 `createEditor` 是字符串字段编辑合同；React 消费者通过 `useEditor` 接入同一控制器。字段名、初始值、纯 `normalize`、纯 `validate`、失败文案由项目明确提供，固定到本次挂载。新实体用不同 React key 或显式 `reset(newBaseline)`；不在 props 更新时悄悄覆盖输入。字符串之外的值由项目先显式映射，不能把认证/授权当字段校验。

`FormField` 持续显示控件上方名称，render prop 将 id、aria-invalid、aria-describedby 交给实际 input/select/textarea；hint和错误位于该字段旁。消费者连接 change/blur，表单使用 noValidate 并在 submit 调用控制器，避免原生校验提前挡住“全部字段校验”。客户端不是最终权威；真实消费者必须在服务端重新验证字段、权限及写入规则。

- 初始不显示错误；blur校验该字段；submit校验全部，不通过不调用保存。
- 有错误字段修改即复查；字段错误就近，其它错误放 formError。表单错误在下次修改/提交时清除。
- normalize是项目政策（示例只trim名称和备注），dirty比较规范化当前值与最后确认保存的基线；还原相同值即clean，不依赖触碰次数。没有自动保存。
- `reset()`还原当前保存基线；`reset(values)`明确替换基线；刷新/重置整个内存示例恢复初始合成数据。

## 保存与异步边界

`submit(save)`将规范化不可变快照和AbortSignal交给消费者；重复submit在saving期间不调用save。仍允许编辑。返回合同：

| kind | 结果 |
| --- | --- |
| saved + values | 服务端明确已保存的完整规范值；推进基线 |
| fields + errors | 可归属字段的错误；不改变基线 |
| error / forbidden + message | 表单错误；不改变基线及权限 |
| ended | 已由统一会话流程启动退出，不显示成功 |

未在等待期间编辑时，成功用确认值规范当前输入；有新编辑时保持当前值，只推进保存快照基线。因此旧响应不能覆盖新输入或将仍dirty的状态报成saved。成功返回只复查当前已经显示错误的字段，不清掉较新输入的有效错误，也不让尚未暴露的其它字段提前报错。返回字段错误只附到仍与提交值相同且没有当前本地错误的字段，并与当前已经显示、复查后仍有效的错误合并；新值不会承受旧值错误。reset、cancel、销毁和session-ending会abort并使旧响应代次失效，即使传输忽略abort也不能改变控制器。卸载后不保存到本地存储或恢复草稿。

保存期间的外部写入由消费者管理：AbortSignal不保证服务器取消写入，不能自动重试结果不明的写操作。消费者不得在控制器接受结果之前用晚返回覆盖其它实体或当前编辑；示例延迟保存遵守signal。失败保留输入；未改变初始内容就尝试失败时，dirty仍为false，失败本身不制造修改。

真实HTTP消费者使用现有 `sessionFetch`，让明确401及失效原因进入 `endSession` 后返回ended。403映射forbidden，网络/响应读取异常映射error，字段校验响应按经过验证的字段映射fields；不能将403或网络故障当401退出，也不能将401当可继续保存的业务错误。错误文案不能直接转发异常堆栈/机密响应。

## 导航接入与平台支持

编辑路由将 `EditNavigationProvider` 放在整个页面壳之外。`useEditor`注册控制器；未来弹窗/面板可使用相同controller和 `requestLeave(action)`，不依赖示例。一次离开只确认一次；取消保留当前编辑，确认放弃会reset所有注册编辑后执行action。

- Provider在document冒泡阶段处理普通a主键同窗点击，先尊重消费者preventDefault；原生链接必须保留事件冒泡才能使用该兜底。Next客户端导航须采用EditLink，不能依赖document监听拦住普通Next Link已经发起的SPA导航。Ctrl/Command/Shift新窗口、下载及仅hash导航不离开当前编辑，不提醒。点击真正离开时使用浏览器确认框，明确“放弃”与“取消保留”。
- `EditLink`使用Next受支持的onNavigate，从onClick读取真实呈现锚点的解析后href，与原生兜底共用同一路由/search判断；相对hash、完整同页hash及对象形式hash均不确认或reset草稿。消费者onClick执行一次，先于确认；消费者onNavigate也先获得同步取消机会。消费者须在回调返回前preventDefault，异步决定不能推迟Next已发起的导航。取消导航不确认、不reset；真正路由/search离开才统一确认一次。Next已preventDefault的SPA点击不会被document兜底重复处理；外部replace在Next跳转前单独遵守相同规则。命令式 `router.push/replace/back/forward`须显式包在 `requestLeave(()=>router.…())`。不能从其它模块直接调用router并假定全局拦截。
- 原生刷新、关闭、跨文档back/forward使用dirty期间才注册的beforeunload。浏览器只在其允许且有用户交互的条件下显示通用原生提示，不能指定文案或保证手机杀进程时弹出。
- **App Router没有通用可取消的popstate守卫**。本合同不保证未经接入的同文档浏览器工具栏back/forward；需要可靠离开保护的编辑入口应使用普通文档导航，或提供上述已接入的back/forward按钮。不得用历史哨兵、pushState复制记录、异步回滚URL伪造取消。本票示例提供普通返回锚点、EditLink及命令式路由消费者，隔离组件验证受控back/forward。
- 列表search/filter/pagination不注册编辑状态；纯replaceState偏好更新不触发离开保护。

强制失效优先：守卫检查sessionIsEnding，监听templux:session-ending取消保存并释放beforeunload；既有session捕获守卫优先。任何新导航消费者也必须遵守该合同，不能用未保存弹框保留失效访问。客户端释放不替代服务端每请求检查。

## 示例与配置

受保护 `/examples` 演示正常、字段错误、表单错误、403、网络故障与延迟保存；数据仅页面内存，不产生示例业务API或SQL表。读取/编辑示例不赋予任何管理权限。布局/文案采用项目品牌变量与集中copy配置；校验、规范化、确认政策由组件公开参数/项目接入实现，不新增强制全局呈现键。旧呈现快照兼容性不变。
