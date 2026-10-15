# 应用导航与浏览器记忆（T20）

Gitea #21 / 父#1故事61/63/64，承接T02、T04/T05与T14。只实现现有真实路由的应用壳，不新增认证入口、业务API/SQL或用户方向/主题切换。

## 配置与项目隔离

`navigation`沿用orientation（vertical默认/horizontal）、initialExpanded（默认true）、allowCollapse（默认true）；新增公开projectKey（默认templux，非空、至多100字符）。旧文件只缺projectKey补默认，不重写文件；显式空/错误类型、方向、未知字段拒绝。配置由共享校验器和启动快照载入，修改已有值后重启API/Web并刷新页面，无需重建；新增代码仍需构建。现用presentation不由此功能写入。

允许切换时在当前origin的localStorage保存：键为`templux:nav:v1:`加encodeURIComponent(JSON.stringify([projectKey, project.name, verifiedAccount.id]))，值仅`{version:1,expanded:boolean}`。真实账号ID来自正常后端profile，人员/Agent使用同一规则；不使用显示名、角色、token、密码或cookie作键/值。复制项目若共用origin及名称，必须配置不同projectKey；名称或projectKey改变会使用新命名空间，不迁移旧偏好。跨origin自然隔离，不承诺跨设备同步。

无记录、坏值/错误版本或读取被拒时使用项目初始值；写入被拒仍可本页内存切换。allowCollapse=false不读/写旧记录且不显示切换按钮，始终服从项目值。实例捕获配置快照；服务端新配置/账号身份改变时重建客户端壳，不沿用前账号store。SSR输出该账号的项目默认，layout hydration只读自己的键；不从浏览器猜测身份，不借用旧账号偏好，可能存在项目默认到已记忆状态的呈现变化，不承诺所有浏览器零布局变化。

同origin其它标签页的同键storage事件同步；删除、clear或坏值回到默认，不写回造成循环。无关项目/账号事件忽略。退出/切账号销毁当前活动实例与抽屉，但保留非敏感偏好以便同账号重登恢复；清理浏览器站点数据可删除。存储通知只改变呈现，不能授权或延长会话。

## 真实路由和应用骨架

服务器只有在profile验证成功后才将账号传入ProjectShell；公开首页、登录和不可用页保留公共壳，不依据cookie存在与否猜测已登录身份。账号/受保护/管理员/审计/示例页使用ApplicationShell，并由同一个EditNavigationProvider包裹导航及实际内容。示例不再创建隔离的嵌套守卫。公共模块不导入examples，移除示例仍按T10合同。

| 菜单 | 可见条件（正常已验证profile） | 目的页 |
| --- | --- | --- |
| 我的账号 | 全部账号状态 | /account |
| 工作区 | active + application:read | /protected |
| 账号管理 | active + accounts:manage | /admin |
| 操作审计 | active + audit:read | /audit |
| 控件示例 | active + application:read + 项目环境开关 | /examples |

Pending/零角色没有业务菜单，Agent不另设授权路径；项目扩展角色按实际permissions并集决定。隐藏菜单不代替页面与API独立授权，直接访问仍执行原后端检查。路由集合/标签/图标由应用骨架明确维护，不将任意URL从localStorage或未经验证输入装进导航。

## 桌面与窄屏

桌面>760px默认240px纵向文字栏，收起76px；横向为可换行导航行，同样可按项目初始值/允许开关显示图标。当前项aria-current=page和强调边线；每项有显式名称、非朗读SVG，图标模式鼠标悬停或键盘focus-visible显示文本提示。所有操作≥44px，有跳到内容入口。页头显示当前账号与人员/Agent类型，当前/全部退出始终可达。header.visible/showBrand决定品牌/说明呈现，不移除已登录必需的菜单/账号/退出；footer保持项目设置。沿用四主题设计变量，无个人主题/方向切换。

≤760px无永久侧栏/图标占宽，菜单按钮打开文字侧抽屉；展开偏好不被移动开关覆盖。抽屉是原生modal dialog（不同于T19非模态面板），有标题、关闭、完整菜单、当前账号和两种退出。打开聚焦关闭控件，Tab/ShiftTab在可用控件首尾循环，背景由showModal变为inert，body overflow锁定并保留原值。Escape、关闭按钮或合格遮罩轻触关闭。遮罩轻触必须是同一主指/主键在真实遮罩区域按下、抬起及click，累计过程中距起点不超过5 CSS px；拖出再返回也作废。内侧与遮罩跨越、拖动、取消、活动期间丢失capture或任意第二触点都不关闭，多指须全部结束后才接受新手势。触屏正常pointerup之后的隐式capture释放不取消已完成轻触；仅click共同祖先相同或键盘生成click不足以关闭。只消费一次合格click，不向底层转发。关闭返回仍存在的菜单按钮，不改变草稿；桌面断点、卸载和会话ending释放锁/旧抽屉并清空指针集合、候选及已完成记录，window blur同样取消未完成手势。

选其它目的页使用EditLink；dirty先确认，取消保持原草稿和抽屉，保存blocked不导航/不确认。抽屉直到pathname实际提交才关闭，不在点击或onNavigate尚未通过守卫时提前关闭；网络未完成/取消期间不假称已到达。抽屉当前项按钮只关闭菜单、不重新导航或清空当前query。项目自定义消费者仍遵守T14：onClick/onNavigate同步取消先于守卫；命令式router必须经requestLeave，未经接入的浏览器历史遍历不承诺可取消。没有history哨兵/回滚或异步补跳。

两种主动退出先经同一requestLeave：dirty明确放弃、保存中拒绝且不发logout请求，再调用真实当前/全部退出API。失败显示局部错误，不假报退出；不会因为菜单隐藏授予管理权限。强制401/endSession优先触发session-ending并完整回登录，清空抽屉/释放滚动，不受dirty或保存锁阻挡；403/网络仍按T05保留页面。

## 消费者与平台边界

路由/数据变化以项目服务端最终授权和版本为准，偏好不是身份或业务数据。壳内编辑器须使用现有公共编辑状态注册，不能仅靠输入框存在猜dirty。配置热更新、跨设备偏好、任意第三方路由拦截、多层窗口系统不在此票。

测试覆盖正常人员/Agent密码、真实SQL/CLI撤权、跨标签、配置重启及实际键鼠/CDP触控；工具fixture只挂测试容器且正式镜像404。Chromium仿真不等于所有读屏/物理触屏或浏览器；原生dialog按Next支持的现代浏览器使用。四主题/横纵/桌面窄屏真实截图及精确源码点见[T20验收](../discovery/t20-acceptance.md)。T03真人飞书组织验收仍另列未完成。
