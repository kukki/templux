# T18 独立审查：完整值复制与异步本地反馈

2026-10-15；固定范围 `40df86d904b746f0ea8c5d15c7a6d878a4185992..6359f85610c4b6685842ca2a251f9de6162c00f0`。开始HEAD为上界且工作区干净；同一审查者依次Standards/Spec，按Team治理不新增成员。读取Gitea #19、既读父规格#1故事90、ADR0012/0013/0020及仓库规范、full-value-copy合同、计划/验收和全部22文件差异。

使用code-review、codebase-memory、Context7、ego-browser与完成前验证流程。结构search→trace→snippet核对CopyButton到控制器/会话结束，22路径coverage均metadata_match/无报告缺口；best-effort不证明图完备，另直接读取全部改动源/配置/测试。Context7 `/mdn/content`取得Clipboard API安全约束、writeText回执与浏览器差异：安全上下文，Chromium权限或激活、Firefox/Safari瞬时激活，不能假定统一支持Permissions查询。未采用相邻showPicker检索条目推导Clipboard行为。

## Standards

**0项发现。** 纯控制器保存实例代次/计时，原生writer与React视图分离；共享模块不依赖examples，示例只用合成完整文本。文案集中，snapshot/反馈不包含原值/异常文本，没有业务API/SQL、持久复制记录、全局通知或新依赖。类型声明细化copy枚举而不扩大其它呈现配置。未发现需单列的规范违反或有明确收益的smell，不重复报告工具已覆盖的类型项。

## Spec

**0项发现，建议T18按#19验收。** 检查范围及证据局限如下：

- **完整值与空值**：value显式传入，不读取DOM省略文本/选区，不trim，string/null/undefined以外拒隐式转换；空仅null/undefined/长度0，空白仍有内容。label非空且有长度上限，不在按钮属性或反馈中嵌入value。长值、首尾空白、换行、显式字符串0由真实控制器测试核对。
- **热区**：type=button；点击preventDefault/stopPropagation，Enter/Space的keydown不冒泡且不阻止原生按钮激活；默认disabled或项目hide，无行空白复制。原生click与键盘Enter/Space组件验证通过，submit/父行click0。合同明确禁止嵌套链接/按钮，父capture应排除交互控件，不承诺撤销已发生的父capture副作用。
- **真实反馈**：点击立即同步调用writer，pending去重，仅resolve后copied，默认1500ms从确认后开始；本按钮与局部polite/atomic live状态反馈，失败保留本地分类并可重试，不显示原异常/目标、不假成功、不默认全局错误。已复制期间的新点击是新的明确复制并失效旧timer。
- **异步隔离**：generation和timer隔离旧尝试，取消timer即使仍执行回调也不能改新状态；value/label/反馈设置/write函数均参与useMemo实例依赖，旧实例cleanup invalidate。StrictMode可再次setup，end永久阻新复制/移除控件、旧结果不能恢复。OS写已发出无法保证撤回，不以UI失效冒充平台取消，也不自动清空用户剪贴板。
- **平台边界**：默认writer直接writeText，先检查secureContext/支持性，不先await权限查询、不读原剪贴板、无execCommand/隐藏textarea fallback。NotAllowedError/NotSupportedError/其它异常分别本地反馈。自定义writer须真实确认才resolve，示例只有明确拒绝模拟，不伪造成功。native img等无关资源不参与此身份逻辑。
- **配置/范围**：whole branch缺省补1500/disable，显式配置null/空/缺字段/unknown/非法枚举或范围拒绝，CLI config-check不改文件；合法100–60000整数及hide/disable。共享加载快照/重启合同保持，现用presentation未动。未接入密码重置/关联下载或Agent交付，原no-store/0600/排他与不打印规则不变，无复制凭据入口。

## 独立实际执行

复用本票checks镜像，自有`t18-review-components`只挂版本化fixture及自有Next开发来源配置，API内部指向本机端口1，不提供身份。HTTP200后Ego67读取真实DOM，再执行版本化controlledCopy；本轮**不调用原生剪贴板读/写、不改origin权限**，组件受控writer与开发真实平台证据分开。

