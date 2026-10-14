# 三项目通用代码值复制控件核对

## 范围与证据

仅核对通用代码值/标识复制按钮，不统一所有业务复制动作或凭据交付，不选择剪贴板底层兼容 API。使用图定位、调用追踪、精确符号及源码读取；下列文件 metadata_match，未报告覆盖问题。未运行浏览器或剪贴板权限场景，不宣称全部入口一致。

| 来源 | 证据 | 成功反馈 | 失败行为 |
| --- | --- | --- | --- |
| Supplieroom | `src/shared/ui/copy-button.tsx:7–37`，9 个图中调用方 | 完成复制后改 check 图标、title 与辅助文字，约 1500ms 后恢复；空值无按钮 | catch 后直接返回，无额外失败状态 |
| Skoope | `src/components/sku-detail-interactions.tsx:8–25`；`src/components/overview-product-identity.tsx:21–34,55` | 本地 copied/check、辅助状态，约 1800ms；视觉截断 SKU 时传入完整值 | 设置 error，按钮 title 或 aria-live 提示复制失败；不是独立可见错误弹窗 |
| Catchouse | `prototype/catchouse-app.js:953–958,2027–2040` | 看板代码复制本地 check，约 900ms；空文本无按钮 | `copyText` 抛错进入统一点击处理 catch，`2130` 附近 setError/friendlyError 并重绘当前页面 |

Catchouse 来自现存 prototype 控件，作为复用参考，不宣称验证生产挂载。Catchouse 的查询 ID、凭据等其它复制路径有不同反馈，本题不据看板代码按钮概括它们。

## 共通采用

- 空值不提供可用复制按钮（可按项目变体隐藏或禁用）。
- 复制项目传入的完整目标值，不使用视觉截断结果；不把业务 ID 的 trim 等规则强加所有文本。
- 只有复制操作成功才显示成功状态；在原按钮短暂切换确认图标/提示，再恢复。
- 提供可识别的按钮名称，复制交互不与表格编辑混同。提示时长和点击热区的具体设计参数另定。

## 明确分歧

失败静默、按钮提示/辅助状态、页面统一错误处理是三种现有做法，交 TypeSafe 选择默认。只选反馈范围，不改复制值或密码交付，不引入新的弹窗或混合方案。

## 失败反馈决定

TypeSafe `typesafe-0122.json`：本地反馈 83%、静默 1%、页面处理 0%、需要澄清 16%，按授权采用控件本地反馈。

## 成功提示时长的来源默认

Supplieroom setTimeout 1500ms，Skoope setTimeout 1800ms；Catchouse copiedUntil=now+900ms、清理定时器950ms，约1秒，不将900ms称作浏览器精确显示承诺。均短暂确认后恢复，模板精确默认可配置，计时不保证浏览器后台精确调度。

## 成功时长决定

用户选择 Supplieroom 默认约1.5秒，项目可配置。TypeSafe 未自动选择，见 `typesafe-0123.json`。
