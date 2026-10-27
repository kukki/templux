# SWY-3 页面元素对齐与桌面/移动端一致性验收

基线 `8b7106e4f2547fd72d2885a118d6a63f64879ec9`。范围为本票描述的全站页面元素对齐、桌面与移动浏览器兼容，以及样式、尺寸、字体和颜色一致性；不新增业务页面或元素行为。

## 实现范围

- `style.css` 集中声明设计令牌：页眉页脚与内容区共用 `--page-gutter`，登录前后页面共用 `--page-padding-block`，字体层级收敛为 `--font-xs` 至 `--font-brand`，访客页宽度保持 `--content-max`。
- 已登录导航、横向导航、页脚与工作区 `main` 全部改用同一组留白令牌；760px 以下垂直留白统一为 30px，水平留白按 `--page-gutter` 收缩（390px 实测为 20px）。
- 审计筛选、管理筛选、账号详情、状态列表、只读表格与审计表格在窄屏按既有滚动/单列规则收敛；管理筛选 420px 以下单列，通用详情列表 480px 以下单列。
- 复选框统一为 20px；统一搜索输入框扣除标签内边距与边框后与外层 44px 控件同高；外链、复制、分页、通知、浮层继续复用 44px 控件高度、6px/10px 圆角与统一焦点环。
- 浮动面板的 `.panel-heading`/`.panel-body` 规则限定在 `.floating-panel` 作用域，避免覆盖状态页 `.panel-heading` 与管理员账号卡片标题。
- 字体大小改用共享令牌，颜色继续只引用 `theme` 写入的 CSS 变量，未新增独立色值。

## 实际验证

本地 Next 开发服务（`next dev -p 3101`，独立 `TEMPLUX_CONFIG_PATH`，API 不可达时按项目既有降级显示）配合系统 Chrome headless 与 CDP 实测 1440×1000、390×844：

| 页面 | 1440 留白 | 390 留白 | 390 页面宽度 | 横向溢出 |
| --- | --- | --- | --- | --- |
| `/` | 页眉/内容/页脚 56px | 20px | 390px | 无 |
| `/login` | 56px | 20px | 390px | 无 |
| `/protected`、`/account`、`/admin`、`/audit` | 56px | 20px | 390px | 无（未登录时按既有重定向/不可用视图） |

实测字体：桌面 `h1` 39px、移动 `h1` 26px、`h2` 17px、按钮/输入 16px；桌面与移动均为单一字体族。状态页 `.panel-heading` 计算样式为 `padding:0`、`border-bottom:0`，未被浮动面板样式污染。`/examples` 在未登录环境不渲染示例实验页，未将其计入上述结果。

静态与单元验证：

```sh
npm run typecheck                 # API/Web exit 0
npm run build -w @templux/api     # 需先生成 dist，供管理配置检查测试使用
NODE_ENV=production npm run build -w @templux/web  # Node 24，9 个动态路由构建成功
node --test tests/navigation.test.mjs tests/overlays.test.mjs tests/ui-consistency.test.mjs  # 35/35 pass
node --test tests/ui-consistency.test.mjs  # 4/4 pass，含令牌、留白与面板作用域回归
```

所有 CSS 文件用 PostCSS 解析通过。完整 `npm test` 中依赖容器认证数据库与真实服务的用例不会在宿主机上降级运行，需在项目既有的授权测试环境中执行。

## 平台与已知限制

- 宿主机 Node 为 25.8.1，项目要求 `>=24 <25`。使用 Node 24.22.1 且显式设置 `NODE_ENV=production` 时，`next build --webpack` 可完成构建；若 shell 预先导出 `NODE_ENV=development`，Next 会警告并在 `/` 预渲染阶段报 `Cannot read properties of undefined (reading 'length')`。该现象在干净基线与本次改动上一致，属于调用环境变量问题，非本票回归。仓库未修改构建脚本，以免引入跨平台 shell 差异。
- 完整测试套件中 31 个依赖容器认证数据库、Docker/备份或已部署服务的用例在宿主机不可用；相关测试会主动拒绝回退到生产数据库。本票只在宿主机运行 UI/类型检查与三组相关测试。
- 未使用真实飞书账号或 Agent 会话登录，因此已登录工作区的浏览器实测仅覆盖共享样式与静态结构；未重复真实身份授权、数据库或部署验收。
- 未新增或修改业务接口、权限、配置合同或元素交互行为。
