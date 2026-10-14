# 三项目无匹配结果提示核对

范围为列表成功查询但无匹配记录，不能把认证失败、权限不足、数据源未接入或查询错误当作普通空结果。图搜索找到 SupplierPoWorkspace、OverviewTable、renderDashboard，入向分别追踪到 PurchaseOrdersPage、HomePage 及 loadDashboard/renderCurrentView/suggestDashboard 等 prototype 调用；长函数 snippet 截断处通过直接源码读取补齐相关渲染分支。三个证据文件覆盖检查均 metadata_match、无已记录问题，属于 best-effort 信号。未执行浏览器验收，不概括所有列表。

| 来源 | 证据 | 已查行为 |
| --- | --- | --- |
| Supplieroom 采购单 | `src/modules/supplier-po/ui/supplier-po-workspace.tsx:333–373` | 无结果标题加清除搜索或切换状态的说明；加载和错误独立分支；搜索筛选保留，分页在分支外。该列表为卡片，不作为表格表头的比较证据。 |
| Skoope 总览 | `src/components/overview-table.tsx:144–178` | 无结果一句文字，搜索筛选及分页保留；表格仅在有记录时渲染；权限不足和数据源未接入各有独立分支。 |
| Catchouse 看板 prototype | `prototype/catchouse-app.js:1020–1038` | 桌面及移动区域无结果标题加调整搜索筛选的说明；桌面保留表头，空提示置于跨列单元格；搜索筛选及分页保留。未证明生产接入。 |

共通采用：无匹配时在结果区域明确提示，保留搜索筛选以便调整，不自动清空条件；普通空结果保留分页位置及数量设置入口，沿用既定页码边界规则。不同错误状态仍须由项目正确传入，未声称三个项目全链路都已区分所有状态。

提示层次按授权自动采用标题加简短说明，TypeSafe 该选项85% > 75%，见 `typesafe-0127.json`。项目可覆盖文案及形式，不复制采购单或货件字段等业务词，不增加固定业务操作或插图。

表头行为存在分歧：Skoope 无匹配时不渲染表格及表头，Catchouse prototype 保留表头及跨列空提示；Supplieroom 卡片列表对此不提供可比依据。

TypeSafe 对表头结构返回需要澄清56%、隐藏43%、保留1%，未自动采用；用户选择 A，确认保留表头、在表体跨列显示空提示，见 `typesafe-0128.json`。不把之前提示层次的85%结果延伸到表头结构。
