# T29 前置独立核对：首版候选来源与能力边界

## 输入与结论

本次是窄前置方案审查，**不是#30或父#1最终验收**，不生成发布。固定代码点 `c02ac42859b7140a5e76f7b4126b18973bbdd84f`；方案输入 `docs/discovery/t29-candidate-plan.md` SHA256 **`0ded7d9cce3b3c5fa661864ee08b4df8d1b852211c22a53150dcaf5f1a5dbd5c`**。开发同时执行后续工作，本审查仅拥有本报告，未修改其方案/计划/实现。

按code-review同一独立审查者依次两轴，依据#30/#1、首版专题合同及既有独立审查：**Standards 0项，Spec 0项发现。允许按该固定方案继续本机生成隔离候选。** 这不表示候选产物、完整矩阵或任何尚未执行的平台已经通过。

## Standards

未发现规范违背。方案分别列共享运行包、项目骨架、独立发布/升级/发现工具及完整源码；精确版本/image/hash、人工审查与项目所有权边界明确。沿用既有修复，不通过重写生产逻辑补验收；计划保留未执行项，不将已有切片通过等同父票完成。

graph search→trace→snippet核对checkUpdates的CLI/schedule、来源验证、累计propose及最终交付依赖；11个证据代码/配置路径coverage均metadata_match、best_effort无记录缺口，并直接读取Dockerfile、CLI/launcher/Compose/配置及构建拷贝/exports规则。固定版本比较使用Git对象而非并发工作区内容；未用结构图的缺失推断功能不存在。

## Spec：来源完整集合核对

正式0.1.0来源 `66aa7c2d3f5f4fd921837e9804c4fc1d9cbb0bfa`，manifest `bbf6ad9941a784e1301129a067698a79ff23cf2b8b81801582add184ec60c5dc`。对release build选定的完整scope（apps/api/src、apps/web、shared、config、database、tools/release、project-template）读取固定Git树，比较**并集**而非交集：

| 项目 | 独立结果 |
| --- | --- |
| 正式source.files | 198项 |
| 固定候选选定源码集合 | 201项 |
| 修改 | 恰5：shared/copy.mjs、shared/copy.d.mts、apps/web/app/components/elements/copy-button.tsx、tools/release/build.mjs、tools/release/verify.mjs |
| 新增 | 恰3：project-template/check-updates、project-template/config/updates.example.json、project-template/tools/updates.compose.yaml |
| 删除/额外项 | 0；没有仅比共有项而漏新增 |
| 原跟踪文件模式变化 | 0；新增launcher为100755，两个配置/Compose为100644 |
| API/SQL完整目录 | `git diff 66aa7c2 c02ac42 -- apps/api database`为空，涵盖所选API/src之外的包/构建配置等文件 |

因此所选发布输入相对正式0.1.0确为**3已审产品+2已审发布工具+3已审T27骨架，共8项差异**；其余共享/配置/Web资产也在完整集合比较内，没有历史.2/.3标签/API接口/额外SVG混入。当前release.config仍为0.1.0及既定组合；新version/from仅拟在容器内overlay并另记来源。

证据 `test-results/t29-plan-review/source-inventory.json`（201项完整SHA清单）、`modes-plan.json`（Git模式和方案hash）。未编译或生成任何0.1.2-t29.1产物。

## 全套能力及独立工具

“8项”仅指上述共享发布source.files局部scope，**不代表整套交付只有8项变化**。固定Dockerfile相对正式源另增upgrade-tools/updates-tools阶段；另有6个tools/upgrade模块、9个tools/updates模块。方案已将这些单独列入工具/完整源码交付，未把source.files当整交付库存。

