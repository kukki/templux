# #31/#32 新项目消费候选方案（待 TL 核对后生成）

## 精确来源

- 基线：`77c73c73acf1516261d283c7326e0cab0205c8e8`。
- 实现源码：`59ad67bbdddf888d705b7e5de12388f9d035bbe6`，含configured设置保留显式空拒绝的修订；逐文件SHA见 `test-results/domain-environment/candidate-source.json`。
- 新本机测试版本：`0.1.3-domain.1`，不覆盖任何正式0.1或T29/T28产物，不发布registry。
- 唯一源码overlay：`release.config.json` 的version变为上述版本；文件SHA `22ca0e1cad60e5e34d1119279fcfde974caee3742d877905e8d2269c8540aea8`，文件为 `test-results/domain-environment/release-overlay.json`。compatibility protocol/config/schema/Node/Next保持原值。
- 不声明 upgrade.from；本轮只验证新项目消费，不制造旧项目可自动采用新必填环境合同的声明。

## 变更映射与所有权

- core/web 同一版本包新增environment / environment-cli / environment-startup公开模块，现有认证/授权/会话/审计/SQL无实现修改。
- Root与project-template有明确Traefik overlay、entry:8080标签、APP_HOST/根域及既有外部网络；独立完整项目含.env.example元数据、环境容器入口、API/Web预载与相同wrapper/内部编排选择。
- release工具明确仅允许示例.env.example进产物，真实.env/.env其它变体仍排除；原产物不重建。
- 项目仍拥有品牌/config/业务/环境真实值；模板拥有公共环境核心合同和骨架；未知.env项目键只告警，不回流业务或秘密。不是把旧锁定包伪称含新功能。

## 有界产物和验证

按上述commit归档源码到独占目录，只覆盖明确版本文件；构建同源标准release-tools，运行原release build（types/接口门禁、npm pack、校验组合、固定锁及baseline）。记录归档、overlay、manifest、两tar、exports、示例及Docker资源SHA。

新项目从该产物复制，在自有目录填写合成环境；用真实容器确认核心模块exports与Web/API独立构建、env-check/env-list/启动拒绝及可选为空，与正式新骨架域名render。真实根模板域名/SQL/维护/跨项目已另外验证，不重复整个SQL/517/平台矩阵；若新消费层暴露缺陷先报告并修正绑定，不混入已审源码。

本候选只为本机隔离验证，不是稳定正式发布、生产上线或用户Ubuntu主机验收。Ubuntu/真实wildcardTLS/真人Feishu仍pending；完成后清理消费者.env/凭据/容器/网络，保留安全vendor/报告。

## F1后续新候选方案（不覆盖59ad/.1）

独立窄核报告 `d1b4efc7db1b6eecd5f5c0ebcbffe4f60b0e65c6` 指出公开示例与升级过滤的交互；原报告/59ad产物/消费证据保留。修复源码 `412d1c759f75cd93f8bb81b56d11c5360407ca0c`：保持generic secret保守，仅在明确公开模板路径语境贯通baseline/catalog/list/复制/模板所有权，新增根compose.traefik.yaml所有权；补PROJECT与实际Compose标识不一致时拒绝，避免`-p`或COMPOSE_PROJECT_NAME错配内部管理项目。当前环境+路径52专项通过，修复前工具点174相关/types通过，完整真实合法from提案尚待新产物执行。

新生成仅使用 `test-results/domain-environment/v2/` 独占空间及上述commit归档，精确计划 `v2/plan.json`：

| 产物 | overlay文件 | SHA256 |
| --- | --- | --- |
| 新消费 `0.1.3-domain.2`，无from | current-release.json | `8514a74a6de6cc56028ff6bab835f112ebfe4a00894aa981fcff383619bff11e` |
| 合法同合同测试目标 `0.1.4-domain.1`，from仅domain.2 | target-release.json | `41c8af915ad42444aab1fdd040377574b2ae6d16dd8e89948847c6471cc671be` |
| 目标公开默认实际变更，heartbeat30→45 | target-root.env.example | `7639e9122cd1df2f257db4f873965d84ff2f96b7a2d2c1948b2f4d7ee72adfd8` |
| 同一目标project-template公开示例 | target-project.env.example | `7cdd2ac28b3dae86a001e817124ef18cffacf6899c986fcb5ebdb55d79d06ab9` |

当前候选只改release.config版本；测试目标再改其明确from和两份公开示例默认，核心环境元数据/SQL/身份规则完全相同。目标不是仅改版本号，也不从真实.env回填。两产物均为本机测试，无对外稳定发布/registry/生产部署。无from旧路径拒绝控制与同合同合法边成功分别验证，不宽放真实环境文件。

验证：domain.2新项目实际容器启动；domain.2→目标的真实propose/catalog/discovery、三方非重叠公开定制保留/冲突/删除人工、完整patch+vendor外部应用字节/mode等价及必要构建。私有.env/变体/秘密目录/符号链接不能进入候选、patch或catalog；最后一次性副本保留真实配置字节，不在活项目apply。

## 最终权限修订候选v3（待核对生成；v1/v2不覆盖）

Ubuntu UID/0600差异不能由macOS绑定映射替代。`b9d7b96`加受控诊断root；进一步固定最终源码 `d9b866851104e770724620fa1fe3e88fe44b36e5`：只读绑定.env/.env.example两个文件、禁止自动创建宿主路径，无privileged/socket/hostfs；应用仍非root，只绑定公开示例并检查有效环境。host env-check/list对缺失/非普通配置给单JSON。Linux tmpfs实证1001:1001/0600：应用UID1000读私有文件拒绝，root诊断可读，应用只用公开示例/环境投影可预载。

`test-results/domain-environment/v3/plan.json` 固定上述source：

- 当前 `0.1.3-domain.3`无from；`current-release.json` SHA `3042c49c053db78a386a99f0e7559edf3b6a82bea2d098a35e3a9a8a55c1f057`。
- 同合同测试目标 `0.1.4-domain.2`仅from domain.3；`target-release.json` SHA `82265f9a9c9198142cf6c34dc359c26016149a456f8bf1617107bc727f8ec62c`。
- 目标两个公开heartbeat30→45 overlay仍分别 `7639e9122cd1df2f257db4f873965d84ff2f96b7a2d2c1948b2f4d7ee72adfd8` / `7cdd2ac28b3dae86a001e817124ef18cffacf6899c986fcb5ebdb55d79d06ab9`。

沿相同exclusive生成/检查步骤，不复用先前版本标签伪称新权限修订；新consumer实际API/Web/entry、失败门禁和短命root/非root角色均重新实测。v2合法边七场景及211相关/types按412d单列，最终source不机械重复无关SQL/517。所有旧包、归档、实际部署保持。

最终v3尚未生成时补一行管理JSON错误合同：`29ce8e79288a74571e5a9b57dd23af7b930e7791`仅在management预载失败且--json时输出一个脱敏错误JSON，再非零退出；新增真实容器RED→GREEN，配置/容器场景11通过。v3/plan.json改绑此source，版本及四overlay保持，不覆盖任何既有产物。

> 后续变更（模板单文件Traefik化）：`compose.traefik.yaml`已合并进`compose.yaml`并删除，本地回环模式与`TEMPLUX_TRAEFIK`/`TEMPLUX_ACCESS_MODE`开关移除。本文关于overlay所有权与local/traefik选择的记录为变更前的历史计划，保留备查；现行合同见 [域名与环境](../specs/domain-and-environment.md)。
