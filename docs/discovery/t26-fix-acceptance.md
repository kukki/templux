# T26 F1/F2/F3 修复验收

审查基线 `02e80c575fc7e52700cb83009cdd1d92d02b53a4`；运行实现 `c12e5589328bc6178044302954b26408ce05a154`。保留[t26-review.md](t26-review.md)初审全文与开放结论，由TL另安排独立复核。本记录不代审查关闭发现/工单，无push。

## 核验与修复

按receiving-code-review、systematic-debugging、TDD先重跑独立三套repro。`test-results/t26-fix/*-red.json`准确复现：晚改workspace版本或vendor仍7passed/direct true，tar最终verify失败；旧基线删除应用后仍在；COPY a/a/file正文损坏、git apply --check exit1。随后将三套驱动版本化到`tests/scenarios/t26-fix/{late-check-proof,baseline-delete-proof,patch-literal-proof}.mjs`，追加真实结果断言，旧镜像assert-red均非零，新工具均0。literal断言顺序另核对，RED由实际git check exit1触发，不依赖新增报告字段缺失。

- **F1**：预备候选捕获完整源快照。仅lock成功步骤接受生成npm锁，仅Web成功步骤接受Next16已知默认声明（原声明也须为已知默认）；后续late修改同样不接受。检查后可信工具再验installed组合，清理明确缓存，核对所有交付源/metadata/包/manifest/baseline/验证器/业务源码/config/业务版本和新增文件，越界恢复预备字节并manual，不冒称恢复后仍通过原检查。再验最终锁/包和baseline；report.final记录完整文件SHA/模式与tree SHA。项目脚本信任不等于其副作用可无条件批准，未扩展恶意代码沙箱。
- **F2**：移除只取目标baseline的有限patch集合，改用完整current交付与candidate集合并集，涵盖旧baseline独有删除。工具在临时副本实际check/apply和精确vendor替换后，按完整文件集合、字节、mode比较，不只遍历candidate现存项。目标工具/配置baseline删除、当前删改冲突、下一次baseline核验均有回归。
- **F3**：git diff --no-index --no-prefix直接生成所需a/与b/头，不再替换任何正文。涵盖上下文/新增行a/a、b/b、空格文件名、执行模式、二进制vendor替换；每次生成以真实apply与全量等价门禁核验。若git补丁无法表达0600等非执行权限变化，不可直接应用并列patch-equivalence；不假装已经等价。

`delivery.mjs`是新增内部产物模块，将快照/生成文件许可/等价门禁集中；propose仍为产品单一入口。patch验证临时副本不写现用源码，不是新增自动apply命令。合同增补见[upgrade-proposals.md](../specs/upgrade-proposals.md)。

## 最终证据

全部位于`test-results/t26-fix/`。最终工具镜像 **`sha256:4fdd7b1beac86129049147336aa04bbe641a1db109434ee2e3e44cbeb05358d6`**，`source-image.json`核对原7源加新delivery共**8份**upgrade/release工具源与c12e558逐文件SHA一致。后续仅测试驱动/记录改动，不改运行工具。生产API/Web/SQL无变更，无新增迁移。

