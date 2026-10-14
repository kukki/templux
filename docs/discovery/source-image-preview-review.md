# 三项目图片预览控件补充核对

## 范围与证据

只提取现有图片预览交互，不统一业务图片来源、上传、删除、留存或供应商产品字段。图定位、相关方向调用追踪、精确符号读取与文件覆盖已完成；下列文件均 metadata_match、未报告覆盖问题，为 best-effort 信号。未运行浏览器，不宣称全部图片入口统一或完成焦点陷阱、触屏验收。

| 来源 | 控件及文件 | 已核对行为 |
| --- | --- | --- |
| Supplieroom | `ImagePreviewDialog`，`src/shared/ui/image-preview-dialog.tsx:6–56` | 单 `src/alt`，关闭按钮、遮罩、Escape，关闭恢复先前焦点；本控件没有自定义加载失败状态 |
| Skoope | `SkuProductImage`，`src/components/sku-detail-interactions.tsx:27–51` | 单张产品图；primary 失败后切换 fallback，不是用户翻页的图库；全部候选失效后占位。dialog 关闭恢复 opener 焦点 |
| Catchouse | `prototype/catchouse-app.js`，`taskImageLayer:479–484`、`openTaskImages:485–491`、`closeTaskImages:492–500`、`moveTaskImage:501–510` | 图片组、上一张下一张、当前/总数、边界禁用，切图重置缩放平移，关闭恢复触发控件；`mediaFrame:460–463` 有加载与失败重试显示 |

Catchouse 来自现存 prototype 路径控件，作为复用证据，不在本轮声称核实生产挂载。其业务上下文、照片选择与批次状态不照搬模板。只借用共通交互和明确可选能力。

## 共通采用

关闭图片预览后将焦点恢复到打开预览的控件（仍存在且可聚焦时）。不将这一点等同已完成完整模态焦点管理。

## 需选择的来源分歧

- 图片组：Supplieroom/Skoope 所查控件单张预览；Catchouse 有数组图库切换。若纳入模板，按既定按需复用原则作为项目可选变体，不要求项目必须传图片组。
- 加载失败：Supplieroom 所查预览控件原生图片行为，Skoope 自动尝试备选并占位，Catchouse 显示错误和重试。该项后续只从实际方案中选择。

## 图片组决定及失败重试补充

TypeSafe 图片组可选方案 93%，单图首版 5%，需要澄清 2%，按授权采用，见 `typesafe-0120.json`。项目不传列表时保留单图，不照搬业务图库字段。

Catchouse 重试不只静态按钮：`prototype/catchouse-app.js:2082` 清除对应 URL 错误标记并重绘；`2191–2201` 监听图片加载/错误，更新加载指示及错误状态。本轮只核对代码，不宣称重试能保证网络恢复或加载成功。

## 图片失败决定

用户选择 Skoope 的自动备选后占位方式，候选全失效不打开预览，默认无重试按钮；可选备选地址与图库组项分离。TypeSafe 原始 A 6%、B 16%、C 45%、需要澄清 33%，由用户选择 B，见 `typesafe-0121.json`。
