# T28 独立最终审查：已审贡献到另一项目受益

## 范围与结论

- 本阶段固定范围：`d778027304d066b0433e020da9295fe931e1cf35..525ce0e54a409a3f66551ff6f1786a58057bb79b`；全票工程基线 `e9f8a9efe250c2eb85a12bc927a7c19f35eeaee1`。
- 同一独立审查者依次执行code-review的Standards/Spec两轴，遵循Team权限，不新增成员。读取#29/#1故事6、ADR0001/0002/0012/0029、贡献合同、候选及F1修复历史、T28最终验收、全阶段9文件差异和6个可复跑场景脚本。
- **Standards：0项发现。Spec：0项新增发现，候选F1保持关闭。建议#29按已确认范围验收。**
- 此结论包含实际本机隔离测试发布和B受益闭环；不代表对外发布、自动合并/部署或任意业务正确性保证。**T03真人飞书组织准入仍pending**，不由密码或复制控件演练替代。

前两轮独立候选结论见[t28-candidate-review.md](t28-candidate-review.md)：三产品改动、默认兼容、异步/会话清理及SemVer修复均已实测。本阶段没有再次修改这些产品或工具源码，沿用22项/APIWeb types/实际组件以及121项独立证据，不冒充本阶段重新全跑。

## Standards

未发现仓库规范违反或有实证的结构性问题。阶段差异限定文档与隔离演练/只读审核脚本；贡献保持显式候选、独立审查、TL批准、隔离发布及接收方副本应用顺序。未增加反向全量同步/自动apply产品入口、模板跨项目写权限、认证/SQL/迁移更改或外部发布动作。

graph按search→trace→snippet核对propose→三方比较/七检查/最终快照/交付等价链；13个证据文件逐项coverage metadata_match，best_effort无记录缺口。直接读取6场景脚本及其调用、实际报告/清单/归档，未由图的无记录推断完整安全性。

## Spec

### 批准、稳定来源与实际包

TL真实批准记录SHA **`a7a76de70dbf9e5aba2a68096fcaec4b57018e6e60df78a079ca8a5ef314a56f`**，绑定候选 `4d69b683f7f1edefef2d6261895de9f368869f5d`、产品patch `26522ef2f42e3c441dcaab5352096d42f92070ed925f5c84e20f431f1bbb2383`、兼容patch `1624c34f7799555a6304f38118f59c34212ee1ebdc5f260c62151c7237974870`、producer `8622e6d0ee5bcc688202352f7f361244c8ffb13443d2782bb0aa559f71eba2ee`。读取记录及既有独立结论，未改批准、未自行重生成版本。

独立核对实际 `test-results/t28/releases/0.1.1-t28.1/`：

| 产物 | SHA256 |
| --- | --- |
| manifest | `9f5b0e2578cc3eb3d7b0d515365e12af43d0c126a04cd5c3d98ade47ef286b06` |
| core tar | `56a1c569f6ea7d1e54d44ffef0b55a924f4f8adc39fa67291fcfad087cd10422` |
| web tar | `1ce068de8570e66d224df190235237e583830d92918b928884a118fd5a3b5005` |

- source.files完整集合恰198项，与正式0.1.0白名单相同；每项等于稳定源SHA或5个受审overlay SHA，source tree SHA重新计算相等，source.commit准确绑定候选。不是整个main树，也未继承.2/.3测试overlay或T27项目样板。
- `upgrade.from`仅0.1.0，complete的version/manifest SHA精确匹配；包名/版本/哈希及受支持组合由真实提案与installed校验再次验证。
- 两tar独立解包，路径集合/文件模式与原正式tar比较；core只变package版本及shared copy helper/type，web另变CopyButton。文件/目录类型合法，无重复归档名称、更新发现/历史演练功能夹带。新共享copy字节与受审bundle相同。
- `.templux/verify.mjs`实际消费落点字节等于受审严格SemVer verifier；build仅producer工具，不在运行tar中。新baseline为目标原始模板，未吸收A/B品牌和业务。
- 原正式0.1.0 manifest及两tar SHA保持；0.1.1-t28.1是本机隔离测试发布，未冒称成为对外正式稳定发行。

### B自主选择、真实提案与副本采用

核对最终开发提案 **`b-upgrade/proposal-verified`**，report SHA **`e4c11788bc0c679b72b3b56f87ea4bbbeb4cbfa475e84fbe5b3a3c6ce5fa4239`**；7检查passed、manual0、directlyApplicable true。未用旧proposal-final替代最终工具来源。采用审阅记录的 `independent:false`准确表明作者审阅，与候选真正独立审查及本报告分开。

