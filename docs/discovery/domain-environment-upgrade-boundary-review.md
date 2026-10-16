# `.env.example` 与升级/发现安全边界独立核对

## 范围和结论

2026-10-16，审查；任务 `01a14212-36a0-7a12-ba9a-9be2eae50bb2`。固定源码 `59ad67bbdddf888d705b7e5de12388f9d035bbe6`，对照基线 `77c73c73acf1516261d283c7326e0cab0205c8e8`。仅核对新公开环境示例与既有发布/提案/发现路径的兼容，不是 #31/#32 最终审查，也不批准或生成任何发布。

- **Standards：0 项独立发现。** 既有安全过滤本身合理；没有建议为错误名称或示例支持而宽泛放开秘密路径。
- **Spec：1 项 P2 兼容回归，尚未关闭。** 新发布允许的公开 `.env.example` 无法通过既有 baseline 和 catalog 校验；未来即使目标明确声明合法 `from`，使用该合同的新项目仍被阻断。建议在后续声称兼容升级/发现之前修复，不能只以本候选无 `from` 解释该行为。

旧正式发布到当前无 `upgrade.from` 的 `0.1.3-domain.1` 应安全拒绝，当前先报 baseline 或 catalog unsafe 也不构成另一个缺陷；不要求改成某个指定错误类别。没有证据表明发生了不安全升级、秘密泄露或实际部署数据损失。

## F1 / P2：发布接受的公开示例被升级和发现视为秘密

### 定位与逻辑证据

1. `tools/release/build.mjs:6` 在发布排除条件中精确放行文件名 `.env.example`；`:45` 把它纳入 source inventory，`:52` 复制到 pristine baseline，`:56` 将其写入 `baseline.files`。基线至固定源码的 diff 确认该放行是本次新增行为。
2. `tools/upgrade/files.mjs:6` 仍将所有 `.env.*` 判为 secret；`:9` 的 `list()` 会跳过 `.env.example`。因此 `tools/upgrade/propose.mjs:11` 比较完整 metadata 和实际枚举时必然报 `baseline inventory invalid`；即使绕过该处，`:12` 的 secret 检查也拒绝。`:26` 把这映射成 baseline 人工项并直接返回，`:27` 才判断目标 `from`，所以合法路径声明无法解除阻断。
3. `tools/updates/catalog.mjs:4` 的 `publicPath()` 复用 secret，故 `project/.env.example` 和 `project/.templux/baseline/project/.env.example` 都为 false。`:13` 的完整产物 capture 遇到它们报 `unsafe_artifact`；手写含该文件的 catalog 也在 `:8` 被拒。`tools/updates/source.mjs:21` 的 readCatalog 复用同一验证，downloadRelease 亦先验证 catalog，不存在只在本地建索引时失败、远端自动正常的旁路。
4. 不能仅改 secret：`tools/upgrade/files.mjs:11` 的 `projectFiles()` 没有根 `.env.example`，`tools/upgrade/propose.mjs:8` 的 `managed()` 也没有它。仅让 baseline/catalog 通过，候选仍可能不复制当前公开示例，或将变更列为 project-owned-not-migrated。对于示例未变化的路径，merge 不会自动补入一个未复制的文件。域名合同要求启动使用该公开元数据，不能交付缺失示例的候选。

### 两种情形分别判断

| 情形 | 判断 |
| --- | --- |
| 旧正式 → 当前无 from 的 domain 候选 | 必须拒绝；本轮不建议放开，不要求报 unsupported-path。 |
| 从 domain 候选新建 → 将来明确合法 from、相同环境合同的目标 | 按固定源码仍先因公开示例拒绝 baseline；catalog 同样无法承载完整产物。这是实际新项目后续升级/发现能力回归，而非仅缺路径声明。 |

合同依据：`docs/specs/upgrade-proposals.md:3` 要求准确 from，并在 `:29` 规定三方基线和项目所有权；`docs/specs/update-discovery.md:17` 要求完整公开产物、拒绝秘密而非丢弃必要公开文件，`:50` 要求逐边完整验证。当前工作区的域名合同/候选方案同时声明公开 example 是核心环境元数据、真实环境仍属项目；这些未提交文档仅作方案输入，不当作已固定的实现来源。

## 独立最小复现

安全证据位于 `test-results/domain-boundary-review/`，未使用真实环境值。`proof.mjs` 从固定源码取出未导出的 baseline 函数原始正文，在隔离函数作用域绑定同一实际依赖；正文 SHA256 为 `6f49ba5a774c55852ae6363e50bcbbed5c438fb5c1dfc883073713d216a5d516`，没有改产品源码、替换安全谓词或调用发布器。