| 执行 | 结果 | 证据 |
| --- | --- | --- |
| `docker build --target upgrade-tools -t t26-fix-tools .` | exit0 | tools-build.log |
| 最终镜像`node --test tests/upgrade-merge.test.mjs tests/upgrade.test.mjs tests/upgrade-checks.test.mjs tests/release.test.mjs tests/project-interface.test.mjs tests/project-web-server.test.mjs` | **65/65**，原49+16新增，fail/skip/cancel0 | final-image-special.log |
| 最终镜像`npm run typecheck` | API/Web exit0 | typecheck.log |
| 三个版本化repro，旧工具与新工具各运行 | RED→GREEN；晚修改均manual/direct false且恢复目标包可验/业务版本保持；删除后副本无旧baseline，下一提案得到正常unsupported-path而非baseline损坏；literal真实check/apply0且完整文件/模式等价 | *-assert-red.log / *-final.json及stderr |
| `python3 tests/scenarios/t26-fix/real-project-proof.py` | 只读真实T26定制current0.1.0/测试target0.2.0-t26.1，成功exit0，7项真实通过；缺baseline/冲突/语义exit23均exit2且输入不变 | real-project-proof.json/.log，success/missing-baseline/conflict/semantic-failure.stdout/.stderr |
| 最终成功提案的内部patch等价 | passed，**82文件**，patch SHA `055918628c963e3cb03bfd8aa5199dd05d00edc27121dd8ee2ac2865e92b48aa` | proposals/success/report.json |
| 工具外另建一次性完整副本，真实git apply --check/apply + vendor替换 | 全集合、字节、模式=最终candidate=report.final.files；82文件，副本已删 | external-apply.json |
| 最终工具真实readonly输入/writable同源bind alias | exit1、单JSON、无输出目录 | bind-alias.json |
| 原消费者/输入及0.1.0发布前后核对 | 原消费者79、T26输入80文件及mode全不变；正式manifest/两tar SHA不变 | preservation-cleanup.json |

真实成功7步：lock3865ms、install8338、组合46、semantic446、APIbuild164、Webbuild9425、behavior80；使用镜像公共npm cache预热但真实ci，没有复用候选node_modules。新内部最终校验与patch门禁也通过，report.final.treeSha256经工具外对实际candidate重新计算一致。项目业务/API页/config/业务version仍为原定制；target包与旧验收同字节，没有新建或变更测试发布。

## 可复跑与产物

- 三套repro：`docker run --rm --entrypoint node t26-fix-tools tests/scenarios/t26-fix/名称.mjs`。literal最后调整为先验证真实Git错误，再核对新增字段；最终驱动可只读挂到同路径运行，`patch-literal-proof-final.json`即该最终驱动实跑。fixture的API/Web是快速命令，仅测试工具不变量，不冒充真实Next构建。
- 真实项目驱动：上述Python命令，须让proposals各输出不存在（换自有新证据目录或先人工归档），不复用已存在目录。固定只读输入为已保留T26自有非秘密消费者副本与测试发布，不读真实.env。
- **供复核的新产物：`test-results/t26-fix/proposals/success/`**，含candidate、report、changes.patch、vendor-replacements、REVIEW；失败提案也保留。target manifest仍`6554dce775dd8f3ff3dddc93742465fdb6fa63b746d2908393c79809cd938f8c`，明确测试overlay非生产稳定发布。
- 新增16项含late tar/version/scripts/其它依赖/config/business/baseline/verifier/npm lock/新文件10类，旧工具+配置baseline删除/下一baseline，literal真实apply，空格文件名/执行模式，当前删改冲突，正常缓存，非执行权限不等价拒绝。未重复无关SQL身份、105/332/浏览器/生产API/Web镜像矩阵；本轮真实候选Web build是检查范围所需。

## 清理和限制

所有repro容器--rm；工具内部patch/merge临时区finally删除，宿主负例变体/外部应用副本finally删除。候选node_modules/dist/.next/指定tsbuildinfo清理，无DB/卷/凭据/.env/归档/key/Chrome或通知。保留安全新提案与日志供复核。原初审报告、旧T24测试脚本和SQL历史相对本次基线diff为空，git diff --check通过。原0004部署/.env/presentation/Ego31/真人/飞书未操作，T03真实组织人工验收仍pending。

Graph search/trace/snippet覆盖propose/patch及直接源码阅读，改后delivery/propose/checks coverage均metadata_match（Tier2 best effort，非完备证明）；Context7核对Git --no-index/no-prefix与无repo的apply语义。固定Next生成许可针对现有Next16输出，其它生成源需人工处理；未知mode不等价阻断。检查仍为显式信任代码、禁止源内嵌秘密，不声称恶意脚本沙箱或任意项目资产/跨schema路径支持。正常人员Agent/数据库认证包未变，沿用T26/T25实证，不冒称本轮新跑身份验收。
