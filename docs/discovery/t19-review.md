# T19 独立审查：锚定浮层与非模态面板生命周期

2026-10-15；固定范围 `684504c3aa19350b2e921dad651420abcb4c2b9e..d2def352ce25c4b039e45ca1c806569515a85ad1`，开始HEAD为上界且工作区干净。同一审查者依次Standards/Spec，不新增成员。读取Gitea #20、既读父#1故事91、ADR0012/0013/0020、仓库规范、面板合同/计划/验收及全部26文件差异。

按code-review、codebase-memory与完成前验证流程；graph search→trace→snippet核对Provider到控制器及视口。26改动路径和另依赖的edit-navigation/use-editor共28路径coverage均metadata_match/无报告缺口，best-effort不证明完备，源码另直接读取。Context7 `/mdn/content`核对auto Popover轻关闭、嵌套、invoker焦点顺序及VisualViewport布局偏移/resize/scroll，沿用已核对Pointer/capture语义。用ego-browser独立真实组件，额外共享生命周期交错按systematic-debugging定位，不改实现。

## Standards

**0项发现。** 纯几何/单实例控制器、浏览器观察器和React视图分离；CloseBoundary复用现有编辑保护，manageFocus默认true保留原调用方式。通用模块不依赖examples，文案集中，独立内存示例与版本化工具fixture分开，无产品API/SQL、通知外发、照片/业务数据或多窗口层级系统。未发现需单列的规范违反或有明确收益的smell，以下行为缺口归Spec。

## Spec

**1项F1/P2；建议修复注册隔离后定向复核，再按#20验收。** 不是后端授权缺陷，也未声称正常示例已经丢失数据。

### F1（P2）：旧边界清理仅比较source身份，能移除新代次复用的保存保护

- **定位**：`shared/overlays.mjs:22`的registerClose订阅和返回cleanup只检查`boundary===source`。入口检查expectedEpoch，但异步/迟到清理没有绑定该次epoch或唯一注册token。
- **合同**：面板合同要求“过期epoch的清理不可移除新面板边界”；计划同样要求cleanup token不能清除新目标guard。公共CloseBoundary没有禁止稳定对象跨代次重新注册。
- **独立复现**：打开A、注册稳定source并保存cleanupA；source未blocked时合法替换到B（旧订阅已release）；同一source在B当前epoch重新注册且blocked=true。此时close返回false。之后调用迟到cleanupA，source引用相等使其release **B的新注册**，snapshot.blocked由true变false；再次close返回true、B消失，source.request计数仍为1（只有先前合法替换调用，最后关闭完全绕过边界）。
- **证据**：真实checks依赖/最终shared挂载容器执行，`test-results/t19-independent-reused-boundary.json`记录A epoch1、B epoch2与前后close/blocked/request计数。可复跑脚本`t19-reused-boundary-repro.mjs`，`docker exec -i <组件容器> node --input-type=module < test-results/t19-reused-boundary-repro.mjs`按正确期望“旧cleanup不能移除当前锁”断言失败/退出1，见`t19-independent-reused-boundary-red.log`。没有SQL或模拟权限数据。
- **触发范围**：共享控制器的自定义稳定boundary跨面板代次复用、旧拥有者延后清理；这与React effect使用稳定适配对象并非互斥。现有EditSession每次注册新包装对象，因此当前16组件正例不触发，不能用它们证明公共注册合同成立。现有unit的旧cleanup测试也使用两个不同source对象，漏掉同对象重新注册。
- **影响**：保存中关闭/替换保护可被旧清理拆掉，dirty确认也随边界消失。后端写不能因此撤回；此处是界面生命周期与关闭保护风险，不是角色权限提升。
- **建议**：每次注册分配唯一registration token，订阅回调/cleanup仅能作用于该token且匹配epoch的当前注册；让重复旧cleanup幂等，不能释放新订阅。补同source跨epoch复用、不同source原对照、blocked与dirty拒绝、旧订阅回调及invalidate/end后的迟到清理回归。不要仅要求消费者“每次新建对象”来收窄已承诺隔离。

## 其它已核对行为

