# T28：通用贡献审查、隔离发布与另一项目采用

## 固定来源和审批

主任务起点 `e9f8a9efe250c2eb85a12bc927a7c19f35eeaee1`；本阶段起点为独立复核报告提交 `d778027304d066b0433e020da9295fe931e1cf35`。原候选 F1 及修复过程保留在 [候选审查](t28-candidate-review.md) 和 [候选修复验收](t28-candidate-fix-acceptance.md)，未改写原结论。

实际独立审查接受候选 `4d69b683f7f1edefef2d6261895de9f368869f5d` 后，TL 才写入 `test-results/t28/candidate/approval.json`，SHA `a7a76de70dbf9e5aba2a68096fcaec4b57018e6e60df78a079ca8a5ef314a56f`。本阶段只读取它，没有替换或自造批准。作者对 B 提案的采用审阅另标 `independent:false`，不代替候选独立审查或最后双轴验收。

| 固定产物 | SHA256 |
|---|---|
| 产品 patch | `26522ef2f42e3c441dcaab5352096d42f92070ed925f5c84e20f431f1bbb2383` |
| 兼容工具 patch | `1624c34f7799555a6304f38118f59c34212ee1ebdc5f260c62151c7237974870` |
| producer `tests/scenarios/t28-target.mjs` | `8622e6d0ee5bcc688202352f7f361244c8ffb13443d2782bb0aa559f71eba2ee` |

## A → 候选 → 发布

A 是独立正式 0.1.0 包消费者，项目品牌 Harbor、项目适配及合成 reference 保留在 A。提取仅可选复制文案的 helper/type/组件参数三项；页面、业务名称和数据不反向同步。详见 [贡献合同](../specs/reviewed-contributions.md)、`t28-candidate.md` 和 candidate ownership 清单。既有 22 项专项与实际组件状态证据沿用候选独立审查，不冒称本阶段重跑。

受审 producer 以容器 `sha256:35acb8ff42da6b94dc3cde984b05b68780b641909c84c99f38ee263cd07e347c` 实际执行，退出 0。命令/输出分别为 `test-results/t28/approved-producer-command.json`、`approved-producer.log`。仅本机隔离 `test-results/t28/releases/0.1.1-t28.1/`，不是对外稳定发布；正式版本仍仅 0.1.0，未覆盖旧产物或继承 .2/.3 演练。

`python3 tests/scenarios/t28-release-audit.py` 退出 0，证明：

- 正式 source commit `66aa7c2d3f5f4fd921837e9804c4fc1d9cbb0bfa` 的 198 项精确输入，仅 3 产品文件 + 2 工具差异；源 inventory 与 reviewed producer prepared inventory 对应。
- 目标 source commit 是受审候选，`upgrade.from` 仅 `0.1.0`；complete 的 manifest SHA 与文件一致。
- 消费 `.templux/verify.mjs` 为受审严格 SemVer 工具 SHA；build 工具未作为运行时包接口泄漏。
- tar 完整路径集合保持，core 仅 package version 和共享 copy helper/type 变化；web 另加 CopyButton。无 T26/T27 新业务/发现代码，无 .2/.3 overlay。

| 新测试产物 | SHA256 |
|---|---|
| manifest | `9f5b0e2578cc3eb3d7b0d515365e12af43d0c126a04cd5c3d98ade47ef286b06` |
| core tar | `56a1c569f6ea7d1e54d44ffef0b55a924f4f8adc39fa67291fcfad087cd10422` |
| web tar | `1ce068de8570e66d224df190235237e583830d92918b928884a118fd5a3b5005` |

完整输入/模式/产物证据：`releases/input-proof.json`、`release-audit.json`、candidate 文件清单。SHA 只证明本次内容绑定，不是恶意代码沙箱或外部发布背书。

## B 自主提案与受控采用

`python3 tests/scenarios/t28-project-b.py` 创建新正式 0.1.0 包消费者；每次运行创建新的 exclusive 目录，不能覆盖旧项目。B 有 Meadow 品牌/config、独立业务版本 `1.0.0`、受权限保护业务路由中的专属 greeting 和自己的合成页面。可选 messages 通过 props 对象传递，旧组件忽略该新增可选属性，旧页面两个按钮均显示“复制”；没有绕过运行时配置校验或修改旧包。

首次提案被 semantic 拒绝：演练页面误把默认导出写成具名导入。修复仅 B 页面，未改候选/producer。`b-original-types.log`、`b-proposal.log` 保留失败；`b-original-build.log` 记录改正后旧包安装验证/真实 Web 构建退出 0，Ego78 实际旧页结果见 `b-old-page.json`。

