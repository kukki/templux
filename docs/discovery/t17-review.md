# T17 独立审查：图片预览、备选源与触屏关闭

2026-10-15；固定范围 `3a749e9e847879c8017a3b1268678f14c23281c6..ede442942b08a8df47a96ccdc5ef6a3e696cb79e`，开始HEAD为上界且工作区干净。同一独立审查者按Team权限依次Standards/Spec，不新增成员。读取Gitea #18/#1、ADR0012/0013/0020、仓库issue-tracker及网页元素历史、图片合同/计划/验收，检查全部23文件差异。

使用code-review与codebase-memory；结构search→trace→snippet核对PreviewSession与控制器。23路径coverage中19条metadata_match，4个SVG/损坏样本因ignored-suffix excluded，已直接读取全部4文件；其它源/声明/样式/测试/配置亦直接读取。coverage为best-effort，不代表穷尽调用关系。沿用React订阅/清理知识，补查Context7 `/mdn/content` Pointer Events官方isPrimary、capture/cancel及兼容鼠标语义，参考React最佳实践稳定订阅条目；异常按systematic-debugging核对输入→规范化→浏览器解析，以及cancel→idle→React启动条件，未修改实现。

## Standards

**0项独立发现。** 通用源策略/状态/几何与React DOM/native loader分离，示例显式传项目描述，公共模块不依赖examples。文案集中、纯文本alt、合成SVG，无新增产品API/SQL/业务照片、认证fixture或外发通道。配置缺省兼容和显式严格校验沿用现有加载机制。未发现需要单列的仓库规范违反或有明确收益的smell；以下实际行为问题归Spec，不跨轴重复计数。

## Spec

**3项发现：F1/P2、F2/P2、F3/P3。建议修复并定向复核后按#18验收。** 已通过的55专项/7组件不能覆盖下面的输入与生命周期组合。

### F1（P2）：本地源规范化产生协议相对地址，绕过根路径/HTTPS边界

- **定位**：`shared/image-preview.mjs:5`。只在规范化前检查`/`且非`//`，随后将URL的pathname/search/hash拼回一个新的相对字符串，没有重新确认输出的解析含义。
- **复现**：传源`/a/..//localhost:31043/examples/image-a.svg`或`/%2e%2e//localhost:31043/examples/image-a.svg`，均被接受并输出`//localhost:31043/examples/image-a.svg`。从页面`http://127.0.0.1:31043`解析后成为`http://localhost:31043/...`，已跨origin且为HTTP。正常`/examples/image-a.svg`仍是原origin，显式HTTPS对照正常。
- **实际证据**：容器真实prepareImageGroup输出见`test-results/t17-independent-source-policy.json`；Ego61中native Image读取规范化输出，decode成功/naturalWidth1200，src为`http://localhost:31043/...`，见`t17-independent-pointer-and-url.json`。仅访问自有本地合成资产，没有向外部主机发送复现请求。
- **影响/合同**：图片合同“本地根路径（不是//）或无凭据HTTPS”不成立；项目以本地路径提供的值可被组件转换成任意协议相对主机，HTTP部署时还绕过拒绝HTTP规则。这是浏览器图片源策略问题，**不是服务端SSRF、身份权限提升或已证明的凭据泄漏**；HTTPS外部源仍须项目自行治理。
- **建议**：校验最终交给Image/img的规范化结果，保证本地分支重新解析仍保持本地origin且不变成`//`；对规范化后双斜杠及编码dot-segment做明确拒绝/安全保留。加入正常根路径/重复去重/显式HTTPS与上述两种绕过对照，不只测试原始字符串以`//`开头。

### F2（P2）：初始图备选加载时关闭，使预览永久停在不可访问的idle