| 命令/证据（test-results/） | 实际结果 |
| --- | --- |
| checks挂最终copy测试 `node --test tests/copy.test.mjs tests/presentation.test.mjs tests/image-preview.test.mjs tests/notifications.test.mjs` | **54/54，失败/取消/跳过0**；t18-independent-targeted.log |
| checks `npm run typecheck` | API/Web退出0；t18-independent-typecheck.log |
| 自有组件Web workspace typecheck | 含fixture退出0；t18-independent-fixture-typecheck.log |
| controller/view/writer/presentation宿主与镜像SHA256 | 完全相同且diff退出0；t18-independent-{image,source}-hashes.log；controller/view另docker cp后cmp逐字节退出0 |
| 版本化controlledCopy真实React组件 | **8/8通过**；t18-independent-components.json |

8组覆盖pending不能重复写、完成后本地copied、约1545ms恢复且form submit/row click0；Enter拒绝本地live且无异常文本；Space触发unsupported及generic failure可重试；目标替换分别拒旧resolve/reject而新复制可成功；卸载/重挂不复活；空disable/hide；session-ending移除全部控件与反馈，晚成功不恢复。纯控制器专项另核对精确可控timer/2500ms项目覆盖、被取消的旧回调、空白和长尾及真实CLI配置入口。未把受控writer当系统Clipboard成功证据。

镜像中的copy测试hash为`56af9c…`、最终宿主为`578c3e…`，差异来自完整回归之后补强2500ms计时断言；独立54明确只读挂最终测试文件。产品controller/view/writer/presentation字节均相同。故开发225/225可对应最终产品源码点，但**不声称225已经执行最后补强测试断言**，该断言由最终54执行确认；未盲目重跑225或构建。

## 开发证据与限制

核对`t18-native-verified.log`：正常密码user进入受保护examples后，原生writeText/readText完整438字符及末尾-END逐字匹配，仅对应按钮copied，约1542.7ms恢复；临时测试origin真实clipboard-write denied后进入denied，恢复后短值真实readback相等。controlledMissingAPI是隐藏当前页API的模拟，非真实不安全域或全浏览器证明。原权限read prompt/write granted前后相同，ClipboardItems原生写回确认；平台不保证应用私有/自定义格式元数据逐字节还原，原空内容按空文本恢复。上述均为**开发执行**，本次独立没有再次操作系统剪贴板。

核对native-browser版本化脚本，权限仅指定自有origin且finally恢复，没有全局reset；只复制合成值、不打印原剪贴板。读权限仅测试回读/恢复使用，不进入生产writer。截图CDP超时记录保留，不称截图通过；之后去截图行为轮成功，窄屏仅DOM390/page390、长值ellipsis溢出和操作证据，未冒充新像素审查。

开发真实CLI撤权后reason=authorization_changed且旧控件0，跨文档performance负数不作退出延迟结论。初始化脚本末尾观测不存在的schema_migrations非零不冒称全程成功，后续正常密码登录/真实API schema0008证明测试身份可用。fixture生产404、完整225日志、secret扫描37文件0匹配与源hash已核对。独立本次无SQL/身份/凭据，开发链路不被受控组件替代。

## 清理与验收边界

Ego67已finish({keep:[]})一次，自有容器已删除；t18-independent-cleanup.log仅原三服务healthy，original-status.json为ready/connected/schema0004。无迁移/原部署重启/构建，.env/现用presentation/Ego31/真人/飞书均保持；仅本报告本地提交，未push/关闭#19。

结论限本票代码/合同与上列独立实测及已核对开发证据，不保证所有浏览器、OS、物理触屏、读屏或后台精确1500ms；适配器契约不能代替真实平台权限。未重复物理移除构建或全部主题截图。T03真实组织人工验收仍另列未完成，不由密码或复制链路替代。无剩余本票阻塞发现。