最终提案使用同一受审镜像 `35acb8…`，不使用先前旧工具镜像结果冒充最终源码。`b-proposal-verified-command.json` 固定真实 B 输入、精确目标 manifest、behavior 和只读挂载；`b-proposal-verified.log` 退出 0，7 项 lock/install/combination/semantic/API build/Web build/behavior 均 passed，manual 0，directlyApplicable true。先前 `proposal-final` 也通过但 verifier 镜像较旧，最终采用以 **`b-upgrade/proposal-verified`** 为准；两次完整交付 inventory 相等。

作者先检查固定目标、只有两个共享依赖变更、patch SHA、7 检查及项目所有权，再执行 `python3 tests/scenarios/t28-apply-reviewed.py`，退出 0。它只创建一次性副本，不写原 B；真实 `git apply --check` + `git apply`，替换明确两 tar、移除明确旧 tar。完整 **82 文件集合/字节/模式** 与 report.final、candidate 精确相等。`b-proposal-review.json`、`b-application-proof.json` 保存本次审阅/等价证明。

最终副本容器中 `npm ci --ignore-scripts`、安装组合验证、API/Web typecheck、API build、Next production Web build、业务行为检查全部退出 0：`b-applied-final-build-command.json` / `b-applied-final-build.log`。业务/config/版本保留，baseline 仍为目标 pristine 模板，不把 Meadow 定制写成模板基线。原 B 的 lock/vendor/baseline/业务文件均 readonly。

## 实际网页与局限

`tests/scenarios/t28-benefit-browser.mjs::benefit` 在 Ego78/p1 操作最终包的真实生产 Next 页面：按钮键盘 Enter、pending、成功、约默认时长恢复、权限拒绝、重试文案、本地 live feedback、默认中文兼容。完整合成值 ` MEADOW-DEMO-0091 ` 含首尾空格被原样传递。`b-benefit-browser-final.json` 保存最终镜像/最终提案采用副本结果（前次等价副本结果另存 `b-benefit-browser.json`）。writer 仅在本页内存受控替换并 finally 恢复；此证据**不宣称 OS 原生剪贴板授权成功或读取真实个人剪贴板**。

Ego 截图先前超时，使用已记录 agent-browser 独立 session fallback：`project-a-fallback.png`、`project-b-benefit-final-fallback.png`，均真实页面并已查看。B 页面仅项目自有合成演练路由，不被复制进公共包；页面不是新增认证后门。API 不运行，维护提醒准确显示状态未知；该截图不作为维护/数据库/真实登录成功证据。没有重复无改 SQL/身份/全部 UI 矩阵，T03 真人 Feishu 仍 pending。

最终源对应核对 `python3 tests/scenarios/t28-final-audit.py`：原正式 0.1 manifest/tar 不变，A 原文件除已记录 Next 生成 declaration 外不变，B 输入全字节/模式不变，采用源码与最终 report 一致；6 个 T26 工具与共享 verifier 的镜像 SHA 均匹配当前源。新提案路径、source/target manifest、最终 tree、vendor/patch/check 细节可直接审阅其 report。API/Web 独立构建已实际执行；不声称任意业务行为或真实组织验收穷尽。

## 复跑和操作边界

1. 现有 fixed candidate/approval 是历史审批产物，不重写或伪造。新候选必须新目录/重新独立审查；`t28-target.mjs` 对同版本 exclusive，不可复用旧输出覆盖。
2. 先用 `t28-stable-inputs.py` 创建精确 stable inputs，核对 approval/producer，再按保存命令以只读输入、新输出运行容器 producer。若固定 SHA 有变，停止补审。
3. 新 B 用 `t28-project-b.py`；按保存命令换成该新 B/新 output（绝不能现用项目），以容器运行 T26 7 检查，审阅后用 disposable apply 脚本；脚本硬编码本次精确受审目标，不是泛化自动 apply 产品命令。
4. 按保存构建命令对副本安装/独立构建，启动仅 loopback 的自有 Web，调用 benefit helper。原生剪贴板权限测试与受控 adapter 明确区分。
5. 保留 safe source/vendor/发布/提案/日志；停止自身容器、清缓存、结束自有 TaskSpace/session，不处理用户或其他任务资源。

所有构建/npm/包获取在容器；宿主只 Python/Git/浏览器工具。未安装全局调度、未外发、未 push/关票/外部 publish/自动合并部署。原部署/schema0004、.env、实际 presentation、Ego31、真人与 Feishu 未操作。

## 最终清理与验证点

最终采用以 `proposal-verified`、`b-applied-final-build.log`、`b-benefit-browser-final.json` 为准。随后仅运行发布/所有权只读核验、Python AST/Node scenario 语法和 `git diff --check`；本阶段没有再修改受审产品/工具源。清理后只读核验仍通过。`cleanup.json` 记录移除本任务 A/B/组件容器与 4 个自有项目缓存；安全源/vendor/提案/发布/日志留在本机，路径由 `project-*-path.txt` 指明。自有 Ego78 TaskSpace 及 `templux-t28-contribution` fallback session 已关闭；Docker 中仅原有服务保留。未产生数据库、密码或临时授权秘密。
