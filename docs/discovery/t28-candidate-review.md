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