实际 Node 24 命令：

```sh
docker run --rm --name templux-domain-boundary-review \
  -v "$PWD/tools:/work/tools:ro" \
  -v "$PWD/test-results/domain-boundary-review:/work/test-results/domain-boundary-review:ro" \
  -w /work --entrypoint node node:24.21.0-bookworm-slim \
  test-results/domain-boundary-review/proof.mjs
```

命令退出 0，stderr 空；`proof-node24.json` 记录：

- 合成 README baseline 的 manifest SHA、source tree SHA、baseline source 和文件 SHA 全部匹配，对照校验成功。
- 仅增加准确公开 `.env.example`、匹配来源 SHA，并声明 `from:['0.1.3-domain.1']` 后，原 validator 报 baseline inventory invalid：metadata 为2项，实际 list 仅README。
- 合成合法 catalog 对照通过；增加 `project/.env.example` 后在相同显式 from 下报 corrupt_catalog。
- 根/产物/baseline 三种公开 example 路径全部 secret=true/public=false；`.env`、`.env.prod`、`.env.local`、secrets、credentials、backups 和穿越路径也继续拒绝。
- 实际 projectFiles 不复制根 example，managed 返回 false。直接 entry 读取符号链接被拒。

首次宿主 Node25 探针因 macOS `/var` 临时目录别名触发既有 safePath 拒绝，未进入目标控制验证；改为 realpath 临时根后宿主对照通过，再以上述受支持 Node24 重跑并得到逐字相同结果。该临时路径修正属于测试夹具，没有放宽产品 symlink 保护；Node25 不作为产品支持环境。

这是函数/路径和校验器复现，不是新完整 tar 发布、完整 CLI 提案或七项构建通过的声明。未来目标尚未发布；结论由与 from 无关且先执行的确定性校验及显式 from 合成对照支持。未生成真实新候选、未改旧产物、未做安装/SQL/浏览器测试。

## 最小修复建议与安全边界

1. 在**公开模板文件**语境中精确区分 `.env.example` 与运行环境；建议保持通用 secret/behavior 输入的保守含义，另用有界公开模板路径策略，或给调用处明确限定上下文。不要将任意 `.env.*`、大小写近似名称、任意深度同名文件或秘密目录变成公开文件。
2. 同时覆盖 pristine baseline 完整枚举/来源锚定、当前项目公开 example 复制、已声明模板所有权下的三方合并，以及 catalog 中产物的准确根/baseline路径。示例内容依旧必须是公开默认和元数据，不能从项目真实 `.env` 生成或回填。
3. 不跳过 baseline/hash/from/包组合/installed 校验；保持目标 pristine baseline、项目业务/config 所有权和完整 current+candidate patch 等价门禁。若项目修改公开核心示例，要按明确所有权规则产生冲突或人工项，不能悄悄覆盖为 target。
4. 加有界回归：相同合同合法 from 的真实提案/发现通过，公开 example 的修改/不变/删除与完整外部 patch 对照；无 from 仍拒绝；真实 `.env/.env.prod/.env.local`、秘密目录、链接、穿越仍不进入候选、catalog、patch、report。仅改 publicPath 或错误分类不算完成。

不建议为此降低 safety guard，也不建议发布一个虚构 from 来让当前旧项目自动接受新的必填合同。是否声明未来兼容边仍需独立验证该目标；本报告只指出目前过滤交互的必然阻断。

## 结构核对、来源与清理

按 codebase-memory search → trace → snippet：baseline 调用链涉及 propose / upgrade CLI / cumulative，publicPath 涉及 buildCatalog / validateCatalog / readCatalog / downloadRelease。相关11个实现/合同/示例文件 coverage 无已记录缺口（best effort，非完整性保证）；补查候选方案和复现脚本，后者 test-results 被排除，已直接读取。关键8个实现/示例文件逐字节等于固定 `59ad67b`，SHA见 `source-hashes.json`。这是业务过滤逻辑审查，无需框架/CLI API 文档查询。

临时合成目录全部 finally 删除，Node24检查容器 `--rm`，无镜像构建、DB、卷、凭据、浏览器、发布或网络配置变更；保留的只有安全脚本/JSON日志。开发并发修改的场景脚本和未提交合同保留原样。原 env/presentation、真人/飞书、现有服务均未操作。本地只提交本报告，不实现、不push、不关票。#31/#32最终审查及T03真人待验范围不受本报告替代。
