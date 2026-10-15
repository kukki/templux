# T29 首版候选边界方案

基线 `c02ac42859b7140a5e76f7b4126b18973bbdd84f`。不是对外稳定发布，也不覆盖正式0.1.0或T28隔离0.1.1-t28.1。

## 为什么不能只交旧包

正式0.1.0覆盖T02–T25运行核心；T28受审测试发布在其198项输入上仅加3产品+2发布工具。当前main的运行核心/SQL相对正式0.1无额外变化，Web新增受审可选复制文案；当前骨架还包含T27项目自管check-updates/配置样板/独立Compose三项。T26/T27实际工具在独立 `tools/upgrade`、`tools/updates`，不属于core/Web npm运行包。历史.2/.3包内纯演练标签绝不纳入首版候选。

## 候选构成

1. **源码基线**：固定上述commit，Git archive在全新隔离目录构建；无当前工作区修改、.env、凭据、备份、test-results或.node_modules。
2. **共享组合**：仅将容器内release.config版本overlay为 `0.1.2-t29.1`，声明from `["0.1.0","0.1.1-t28.1"]`。protocol1/config1/schema0010/Node24/Next16不变。源码inventory+overlay单独记录，不把新版本当原commit已有文件。真实npm tar、manifest、complete、项目骨架/vendor/lock/baseline全部生成并校验。
3. **独立工具交付**：同源码标准updates-tools镜像（包含release/upgrade/discovery及受审修正），记录精确image ID、Dockerfile/source/hash；源码包用于本地容器重建。它不是新的共享npm接口，不把工具默认为业务timer或把镜像tag当不可变锁。项目自行以精确image ID启用check-updates，首版不外部registry。
4. **接口与资源清单**：从实际tar package.exports、迁移文件、API路由和项目骨架提取；列T02–T28能力在哪个产物/配置/CLI/源码，以及对应独立审查报告。未在npm中交付的工具明确另列，不能用source.files局部集合代表整套首版。

## 审查映射

- T02–T24核心与运维：现有各切片独立review及T25发布运行包审查；API/SQL逐文件与正式0.1比较。
- T25锁定包/接口：T25 review；T26最终快照/patch等价：T26 review附录；T27调度长周期/锁内限频：T27 review附录。
- 复制文案+SemVer工具：候选4d69b683及d778027独立复核/TL批准；T28最终受益闭环见t28-review。
- 本票只新增交付方案/演练/报告，若发现必须改产品代码，先按问题最小修复并重新绑定来源；不得悄改候选制造通过。

## 平台和剩余边界

实际可用macOS26.6.2 arm64+Docker Desktop Linux arm64。没有可访问Linux宿主或Windows/WSL2环境；Linux容器不是Linux宿主验收。两项平台入口暂列未执行，提供同一隔离驱动复跑步骤并向TL报告，不声称全平台通过。真实Feishu无本人授权仍单列pending。继续完成其余可执行真实集成演练；最终报告保留缺口而不降级父AC。