- 锚定辅助内容为原生auto Popover，invoker/Tab/Escape/外部轻关闭与独立面板不同；滚动20px跟随、上下翻转、水平夹紧，完全祖先裁切关闭。active标记/observer断开/取消帧阻止旧定位。API缺失明确disabled及局部解释，受控缺API测试不冒充不支持平台实机。
- Provider单currentId/epoch，同ID保留草稿，新ID先同步调用边界。现成EditSession接入dirty请求/blocked订阅，保存期间UI/API关闭替换与重复提交均拒绝；超时解锁但不假成功，明确核验推进基线且保留新编辑。普通行/模态/表单既有默认焦点分支保持，外部面板manageFocus=false防旧子卸载抢焦点。
- 面板无遮罩、aria-modal=false，页面可交互/Tab可离开；仅实际关闭且焦点仍属面板才返回origin，替换/页面焦点/ending不强抢。内部浮层Escape不关闭外层面板。
- 桌面键盘/鼠标拖与resize有效，最小尺寸及视口限制，resize不移动左上角；仅一个内存首选rect，窄屏/缩小派生夹紧不覆盖桌面偏好。≤640窄屏底部无自由手柄、最多60%可见高度，页面未覆盖区可用、正文可滚；VisualViewport偏移与尺寸变化受合同约束，模拟缩小不是物理软键盘验收。
- 整面板capture登记指针，标题+正文/resize+关闭工具的第二触点取消并等全释放，抑制兼容click；pointercancel/lostcapture/viewport/epoch更换拒旧移动，新手势恢复。桌面标题touch-action:none、窄屏恢复auto；本轮新容器从启动即挂最终CSS，没有依赖热缓存的旧样式结果。
- 新popover/panel配置整分支缺省兼容，显式partial/null/unknown/类型/越界严格拒绝，固定pre-T19基线真实加载与CLI不改写通过；启动快照/重启合同保持。强制session-ending移除所有面板/浮层和旧编辑等待，不受保存锁阻挡；403/网络为业务结果不冒充401。

## 本次独立实际验证

复用现有checks镜像，独立组件容器`t19-review-components`只读挂最终elements/shared及版本化fixture，API内部指向本机端口1，无身份/DB。HTTP200后Ego69读取真实DOM，再执行版本化popoverAndLayout、panelEditing、panelPointers。

| 命令/证据（test-results/） | 实际结果 |
| --- | --- |
| checks `node --test --test-concurrency=1 tests/overlays.test.mjs tests/editor.test.mjs tests/editor-deadline.test.mjs tests/presentation.test.mjs tests/image-preview.test.mjs` | **58/58，失败/取消/跳过0**；t19-independent-targeted.log |
| checks `npm run typecheck` | API/Web退出0；t19-independent-typecheck.log |
| 实际组件容器Web workspace typecheck | 含fixture退出0；t19-independent-fixture-typecheck.log |
| controller/Popover/panel/EditSession/CSS/presentation宿主与容器SHA256 | 相同，diff退出0；t19-independent-{source,container}-hashes.log；controller/panel另docker cp后cmp逐字节退出0 |
| 真实组件布局/编辑/指针 | **8+4+4=16组通过**；t19-independent-{layout,editing,pointers}.json |
| 额外稳定boundary复用/旧cleanup | 发现F1；上述JSON与正确期望RED日志 |

16组观察真实DOM几何、原生confirm接受/拒绝与鼠标/键盘/CDP Pointer Events，不以DOM.click模拟拖动或保存。覆盖窄屏滚动、非模态页面计数、保存锁/超时核验/ending、跨正文工具多指及capture/viewport/epoch清理。可控save只在工具fixture，不声称远端取消、真实SQL持久化或业务写授权。

## 开发证据、清理与限制

核对开发正常密码user/schema0008、保护API200、真实CLI撤权时仍saving、随后401/reason=authorization_changed、面板/浮层/字段0及宿主Date计时约114ms；本次独立无SQL/身份/凭据，不冒充重复该链路。最终source hashes、fixture404、68公开证据文件秘密匹配0已核对。240全套为observer active及touch-action修正前历史点，最终58/16与其分开；没有重跑240/生产构建或无关矩阵。

本票截图CDP失败，**没有成功截图/像素验收结论**，仅实际DOM几何和操作。开发早期配置/裁切/resize原点/touch-action RED与最终记录保留，不将工具定位/未就绪尝试或旧失败当作最终产品错误，也不据已通过正例排除F1组合缺口。

Ego69已finish({keep:[]})一次，自有组件容器删除。t19-independent-cleanup.log仅原三服务healthy，original-status.json为ready/connected/schema0004。无迁移、原部署重启、.env/现用presentation/Ego31/真人/飞书变更，仅本地审查文档提交，未push/关闭#20。

Chromium/CDP视口和触控不代表物理触屏、真实输入法/软键盘、全OS/读屏或后台调度；原生Popover支持需项目平台验证，服务端最终授权/版本及持久保存核验始终归项目。T03真实飞书组织人工验收仍另列未完成。当前建议先修F1，再独立定向验收。

## F1 注册归属定向复核附录（2026-10-15）

固定范围 `a8f4bcf76ab0d6246fd0c0f5398792956658c902..3147ae0ed8ea4c8744a01769e68eaa4ac84e48ca`；开始HEAD为上界且工作区干净。读取全部5文件差异、修复验收和合同补充，保留初审历史。同一审查者依次双轴：**Standards 0新增；Spec F1/P2关闭，0新增。结合初审及本次复核，建议T19按#20验收。**

