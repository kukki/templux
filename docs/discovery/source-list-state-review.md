# 列表排序及分页状态保存核对

本轮仅比较排序、页码、每页数量三项通用状态，不决定搜索词、业务筛选或跨设备偏好保存。沿用本轮已检查覆盖的三个文件，均 metadata_match、无已记录问题，属于 best-effort 信号；未进行刷新或历史导航的浏览器验收。

| 来源 | 证据 | 已查行为 |
| --- | --- | --- |
| Supplieroom 采购单 | `src/modules/supplier-po/ui/supplier-po-workspace.tsx:134–140,153–166` | 从页面地址读取 sort/page/pageSize，状态改变后 replaceState 写回页面地址。 |
| Skoope 总览 | `src/components/overview-table.tsx:108–131` | 从 query 初始化三项状态，update 以 replaceState 写页面地址，popstate 读取参数。 |
| Catchouse 看板 prototype | `prototype/catchouse-app.js:5,54–59,74–77,784–793,1039–1052,2001` | 看板三项在 state 中；readRoute 的 dashboard 分支不恢复这些参数，routePath 的 dashboard 分支仅输出 /dashboard。dashboardQueryUrl 把状态作为 API 查询参数，不能视为页面地址保存。仅限所查看板，不概括其它页面，未证明生产接入。 |

此前已定位并读取相关列表函数；新增图搜索定位 readRoute/routePath/dashboardQueryUrl，readRoute 入向包含 initialize/restoreRoute 等，dashboardQueryUrl 入向为 loadDashboard，精确 snippet 与源码补读核对路由及请求用途。

按授权采用页面地址参数方案，TypeSafe 92% > 75%，见 `typesafe-0131.json`：三项有效状态写入地址参数，刷新恢复，调整替换当前历史条目而非每次新增。项目可配置其它形式；参数需校验，地址不授予数据访问权限。搜索词和业务筛选保存策略另定，不把此结果扩展至它们。

用户随后明确回复“确定”，再次确认上述默认规则及项目可配置覆盖的约定；保留原始 TypeSafe 记录，不改写其概率。