本审查者另外创建自有B输入副本，以最终原生镜像 **`sha256:35acb8ff42da6b94dc3cde984b05b68780b641909c84c99f38ee263cd07e347c`** 实际重跑T26提案。目标准确version/manifest、输入/目标readonly挂载、仅输出自有目录、显式trust/behavior。**7项lock/install/combination/semantic/API build/Web build/behavior全部passed，manual0、directtrue，进程退出0**。

随后独立外部 `git apply --check`及实际apply，按精确vendor清单复制新包/只删除指名旧包；完整**82文件集合/SHA/模式**等于本轮candidate和report.final，并重新计算tree SHA为 **`9d6363cbac2709b4f89a74eb5d2b57e51812ee9884468f5e69c6f89fd3fd325d`**，与开发最终交付一致。

应用副本实际容器执行npm ci、installed组合验证、API/Web typecheck、API build、Next production Web build、Meadow业务检查脚本，全部退出0。检查副本业务版本1.0.0、品牌/config/专属greeting与项目源保持；新baseline未把Meadow品牌变成模板默认。原B输入完整字节/模式与project-b-input.json相等，lock/vendor/baseline/业务/config均未写回；A84文件只保留已说明Next生成declaration差异，业务/品牌/配置不回流。

### 页面受益及失败证据

独立启动仅loopback `127.0.0.1:31149` 的自有Web副本；Ego自有空间80实际执行版本化benefit场景：键盘Enter进入英文pending，成功及本地live反馈，恢复原按钮；拒绝后显示Retry code/Copy permission denied，默认共享按钮仍“复制”，原样转交完整` MEADOW-DEMO-0091 `。受控页面writer finally恢复属性，没有读写个人OS剪贴板，不宣称原生权限已通过。

查看开发最终 `b-benefit-browser-final.json` 与实际 `project-b-benefit-final-fallback.png`，与本轮DOM/行为一致。开发Ego截图超时与agent-browser真实截图fallback区别明确；本轮Ego成功，不生成新截图矩阵。开发首次default/具名import错误导致semantic失败，以及未ready启动，均保留为历史失败，未当作验收通过。本轮实际自有提案/应用构建/页面是成功依据。

未启动API或数据库；页面维护状态未知属于准确反馈，不作为维护/登录/SQL身份成功。项目合成贡献演练路由不进入公共包，不是新认证入口；受保护业务greeting代码保留，但本轮未重做无改SQL角色矩阵。

## 独立命令与证据边界

证据根 **`test-results/t28-final-review/`**，本轮只读核验开发证据，所有新输出写此目录/自有临时项目。

| 独立执行 | 结果/文件 |
| --- | --- |
| 发布归档/来源审核 | 版本化release-audit审查副本仅改输出根，`release-audit.json`；额外`artifact-proof.py/json`精确比对批准、198+5、三产物SHA、complete、tar/消费verifier和开发最终report身份，退出0。 |
| 最终所有权/工具来源 | 版本化final-audit审查副本仅改报告输出根，`final-ownership-audit.json`：6个upgrade工具+verify共7文件与最终镜像逐SHA对应；原A/B/正式包保持。 |
| 自有实际提案 | `proposal-command.json`、`proposal.log`，7/7；安全提案保留`proposal/`，原开发提案未修改。 |
| 外部应用及构建 | `apply-build.py`、`application.json`、`applied-build.log`；82文件全等及树SHA相等，实际安装/类型/两端构建/业务脚本退出0。 |
| 最终真实包页面 | `browser.json`：Ego80、自有Web、新包真实页面，英文反馈/默认兼容/完整值通过；受控writer不冒充原生权限。 |
| 语法与卫生 | 6个新增场景直接源码审核，Python fixture内存compile、git diff --check通过；本阶段没有产品源差异。 |

实际npm/构建均在工具容器内。没有重复全部121候选、SQL/身份/无关UI矩阵；既有独立候选证据仅按未改范围沿用，不当作本阶段新实测。来源图、hash及七检查不构成恶意项目代码沙箱，也不保证任意业务/宿主/物理平台全覆盖。

## 清理与验收建议

Ego80 `finish({keep:[]})`完成；自有Web停止并--rm，提案/构建容器已退出，无残留`t28-final-review*`容器。删除自建输入/应用目录（含node_modules/.next/dist/cache），仅安全提案与日志留档，`cleanup.json`记录。未创建DB/卷/密码/token/env或全局任务。

只读核对宿主原有4个运行容器归属：templux的web/api/database与另一个traefik项目的traefik；“4”包含该原有代理，不将其误认本任务资源。未停止、重启、迁移或调整任何非自有服务，也未由数量推断数据库schema。原部署/.env/实际presentation/Ego31/真人/飞书未操作。

**建议#29按本票范围验收**：A真实需求→通用提取→独立候选审查/修复→TL批准→来源受控隔离发布→B自主提案→一次性副本完整应用/构建→真实页面受益已闭合。T03真人验收继续单列pending。报告仅本地提交；不push、不关闭工单、不外发或部署。
