# T26 独立审查：三方升级候选与检查可信度

## 范围与双轴结论

2026-10-15；固定范围 `2637317c3206c8e0dca6751240a52c6a54998a1f..5d49e0baade0d920bacd54a7ce94b3c092234776`，实际运行源码 `e9312aa8f88f322f7c08315b979d970caffc70b3`。读取 Gitea #27/#1 故事11–13、ADR0002/0012/0029、升级/共享发布合同、计划/设计/验收及全部23文件差异；同一独立审查者依次执行双轴。

| 轴 | 结论 |
| --- | --- |
| Standards | **0项独立规范发现**。只生成隔离提案，无自动apply/部署；宿主和项目代码信任边界明确。 |
| Spec | **3项P2，F1/F2/F3仍开放**。检查后最终候选可偏离锁/项目所有权；补丁漏删旧基线文件，或改写合法diff正文。 |

建议三项修复并定向复核后再按 #27 验收。本报告不关闭工单；T03真实组织飞书人工验收继续单列pending。

## F1 / P2：检查后未校验最终候选，过期检查结果仍标可直接应用

**定位：** `tools/upgrade/propose.mjs:48` 在执行检查前verify；`:53` 执行项目脚本；`:57` 对workspace package.json、lock等允许变化；`:59` 只根据既有七项状态决定 `directlyApplicable`。vendor/基线/验证器等也未在检查后与受信目标重新核对。

**触发与实证：** 使用最终工具镜像及现有合法发布fixture，显式信任行为脚本，在第七项结束时分别：

1. 将候选 `apps/api/package.json` 的业务version由1.0.0改为9.9.9；
2. 向候选已锁定的core tar追加字节，保持manifest/lock不变。

两例均 **7 passed、manual=[]、directlyApplicable=true**。第一例当前输入version仍1.0.0，候选变9.9.9且不列人工项；第二例对最终 `candidate` 再运行工具自己的 `verifyProject` 明确失败。证据 `test-results/t26-review/late-check-proof.json`、可重跑驱动 `late-check-proof.mjs`：

```sh
docker run --rm --entrypoint node \
  -v /Users/jkoo/git/Templux/test-results/t26-review/late-check-proof.mjs:/opt/templux/review-late.mjs:ro \
  t26-upgrade-tools review-late.mjs
```

该定向fixture运行真实npm锁/安装和工具七步；其API/Web命令是既有单测fixture的快速命令，不冒充真实Next编译（真实项目七项成功见后文）。原项目未修改。

**影响：** 报告所批准的候选不再是包校验/构建检查时的状态；可能错误改变项目业务元数据，或交付随后无法构建的受损包。合同要求workspace除明确共享file依赖外保持当前字段，最终准确包/锁有效。这不是要求工具抵御恶意同权限代码的沙箱；即使信任脚本，其生成/规范化副作用也不能让最终已知校验失败的产物获得成功标记。

**建议：** 检查结束后对最终输出做固定不变量核验：通过工具自身受信验证逻辑核对manifest/lock/vendor及目标基线/验证器字节；workspace package.json除预定共享依赖外与当前项目一致。对越界变化恢复并列人工项或明确失败，不依据旧passed状态直接放行；若接受其他变化，重新检查最终快照。补充晚阶段修改vendor、组合锁/基线以及workspace业务version/scripts/其它依赖的回归。

## F2 / P2：目标删除基线文件，补丁应用后保留旧文件并损坏后续基线

**定位：** `tools/upgrade/propose.mjs:46–47` 只把目标 `tb.files` 的基线路径加入patch集合，遗漏“仅原基线存在”的 `.templux/baseline/project/...` 删除项；`:61` 据该不完整集合生成patch。

**触发与实证：** 合法来源fixture的目标版本删除原模板工具 `tools/behavior.mjs`，项目另外提供行为脚本。七项通过，报告 `directlyApplicable=true`；实际 `git apply --check` 与 `git apply` 均exit0，随后只按vendor清单替换两包。结果：

- candidate正确没有 `.templux/baseline/project/tools/behavior.mjs`；
- 应用副本仍保留这份旧基线文件，因补丁没有对应删除；
- 新baseline.json已不列该文件，下一次提案因此先得到 `manual.kind=baseline`，而非正常路径判断。

证据 `test-results/t26-review/baseline-delete-proof.json`、驱动 `baseline-delete-proof.mjs`，与F1相同只读挂脚本方式可重跑。fixture原项目不写入，生成/应用仅在一次性目录；该例明确包括patch应用而非只测试mergeEntry返回值。

**影响：** 看似成功应用的可审查补丁与candidate不同，目标删除后未来升级因基线库存不符被阻断。普通新增目标的82文件等价正例不能覆盖此边界。

**建议：** 基线patch路径使用原/目标文件集合的并集，使旧独有文件生成删除项；新增、变更、删除均在一次性副本应用patch并替换vendor后核对完整文件集合与candidate，且复核新基线来源/库存。增加目标删除受管工具及删除原配置基线的回归。

## F3 / P2：补丁前缀全局替换改写diff正文，合法路径无法应用

**定位：** `tools/upgrade/propose.mjs:18` 对整个Git diff执行 `replaceAll('a/a/','a/')` / `replaceAll('b/b/','b/')`，替换范围包括context及新增/删除正文，而非仅文件头。

