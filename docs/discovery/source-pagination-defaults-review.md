# 三项目分页默认值补充核对

## 范围与证据

在已确认完整分页按钮组、项目可隐藏可选部分及窄屏收纳规则之上补齐默认值，不回退已定界面组合。图定位、调用追踪、精确控件读取及字面量核对完成；以下文件 metadata_match 且未报告覆盖问题，属 best-effort 信号。未进行浏览器分页验收，不以单一页面代表整项目所有列表。

| 来源场景 | 默认每页 | 可选值 | 证据 |
| --- | --- | --- | --- |
| Supplieroom 采购单 | 10 | 10、20、50 | `src/modules/supplier-po/ui/supplier-po-workspace.tsx:140,363–373`；`src/shared/ui/list-pagination.tsx:14–71` |
| Skoope 总览 | 15 | 5、10、15、20、25、50 | `src/components/overview-table.tsx:111,130`；`src/components/overview-pagination.tsx:30–33` |
| Catchouse 通用列表控件 | 20 | 15、20、50 | `prototype/list-ui.js:2–10` |
| Catchouse 看板分页 | 10 | 5、10、15、20 | `prototype/catchouse-app.js:1013–1019` |

Catchouse 两个场景不同，不能称 Catchouse 只有一个默认。其 prototype 控件作为已有代码参考，未在本轮证明生产挂载。默认数量与选项集合是独立维度，本轮不为选定默认数量同时强加某项目选项集合。

## 共通采用

修改每页数量回到第一页（Supplieroom onPageSize、Skoope go(1,newSize)、Catchouse update 中 page=1）。上一页、下一页在边界禁用，不提供可执行的越界翻页。具体 URL/请求处理仍需实施验收，不将 UI 合法范围视为服务端输入校验已完成。

## 明确分歧

默认每页 10、15、20 条均有来源。交 TypeSafe 选择模板默认，允许新项目配置覆盖；选项集合另行选择。新项目定义数据字段及取数实现，不据默认数量承诺加载性能。

## 默认数量决定

用户选择默认每页10条，项目可覆盖。TypeSafe 未自动选择，见 `typesafe-0124.json`。

## 数量选项集合决定

已重新核对上述四处选项字面量及覆盖状态。保持默认10条，候选为 Supplieroom 的10、20、50，Skoope 的5、10、15、20、25、50，以及 Catchouse 看板 prototype 的5、10、15、20。Catchouse 通用列表15、20、50不含10，不能原样配合已确认默认值采用；不自行合成集合。TypeSafe 返回需要澄清77%，无实质方案超过75%，交用户选择，见 `typesafe-0125.json`。项目覆盖时默认值须属于选项集合。

用户选择 B，采用 Skoope 的5、10、15、20、25、50；默认仍为10条，允许项目配置覆盖。

## 跳页控件分歧

再次直接读取四个控件文件并检查覆盖（均 metadata_match、无已记录问题，best-effort）：Skoope `overview-pagination.tsx:23–28` 使用数字输入，表单提交支持 Enter 或跳转按钮；Supplieroom `list-pagination.tsx:29–42` 下拉列出全部合法页码并在选择时调用 onPage。Catchouse `list-ui.js:12–16` 与 `catchouse-app.js:1013–1019` 渲染全页码下拉列表，仅作为 prototype 参考。TypeSafe 倾向下拉56%，未超过75%，用户选择 B，确认默认下拉跳页，见 `typesafe-0126.json`。没有引入来源未提供的按总页数自动切换控件方案，也未宣称已完成输入及服务端校验。