| 能力 | 应交付落点及审查依据 |
| --- | --- |
| T02配置、T03–T08认证/身份/会话/授权 | core编译模块+shared/config，Web真实页面/代理；T25运行包与各切片独立审查，T03真人链路另列 |
| T09审计/日志、T21维护、T22–T24备份恢复/迁移升级 | core运行模块、database/0010及管理/迁移/入口导出；项目templux/Compose/标准Docker targets和容器PG/Docker工具；API/SQL无漂移 |
| T10–T20控件、导航和可移除示例 | Web源码/元素/状态类型/config/真实资产与显式exports；复制文案沿T28已审三文件，无业务内容反向同步 |
| T25共享发布/组合锁 | 两tar、manifest/complete、project/vendor/lock/pristine baseline、消费.templux/verify.mjs及producer源码 |
| T26提案与T27发现/调度/累计 | 独立标准updates-tools镜像及tools/release、tools/upgrade、tools/updates源码；不是core/Web运行npm接口，也不在业务进程增加timer |
| T28经审查反哺 | 贡献合同、独立候选审查/修复与真实A→发布→B证据；本票继续精确绑定，不自动全量同步或发布 |

Docker继承为checks→release-tools→upgrade-tools→updates-tools，source阶段COPY tools和project-template；最终updates镜像具备Node/npm、Git及三组源码。默认ENTRYPOINT是updates CLI（check/catalog/schedule/TTY菜单），运行提案CLI或release producer须显式覆盖entrypoint，不把“包含源码”误称所有动作都由默认CLI子命令暴露。方案交付完整源码可本机构建，未来须绑定实际Dockerfile/source/镜像ID，而非便捷tag。

project launcher静态核对：固定image ID/digest格式、外置existing state/output、项目config/updates.json、readonly当前源/可选来源、token只传env名字；三骨架样板缺省不启动业务定时器。配置默认86400、信任项目脚本false、无预选目标；隔离预发布0.1.2-t29.1的演练须项目显式允许prerelease并选择准确目标，不能把关闭预发布的默认样板误判无能力。可用性沿既有T27独立实际入口/调度证据；新的T29镜像和artifact-only项目入口仍需后续实测，非本轮新结果。

## 方案可继续与后续产物必验点

拟容器内版本 **0.1.2-t29.1**、from **[0.1.0, 0.1.1-t28.1]** 与当前准确版本语法/路径合同相容；protocol1/config1/schema0010/Node24/Next16不变，固定API公开接口没有额外漂移。完整源码Git archive应固定c02ac42，排除运行.env/凭据/日志/缓存；已跟踪tests可以保留为交付测试来源，不混同生产fixture路由。原正式产物及T28演练产物不覆盖，不外部发布。

后续需实际核验，当前不预判为通过：

1. archive完整库存/模式/源码commit、干净输入、容器metadata overlay与编译输出来源；实际tar成员/exports/资产/SQL及新201项source inventory，对照本次清单。
2. 两包版本/manifest/SHA/SHA512、complete、vendor/lock/pristine baseline、两条from边；与原0.1/.1库存不变证明；API/Web独立构建、准确支持组合及installed门禁。
3. 最终独立updates-tools真实image ID、三工具源码hash、Dockerfile和完整源码bundle绑定；实际项目launcher、配置/来源、菜单/一行入口与受控有限调度，不能只交运行tar而漏工具。
4. #30/父#1完整验收矩阵：隔离新项目/真实授权登录、恢复后旧会话失效与重登、带定制升级/冲突/缺baseline、控件/主题/方向/视口截图及示例移除；复用旧证据时记录精确版本/未改范围，新实测与历史证据分开。
5. macOS为实际可用宿主；Linux宿主和Windows/WSL2当前无可访问环境，必须保持待验收，Docker Linux容器不能代替宿主验证。T03真人飞书仍pending，不能批准父#1完成或关闭T03。

## 操作边界

本轮仅Git/源码/清单/方案只读比较与报告，未启动容器、DB、浏览器、发布或全局任务；没有更改原部署/.env/现用presentation/Ego31/真人/飞书。没有机械重跑121/SQL/UI。忽略目录仅保留非秘密清单证据，无临时运行资源需清理。提交前核对索引归属，仅提交本报告，开发并发未跟踪方案/计划不夹带。

最终结论限于上述固定方案可继续**本机隔离候选生成**；实际产物、最终#30及父#1仍须按证据与平台缺口独立判定。无push、关票或部署。