**触发与实证：** 合法基线Dockerfile含 `COPY a/a/file /app`，目标仅修改附近另一行。候选正确保留该COPY，七项通过且directlyApplicable=true；生成patch却将COPY改成 `COPY a/file /app`，实际 `git apply --check` **exit1**，Dockerfile及其基线的patch均不适用。`patch-literal-proof.json`、可重跑 `patch-literal-proof.mjs`，使用同一最终工具/合法fixture，实际Git返回错误；不是只匹配源码字符串。

**影响：** 普通项目路径文本就可损坏可审查补丁，候选构建成功不能保证交付patch可用；正文若落在新增行也会改变补丁表达的内容。

**建议：** 使用Git自己的前缀选项生成所需路径（例如针对当前a/b目录布局使用 `--no-prefix`），或仅结构化处理文件头，不替换正文。生成后对一次性副本做patch检查/应用及候选等价校验；增加context、新增/删除行中 `a/a/`、`b/b/` 及其他路径/URL字面量对照。

## 已通过的独立检查

证据目录 `test-results/t26-review/`；只读正式输入，自有当前副本 `/Users/jkoo/git/templux-t26-current-review-bbk2p9_q`，自有输出 `proposals/`。没有挂Docker socket、真实.env、PG或飞书凭据。

- 最终镜像 **49/49** 专项、fail/skip/cancel0，`special.log`：真实git合并、增删/模式/二进制、源锚定/锁、路径、单JSON、不可执行/失败/超时及NODE_ENV对照。API/Web typecheck退出0，`typecheck.log`。这些正例通过不关闭上述新增反例。
- `source-image.json`：7份upgrade/release源逐一SHA与主机及e9312aa交付对应；镜像 `sha256:e304e56d3f8baf3001a0647cc7c6eaf7c6623da3c35dcd101219e5cdcfad96eb`。
- 自有真实项目提案 **exit0、7 passed**：lock/install/组合/semantic/APIbuild/Webbuild/behavior均实际执行，Web构建约10.8秒，`success.log`、`success.stdout`、`proposals/success/report.json`。镜像公共npm cache仅作缓存预热，候选仍真实ci，未复用旧node_modules；最小环境没有强制development，Next真实生产构建通过。
- 自有实际缺baseline、Dockerfile文本冲突、语义exit23三例均exit2/不可直接应用；前两不跑检查，语义例停在semantic，后续不执行，全部输入hash/模式不变。`negative-proof.json/.log`。
- 相同宿主目录分别挂readonly current与writable alias，exit1单JSON、无输出目录；`bind-alias.json`。无执行不可信脚本或读取输入文件内容来猜测别名。
- 普通成功提案在另一自有一次性副本 `git apply --check`、实际apply并按精确vendor清单替换，**82个文件集合及字节与candidate完全相同**；自有业务API/业务页/config/角色/业务package内容保留，独立Dockerfile注释与目标新工具同时存在。`reviewed-apply.json`、`preservation.json`。这属于当前测试目标普通新增场景，不覆盖F2的删除反例。
- 自有当前80文件hash/模式前后相等；开发原消费者79文件对其既有before清单仍一致；正式0.1.0 manifest/两tar仍为T25原SHA。T24旧 `upgrade-proof.py` 与生产SQL历史相对审查基线diff为空，`git diff --check`通过。

## 来源、范围与独立性

测试目标明确为 `0.2.0-t26.1`，不是生产稳定发布。独立核对manifest SHA `6554dce775dd8f3ff3dddc93742465fdb6fa63b746d2908393c79809cd938f8c`、两包SHA及source输入摘要，`target-identity.json`。source.commit为913c12c，输入含版本化测试overlay，不能称该commit的未修改Git树。相对正式0.1.0，core只改project-interface JS/声明及metadata（新增真实label接口），Web只新增SVG及metadata；骨架构建实际依赖新接口，非空版本递增。版本校验继续限制协议/config/schema/Node/Next组合及明确from路径，不宣称任意版本兼容或推断累计迁移。

开发六组真实人员/Agent/权限/SSR/重启/包内migrate结果、82文件运行副本等价及失败修正记录已读取核对；**本轮未新建SQL库、重跑HTTP身份或浏览器**。本轮实际候选双构建/行为、文件等价与新增反例为独立执行；身份实现包字节未变且T25已有独立实证，故不为本次阻塞问题重复整个运行矩阵。原NODE_ENV错误、T24脚本误名和bind别名RED不冒充最终成功。

codebase-memory按index→search→双向trace→snippet核对propose/runChecks/merge，27个差异/ADR/保留脚本证据路径coverage均metadata_match；Tier2/best_effort，不是完备证明，关键源码和合同直接读取。Context7核对 [Git merge-file退出语义](https://git-scm.com/docs/git-merge-file)、[npm lock-only/ci](https://github.com/npm/cli/blob/latest/docs/lib/content/commands/npm-ci.md)、[Next NODE_ENV默认](https://nextjs.org/docs/app/guides/environment-variables)。

## 清理与验收建议

所有工具容器 `--rm` 已退出；fixture临时目录在finally删除。没有创建Compose/DB/卷、.env、真实密码/Cookie、归档/key或Chrome；候选node_modules/dist/.next缓存已清理。仅保留安全输入/应用副本、测试产物及ignored脚本/JSON证据（`cleanup.json`），不改原safe证据。

原0004部署、.env、presentation、Ego31、真人与飞书未操作。本轮不要求恶意脚本沙箱、不推广到Linux/WSL全矩阵或任意业务；目前三项P2应修复后再验收。仅新增本报告并本地提交，不改实现、不push、不关#27。