- **定位**：`shared/image-preview.mjs:22`的cancel及`:32`close；`apps/web/app/components/elements/image-preview.tsx:13`仅挂载时start、`:20`ready外禁用opener、`:21`仅loading渲染ResourceLoad。
- **复现**：原A已ready并打开；实际显示img触发error（允许的“显示后失败”路径），控制器进入A的backup loading；在该候选完成前点击关闭。close把初始图改idle/清src/换token，loader被abort；React启动effect依赖store/initial.id均不变，不再start。opener仍disabled，文本一直“正在读取图片”，没有显式再访问入口。
- **实际证据**：Ego61真实React/native dialog与版本化可控loader，向真实显示img派发资源error，观察backup请求后关闭；`test-results/t17-independent-close-fallback.json`记录关闭前loading、关闭后全部请求aborted、晚ready后入口仍disabled且请求数不增。StrictMode初次请求基数与重复effect已保留，没有把初始重复调用误作新重试。迟到结果隔离本身正确，问题是后续合法恢复路径断开。
- **影响/合同**：未全失败却永久占位，必须刷新/改变描述/卸载才恢复；违反“关闭中止等待并保留候选位置，明确再访问可恢复尚未完成候选”。普通B/C切换正例因A仍ready可重新打开，不能覆盖初始图自身进入备选的情形。
- **建议**：协调缩略图初始资源与弹窗取消责任，使关闭后的初始图可继续同一个未完成候选，或提供合同明确的显式恢复入口；不能重试已经失败候选，也不能接受已取消token。补初始A显示后失败→backup挂起→按钮/Escape/遮罩关闭→恢复的真实组件回归，保持晚结果隔离与全失败终态。

### F3（P3）：第二触点没有取消已有拖动，双指期间仍移动图片

- **定位**：`apps/web/app/components/elements/image-preview.tsx:25`发现drag.current便直接return，`:26`仍接受原pointer移动；没有跟踪多触点或第二指进入时取消/释放已有拖动。
- **复现/证据**：Ego61 CDP真实两触点，4×图内首指拖动后panX120；第二指pointerdown（isPrimary:false）到达同stage，随后首指再移80px，panX变200。无pointercancel、图片仍开；`test-results/t17-independent-multipointer.json`保留真实pointerdown/move ID与主指标记。先等待两帧再采样，避免把未派发的合并move当作已经取消。
- **合同边界**：任务明确要求核对“多指取消”，图片合同/计划仅承诺单触点拖动且不提供捏合。目前行为是忽略第二指、继续首指平移，尚未实现该取消边界；没有声称错误缩放/越界或意外关闭。
- **建议**：在第二有效触点进入时取消既有drag并释放capture，明确剩余触点全部结束前是否禁止重新启动；补第二指按下→主指继续移/抬起、pointercancel/lostcapture对照。不能只加isPrimary检查便宣称取消已存在主指手势。同步明确本地合同的多指规则。

## 其它已核对行为

- 默认单图fit、小图不放大；显式图库需唯一稳定ID/列表与一致初始项，位置不循环、切图归fit；每图候选独立、全失败保持当前图、不把下一图当备选，无默认手动重试。
- 每尝试token与active/AbortSignal隔离，native loader decode后检验尺寸，complete不能独立表示成功；关闭/切图/源代次/卸载/会话结束的晚结果不复活旧DOM。缓存仅实例内，描述/settings内容变化key替换，规范化内容相同不重置，load适配器每实例冻结。
- 最终触屏遮罩在匹配down/up/位置后由click取消默认并stopPropagation再close；原生modal焦点、单触控关闭后仍可用opener恢复和底层探针0点击独立通过。不是pointerup先关再靠定时器补焦点。点图/拖动不关；会话结束关闭/清源不回旧焦点。
- 缩放中心比例/上限、溢出轴clamp、resize/切图归fit、小图与不溢出轴不平移，按钮/键盘和单指拖动均有控制器或实际组件/开发证据；F3为多指交错补充。
- `elements.images`整个缺分支补false/4，显式不完整/null/非法类型/未知/maxScale越界拒绝；真实CLI不改配置，公共默认与项目显式覆盖分离，沿用启动快照/重启生效。现用presentation未改。
- native img error不猜401；业务受保护图片须项目load适配器接既有sessionFetch及真实后端权限，403/网络不作身份失效。合成公开资产不代表业务照片准入策略。没有要求新增图片API/代理/SQL或跨账号缓存。

## 独立执行与证据范围

复用当前checks镜像，不构建/改原服务；自有`t17-review-components`只挂版本化fixture及自有开发来源配置，API指向本机端口1，不提供测试身份。HTTP200后新建Ego61，读取真实DOM再运行版本化controlledImages。

| 命令/证据（test-results/） | 实际结果 |
| --- | --- |
| checks `node --test tests/image-preview.test.mjs tests/notifications.test.mjs tests/presentation.test.mjs tests/editor.test.mjs tests/editor-deadline.test.mjs` | **55/55，失败/取消/跳过0**；t17-independent-targeted.log |
| checks `npm run typecheck` | API/Web退出0；t17-independent-typecheck.log |
| 自有组件容器Web workspace typecheck | 含fixture退出0；t17-independent-fixture-typecheck.log |
| 最终controller/声明/view/loader/presentation的宿主与镜像SHA256 | 一致且diff退出0；t17-independent-{image,source}-hashes.log；controller/view另docker cp后cmp逐字节退出0 |
| 版本化实际React/native dialog场景 | **7/7通过**；t17-independent-components.json |
| 额外源策略/关闭备选/双指交错 | 发现F1/F2/F3；以上各证据JSON |

