# T28 候选独立审查：复制文案与稳定来源

## 范围与结论

这是 #29 发布前的候选审查，**不是全票验收**。同一独立审查者依次执行 Standards/Spec，Team权限优先于code-review技能的并行安排；未生成批准记录、未运行producer正例、未生成新版本。

- 工程基线：`e9f8a9efe250c2eb85a12bc927a7c19f35eeaee1`。
- 完整候选：`7f2318b68cf95eccefd17a60c2fe38795e2dd323`；交接HEAD `62c8491b0fbe483c93b0b75bb8cc3164959cd8e9` 仅文档。
- 产品补丁：`26522ef2f42e3c441dcaab5352096d42f92070ed925f5c84e20f431f1bbb2383`，仅shared/copy.mjs、shared/copy.d.mts、CopyButton。
- 兼容工具补丁：`8937f281f9e2b4f4b3e8fae1837a6e73ac69387160765b8c9981810beed5b633`，相对正式0.1.0的tools/release/build.mjs及verify.mjs；虽然工程基线已存在，仍纳入本次审查。
- producer脚本：`tests/scenarios/t28-target.mjs`，SHA `8622e6d0ee5bcc688202352f7f361244c8ffb13443d2782bb0aa559f71eba2ee`。
- **Standards：0项发现。Spec：1项P3（兼容工具版本语法边界）。** 复制组件及固定来源提取验证通过；建议修补工具边界后更新准确候选并定向复核，再继续本机隔离测试发布与B演练。本报告不构成当前完整五文件候选的无条件批准。

依据：Gitea #29/#1故事6，ADR0001/0002/0012/0029，reviewed-contributions、shared-release、upgrade-proposals合同，候选设计/计划/交接文档及最新candidate.json/两patch/五文件。未沿用旧三文件包替代完整审查范围。

## Standards

0项发现。新增纯文案合并函数留在现有状态模块；组件只引入messages参数及显示选择，继续使用原复制状态/事件/会话实现。项目品牌、页面、路由和配置未进入共享改动，没有认证/SQL/权限入口或无关功能扩展。

codebase-memory按search→trace→snippet检查CopyButton→resolveCopyMessages/createCopyFeedback/session ending链；对17个证据代码/脚本/fixture路径逐项coverage，均metadata_match、best_effort无记录缺口，并直接读源码。图不作为完整权限或不存在行为的证明。

## Spec

### F1 / P3：兼容工具的“准确SemVer”校验与npm规则不一致

**位置**：`tools/release/verify.mjs:7`；用于build入口 `tools/release/build.mjs:17` 的version/from以及verifyProject清单版本检查。该差异属于本次明确补审的compatibility-tools.patch。

**实证**：在候选原生镜像内直接将isExactVersion与该镜像npm自带node-semver.valid对照，无发布/pack动作：

| 输入 | 候选isExactVersion | npm SemVer |
| --- | --- | --- |
| 0.1.1-t28.1 | true | 合法 |
| 0.1.1-01 | true | null，非法 |
| 0.1.1-alpha.01 | true | null，非法 |
| 0.1.1-alpha--x | false | 合法 |

正则将点和连字符都当作分隔，允许纯数字预发布段前导零，又禁止合法的连续连字符。因而宣称准确SemVer的边界不成立；调用者可能通过该前置门禁后再在npm或严格版本图中失败，也可能误拒合法输入。**固定演练目标0.1.1-t28.1没有这个问题**；不据此声称有权限提升、锁SHA绕过或该固定版本一定构建失败，故定为P3。

**建议**：采用有界、规范的版本语法校验（明确本项目不支持build metadata等限制），至少拒绝数字预发布段前导零，正确处理标识符内连字符；保留原组合/包/锁/SHA及安装校验。增加上述合法/非法对照，覆盖build version/from和消费verify入口；勿通过放宽npm或改指定演练目标隐藏问题。修复影响两工具补丁/producer来源绑定时应更新候选清单及相关SHA，不借旧批准放行。