### 修复核对

`shared/overlays.mjs:22`为每次registerClose创建唯一token，订阅回调/cleanup同时检查token、expectedEpoch和未ended；不再将稳定source身份等同注册身份。`:16`先清registration/boundary再执行退订，旧退订同步通知不再发布；subscribe同步通知使owner失效时，返回的退订函数立即执行，当前cleanup幂等。仍拒绝第二个未清理的活动边界，dirty/request/blocked及公共接口不变。新增合同明确稳定对象可跨epoch或在同epoch清理后重注册，没有要求消费者换对象规避。

独立使用初审原`t19-reused-boundary-repro.mjs`、正确断言不改，最终控制器下退出0。新5项实际执行覆盖同source跨epoch、同epoch重注册、不同source对照、invalidate/end与退订同步通知、subscribe同步通知引发owner失效。检查snapshot对象身份/通知次数、旧callback/重复cleanup不生效、当前解除锁后request真正执行、退订恰一次；不是只把blocked手动改回或仅检查不抛异常。

### 独立命令与实际组件

复用旧templux-checks，**最终shared/tests只读挂载**；不是新生产镜像，也不声称旧镜像本身含修复。自有组件容器另挂最终elements与版本化fixture，TEMPLUX_CONFIG_PATH指向共享默认文件、API指向本机端口1，无DB/凭据；从启动即使用最终源码，无CSS热缓存变化。controller/panel/EditSession宿主与容器SHA256一致，controller另docker cp后cmp逐字节退出0，见`t19-fix-independent-{source,container}-hashes.log`。

| 独立执行/证据（test-results/） | 实际结果 |
| --- | --- |
| 原初审可复跑脚本，最终shared挂载 | **退出0**；t19-fix-independent-original-green.log（无断言错误输出） |
| `docker run --rm -v "$PWD/shared:/opt/templux/shared:ro" -v "$PWD/tests:/opt/templux/tests:ro" templux-checks node --test --test-concurrency=1 tests/overlays.test.mjs tests/editor.test.mjs tests/editor-deadline.test.mjs tests/presentation.test.mjs tests/image-preview.test.mjs` | **63/63，失败/取消/跳过0**；t19-fix-independent-targeted.log |
| 同最终shared挂载checks `npm run typecheck` | API/Web退出0；t19-fix-independent-typecheck.log |
| 自有组件容器Web workspace typecheck | 含fixture退出0；t19-fix-independent-fixture-typecheck.log |
| 版本化panelEditing | **4组通过**；t19-fix-independent-editing.json |
| 版本化panelPointers | **4组通过**；t19-fix-independent-pointers.json |

Ego71在HTTP200并观察DOM后运行两组入口，真实原生dirty确认接受/拒绝、保存锁UI/API/Escape/重复提交、字段错误解锁、超时未知/明确核验/新草稿、ending拒晚commit；指针覆盖标题+正文/resize+关闭工具多指、取消/capture丢失、视口/epoch与新手势恢复，以及受控API不支持提示。共8组件全部退出0；可控save不是真实远端写。布局与锚定/视口算法未改，沿用初审独立8布局，不重复无关矩阵。

graph search→trace→snippet核对registerClose归属逻辑，9依赖路径coverage metadata_match/无报告缺口，best-effort不证明完备；动态图未列caller不推断无消费者，另直接读Provider/编辑器接入。Context7 React官方useSyncExternalStore文档确认subscribe返回对应cleanup、无变更快照须稳定；本次token隔离来自项目合同与实际交错验证，不把React文档误称为token实现要求。

已核对开发原脚本RED→GREEN、新5项基线4失败/不同source对照原本通过及最终63/8记录。准备脚本/配置路径与未完整结束的工具调用不当作最终行为失败或通过；本次独立上述执行均完整返回。未重跑240、SQL/正常密码/CLI撤权、生产构建或截图，原240及初审开发身份/114ms证据保留原源码与执行范围。

### 清理、验收与局限

Ego71已finish({keep:[]})一次，自有t19-fix-review-components已删除；t19-fix-independent-cleanup.log仅原三服务healthy，original-status.json为ready/connected/schema0004。无新数据库/凭据、原部署迁移或重启；.env/实际presentation/Ego31/真人/飞书均未动，只追加本审查文档，未push/关票。

当前无剩余本票发现。组件/单调代次与Chromium触控协议不保证物理手机、真实软键盘、全部浏览器/读屏/后台调度；本次未产生截图或像素验收。旧工具镜像不会因挂载测试自动升级原服务；真实项目仍须后端最终授权/目标版本与保存核验。T03真实组织人工验收继续另列未完成。