7组件覆盖备选/旧load、真触屏关闭无点穿且焦点保留、B旧error不改C/边界/缩放重置、每图耗尽不跳下一张、描述替换晚成功不启用新图、卸载晚结果、session-ending晚结果不恢复。控制loader故意忽略abort，用于身份无关的资源生命周期；不冒充native网络故障/真实SQL身份链路。F2的error为真实React img事件入口注入，loader回执可控，不声称真实远端故障本次自然发生。

## 开发证据、清理与局限

核对`t17-browser-delivery.log`/browser.json最终正常密码全流程、native缺失→损坏→有效源、鼠标/单触点拖动、真实CLI撤权112ms及旧预览0、最终production-boundary.json组件路由404/匿名protected401、final-source.json镜像对应。查看开发narrow-touch截图；它是事件修正前相同布局点，**不是本次独立截图，也不是最终新截图**。最终截图CDP timeout日志保留，开发去掉截图后行为轮成功；未将工具超时算产品失败或伪造最终截图。209为触屏修正前历史全套，独立本次仅最终55+7及额外风险验证，不声称最终209重跑。

Ego61已finish({keep:[]})一次，自有组件容器删除。t17-independent-cleanup.log显示仅原三服务healthy；original-status.json为ready/connected/schema0004。无新DB/凭据、SQL、迁移、原部署重启或构建，.env/presentation/Ego31/真人/飞书均未动；仅本审查报告本地提交，未push/关工单。

Chromium触控协议不等于物理手机/全部OS/软键盘/读屏或远端HTTPS图片矩阵；native图错误不提供HTTP认证语义，abort不保证终止远端传输。T03真实飞书组织人工验收仍另列未完成。当前建议先修上述发现，再定向复核，不能因正例通过直接完成#18验收。

## F1/F2/F3 定向复核附录（2026-10-15）

固定范围 `b6074876c76744cf14c0c8f662cdab899de9e4ee..4fa24cb4f41dcf413bdada55a1ef92cd97b68513`，开始HEAD为上界、工作区干净。读取全部8文件差异、修复验收及更新合同，保留初审历史。同一审查者依次双轴，**Standards 0新增；Spec F1/P2、F2/P2关闭，F3/P3部分修复但仍存，未新增独立编号问题**。建议补齐F3后再按#18完整验收。

### F1/P2 关闭

最终路径序列化后拒绝双斜杠前缀并重新解析origin。独立复用版本化用例相同的16输入，真实挂载控制器产出8拒绝/8接受，再在Ego63浏览器URL API按HTTP及HTTPS两种base解析；literal、编码大小写及混合dot段均拒，合法本地query/hash/内部重复斜杠/编码斜杠仍保持origin，显式HTTPS保持协议且无凭据。证据`t17-fix-independent-source-table.json`与`t17-fix-independent-browser-policy.json`；**只有字符串/URL解析，没有向候选主机发请求**。原初审本地绕过已关闭，没有将其描述为SSRF或权限提升。

### F2/P2 关闭

控制器cancelActive区分初始缩略图拥有的请求与非初始图库请求。初始图关闭/切走保留同一次候选与token，完成只恢复入口，不自动打开；非初始仍取消并换token。invalidate/end仍取消初始加载，旧token不恢复新实例；初始图在B显示期间完成不会重置B变换。

独立新增7组真实React/native dialog验证按钮/Escape/遮罩关闭、源revision替换、卸载、ending、全部失败：关闭时backup未abort，请求数4→4（含StrictMode初始基数），完成后明确重开；替换/销毁/end拒旧结果，全部失败终态无新请求。59专项另覆盖初始图切走的持有、非初始取消和其它图变换保持。证据`t17-fix-independent-fallback.json`。初始资源生命周期补充符合持续缩略图的职责，不是重试已失败候选或放宽晚结果校验。

### F3/P3 仍存：图片区外的第二触点未纳入取消判定