证据：`test-results/t28-review/semver.log`。Context7 `/npm/cli` 的当前[package.json版本合同](https://github.com/npm/cli/blob/latest/docs/lib/content/configuring-npm/package-json.md)要求版本可由node-semver解析；实测使用镜像自带npm依赖，无新宿主依赖或网络安装。

## 通过的候选范围与独立验证

证据根 `test-results/t28-review/`（忽略目录）。使用原生候选镜像 `sha256:7e64c30ad40853cc4d3158165a8cb6dec13ce8270f18b15493643661d72e089f`。

| 检查 | 实际结果与边界 |
| --- | --- |
| 产品/fixture镜像来源 | `audit.json`：7个列明源/类型/工具/测试/fixture与宿主逐字节/SHA一致。五候选文件与bundle一致，两patch及producerSHA匹配上述固定值。 |
| A真实提取 | helper和类型与A源码字节对照，shared尾部为原样helper/类型；项目页面、Harbor品牌/reference、局部ProjectCopy呈现适配和config不提取。A仍使用准确0.1.0公开state/copy、elements/clipboard组合。 |
| 稳定198输入 | 审核stable-inputs.py，并将现存198输入逐项与正式manifest白名单、66aa7c2 git blob、stableModes对照，无额外/缺失文件、链接或SHA/模式差异；在自有一次性目录实际apply两patch后变化集合恰5项。未执行producer正例。 |
| 公开组件语义 | 默认文案保持，部分覆盖/非法值固定错误、纯文本、完整复制/空白保留；messages变化不进入store useMemo依赖，无新复制timer/状态实现。22项专项及API/Web types退出0，`tests-types.log`。 |
| 工具门禁 | 两工具补丁直接核对除F1外未删除原manifest SHA、准确依赖声明、包名/版本/SHA/SHA512、归档类型/路径、支持组合、installed记录检查；新增verifyProject在complete之前。另独立11项release回归通过，`release-fixture-types.log`。 |
| 真实落点 | build仅producer执行，不复制进运行tar；verify复制为项目.templux/verify.mjs，进入消费项目而不是core/web运行tar；静态核对build拷贝/exports流程，本轮没有新包可供产物解包验收。 |
| 无批准拒绝 | `audit.py`在自有空输出目录、readonly review/stable挂载运行固定producer；无approval，退出1、stdout空、stderr固定拒绝、输出0文件，candidate未改；自有目录随后删除。无伪造approval或0.1.1目录。 |
| 实际生产编译组件 | Ego自有空间79，版本化copyMessages新场景和controlledCopy原8组全部通过（`browser.json`）：pending中改文案保持状态、success中换文案不重置timer，1513ms恢复；HTML形字符串0子元素；默认中文、拒绝/重试、空值、form/row副作用0、目标替换/卸载/ending晚结果隔离。fixture挂载后的Web typecheck另通过。 |
| 真实A页面与完整值 | Ego79实际查看31128/contribution-demo，临时覆盖页面navigator.clipboard writer并finally还原属性，观察写入完整` HARBOR-DEMO-0042 `及按钮Reference copied（`project-a.json`）；未触OS剪贴板。该文件feedback字段取页面首个status，是维护未知提示，**不将它当作复制反馈断言**。 |
| 稳定发布/卫生 | 原0.1.0 manifest及两tar精确SHA维持；无新0.1.1发布。Python脚本syntax及git diff --check通过，未改原发布、候选包或A输入。 |

producer重建源码审查：先取得与candidateCommit一致的真实独立记录，验证198白名单SHA/模式/完整库存及五overlay；清理选定scope，恢复正式字节，再叠五项，要求最终SHA变化集合恰五，不引入main T26/T27样板或历史.2/.3功能。approval只是工作流记录，不是恶意作者可变文件系统的授权沙箱；本轮不声称已批准或运行该后半段。

## 证据区分、限制与清理

- A是真实0.1.0消费者的项目局部原型；31130/t28-copy和/t18-component是生产编译的工具fixture，不是已发布新包/正式业务页。开发未水合的开发模式尝试没有作为成功；本轮实际组件断言在已水合生产编译页执行。
- 查看开发实际`project-a-fallback.png`，品牌/合成内容与本轮DOM一致。开发Ego截图失败与agent-browser真实截图fallback准确区分；本轮Ego成功，无fallback或新截图矩阵。未用生成图代替网页。
- 本轮全部Clipboard写入为受控writer；不是原生权限/真实OS写入验收。没有SQL身份/维护/真实飞书复测，维护API未开因此页面“状态未知”如实显示；**T03真人组织链路仍pending**。
- 未运行producer正例、npm pack新版本或B升级闭环，未审新manifest/tar/真实B补丁和受益页面；这些是后续#29验收必需工作，不能由本候选测试代替。
- Ego79以finish({keep:[]})完成，仅关闭审查者空间；开发Ego78、Ego31未操作。自建审核临时目录已清理、--rm容器均结束，未建DB/卷/token/凭据/全局任务。开发保留A/组件服务未停止，留给其所有者。原schema0004/.env/实际presentation/真人/飞书保持；无实现编辑、push或关票。

**后续建议**：修复F1后定向核对版本语法及更新的两工具/producer绑定，再由TL决定候选批准与隔离发布。即使后续候选通过，也仅允许继续本机隔离测试发布及B受益演练，不等于#29全票验收。

## 候选F1定向复核附录：准确版本与重新绑定

### 范围与决定

复核范围 `5de91a3b8139e1b11bd9285fd4f5d02270780380..4d69b683f7f1edefef2d6261895de9f368869f5d`，交接文档点 `c1686a8943e374c99012238dea1d3a21c9ef82f7`。读取初审、修复验收、五文件候选清单、完整修复差异及共享发布合同补充。仍由同一独立审查者依次双轴，保留上文原结论为历史。

- **Standards：0项新增。Spec：F1关闭，0项新增。**
- **准确绑定下列完整候选，允许继续“本机隔离测试发布+B受益演练”。** TL可依据本独立结论形成匹配该候选的真实批准记录。本审查者没有创建approval文件或运行producer正例。
- **不是#29全票验收**：实际新manifest/tar/原始baseline及B真实提案、完整应用等价、消费构建/页面受益仍须后续审查。T03真人飞书组织链路仍pending。

| 批准记录应绑定的身份 | 精确值 |
| --- | --- |
| 完整candidateCommit | `4d69b683f7f1edefef2d6261895de9f368869f5d` |
| 三产品patch（未改） | `26522ef2f42e3c441dcaab5352096d42f92070ed925f5c84e20f431f1bbb2383` |
| 两兼容工具patch（更新） | `1624c34f7799555a6304f38118f59c34212ee1ebdc5f260c62151c7237974870` |
| verify.mjs SHA | `9298ddcd0c61b62de5c0efe0fd5e9b5d79d3123d6ffbed121f1f420251a88d81` |
| build.mjs SHA（未改） | `ddbb56005d4753cb80acffbf363c0a11dc6713ecf8ad53b80915fe8147e513c3` |
| producer t28-target.mjs SHA（未改） | `8622e6d0ee5bcc688202352f7f361244c8ffb13443d2782bb0aa559f71eba2ee` |
| 正式稳定来源 | 0.1.0，commit `66aa7c2d3f5f4fd921837e9804c4fc1d9cbb0bfa`，manifest `bbf6ad9941a784e1301129a067698a79ff23cf2b8b81801582add184ec60c5dc` |

### 修复与独立实证

证据根 **`test-results/t28-fix-review/`**，使用原生最终镜像 **`sha256:35acb8ff42da6b94dc3cde984b05b68780b641909c84c99f38ee263cd07e347c`**，未覆产品或测试源。

1. `tools/release/verify.mjs:8` 起的有界解析明确限制≤80字符、core安全整数；预发布按点分段、仅纯数字段禁止前导零，内部连字符/合法大小写/混合数字不误拒。输入全文匹配，末尾换行、metadata、范围/前缀等拒绝。`semver.log`独立原反例及npm自带SemVer对照：-01/alpha.01为false，alpha--x、RC.1、01alpha及固定t28目标为true；超安全core拒绝。metadata虽可被npm识别，本项目明确不支持，不宣称实现所有SemVer表示法。Context7再次核对npm版本必须可由node-semver解析的合同。
2. safeFile仅增加ASCII大写字母以承接合法预发布文件名；verify前置仍要求准确core/web包名及按相同精确版本构造的文件名，未放开斜线、反斜线或目录穿越。其余链接/类型/大小、manifest/包SHA/SHA512、版本组合、依赖声明和installed门禁无删除。build沿用同一isExactVersion检查version/from，complete前verifyProject仍在。
3. **121/121专项，0失败/取消/跳过，退出0**，`special.log`：release、release-version、upgrade、upgrade-checks、upgrade-merge、updates-version。51项版本回归含真实带哈希最小consumer及verify CLI、build version/from前置门禁、80/81字符和数值边界。合法build对照只通过版本门禁后故意在缺package的预检失败，未把退出1误称成功pack；测试tar是合成消费fixture，没有执行T28 producer正例。
4. `audit.json`：新候选11源/fixture/脚本与原生镜像逐字节/SHA一致；两patch和producer精确SHA实测符合上表。产品文件/类型/patch与旧候选不变；candidateCommit已重绑，旧7f2318b未沿用批准。
5. 自有临时正式198源上实际apply --check及apply两patch，**完整198文件集合/字节/模式等于正式基线+五个列明overlay，变化恰五项**（`five-files.json`）。没有main新增T27骨架或.2/.3功能，不通过producer正例来验证此准备过程；所有临时源目录已删除。
6. 独立复跑版本化rebind-proof的审查副本，仅改证据输出根：旧包/旧source、新包/新source、旧包/新source三组**均无approval文件**，各退出1、stdout0、输出0文件、固定拒绝诊断，临时输出清理。因均缺批准，**不将第三组误称已验证“存在批准但来源不符”分支**；无制造approved记录。见`rebind-proof.json`。
7. 同proof核对正式0.1manifest/tars保持原SHA、原198源/模式保持，A原84源业务/品牌/config/路由不变；仅既有Next构建生成next-env声明相对构建前快照不同，明确列入knownGeneratedNextDeclaration，而非宣称整个A从未变化。产品未改，沿用初审22项/APIWebtypes及实际组件证据，本轮未重复React/SQL/浏览器矩阵。

图按search→trace→snippet核对isExactVersion的build/verifyProject/propose调用，6路径coverage metadata_match、best_effort无记录缺口；直接阅读产品与测试差异。Python fixture内存编译、git diff --check通过。初审P3各版本原对照日志保留，本轮最终结果单独记录。

### 清理与后续边界

自建临时198源/输出目录已删除；工具容器均--rm，未建数据库、运行配置、凭据/token或全局任务。只保留安全脚本/日志/候选审查证据；开发保留A和组件服务/Ego78未停止，本轮无浏览器操作。原schema0004部署/.env/实际presentation/Ego31/真人/飞书未动，工作区仅报告提交。不push、不关#29、不生成新版本。

本附录的允许仅适用于上表固定候选及本机隔离演练；有实质源码或来源绑定改变应补审，实际发布及B闭环结果不能由这次候选结论预先保证。