- **已修部分**：两个触点都落stage时取消drag及capture，剩余触点不继续，全部释放后新手势恢复；pointercancel和主动丢capture后可恢复。独立版本化场景得到pan120→双指仍120→新手势180→cancel后210→lostcapture后不动→新手势230，真实事件轨迹见`t17-fix-independent-touch.json`。
- **剩余定位**：`apps/web/app/components/elements/image-preview.tsx:28`仅stage.onPointerDown将pointerId加入集合并检查数量/nonprimary；`:14`仅全局监听up/cancel，没有在预览其它区域的down时发现第二触点。`:29`仍认集合size1，允许原指移动。
- **独立实际复现**：4×放大，首指在图内拖动至panX120；第二指按在**同一弹窗的image-dialog-caption**（isPrimary:false），首指再移80px，panX变200。捕获轨迹为image-full down→stage move→caption nonprimary down→stage主指move，没有cancel/lostcapture。不是第二指未派发或未等待渲染：每次CDP输入后等两帧再读。见`t17-fix-independent-outside-second-pointer.json`。
- **合同/影响**：更新合同明确“第二触点或非primary触点加入即取消既有拖动”，没有把它限制成两个触点必须都落图片stage。首指仍在拖动，另一指落可滚动说明区是预览内部有效交错；目前仍意外平移。与原F3同一取消边界，继续P3，不另计F4；没有声称越界、缩放或关闭错误。
- **建议**：在模态预览范围（包括caption/工具/框内空白）的down统一跟踪接触并取消已有drag，而不是只在stage登记；跟全局up/cancel配对，直到所有相关接触结束才恢复新手势。补stage+caption/工具区第二指及剩余指继续移动对照，保留单指、鼠标、焦点/触屏遮罩零点穿与销毁清理。不能仅以两个stage触点测试通过关闭F3。

### 独立验证与源码对应

旧templux-checks镜像**只读挂最终shared、React view及image测试**，不是新生产镜像。fixture仅挂自有开发容器路由，API指向本机端口1；没有身份/DB。宿主与容器controller/view/fixture SHA256一致，controller/view另docker cp后cmp逐字节退出0；证据`t17-fix-independent-{container,source}-hashes.log`。

| 执行 | 实际结果/证据（test-results/） |
| --- | --- |
| checks `node --test tests/image-preview.test.mjs tests/notifications.test.mjs tests/presentation.test.mjs tests/editor.test.mjs tests/editor-deadline.test.mjs` | **59/59，失败/取消/跳过0**；t17-fix-independent-targeted.log |
| 挂最终shared/view的checks `npm run typecheck` | API/Web退出0；t17-fix-independent-typecheck.log |
| 自有组件Web workspace typecheck | 含fixture退出0；t17-fix-independent-fixture-typecheck.log |
| 新关闭7组+多指1组+原7组真实组件 | **15组通过**；fallback.json/touch.json/original.json（均t17-fix-independent前缀）；包含原触屏恢复焦点/底层click0 |
| 16源策略浏览器最终解析 | 8拒/8接受，无候选网络请求；browser-policy.json |
| 额外stage+caption两指交错 | F3剩余复现；outside-second-pointer.json |

原7组件只增加等待对应rev=1/rev=2的loader effect请求再取回执，仍断言旧完成不启用新源、新完成才启用，没有把revision DOM更新当loader已经启动，也没有放宽产品结果。核对开发red日志、保留原组合中rev观察失败及无接触touchCancel清理报错记录，最终场景未屏蔽其它错误。本次独立15组全部退出0，没有以旧失败日志冒充最终成功。

结构search→双向trace→snippet核对cancelActive仅close/select调用；9依赖路径coverage均metadata_match，无报告缺口，best-effort仍非完整性证明，全部修复源码直接读。复用初审Context7 Pointer Events主指/capture/cancel官方语义，无需新框架API；未重跑209、SQL身份/凭据、生产构建、正常密码或截图。

### 清理与边界

Ego63已finish({keep:[]})一次，t17-fix-review-components已删除；t17-fix-independent-cleanup.log仅原三服务healthy，original-status.json为ready/connected/schema0004。原部署无重启/迁移，.env/现用presentation/Ego31/真人/飞书保持，未push/关票；只追加本审查报告。旧生产镜像不因本次挂载验证自动获得修复。

Chromium原生dialog/触控协议与可控loader不等于物理多点硬件、远端自然故障、全OS/读屏或真实SQL身份；209及较早布局截图保留原源码点，T03真实组织人工仍另列。本次F1/F2可验收，F3仍需定向修正复核。
