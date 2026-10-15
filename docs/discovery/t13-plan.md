# T13 分页、排序与刷新恢复计划

基线d5774ea25a145bc7589d215923522f5ccddd42d9，#14/#1、ADR0012/0013及T11/T12合同；同一开发者自主实施，TL另排独立审查。

## 设计

- shared/list-state纯函数：parseListState(params,settings,fields,total=null)、writeListState(href,state)、cycleSort、orderRows；page/pageSize/sort三参数严格校验/规范化，基础排序和可排序字段比较器由采用者显式提供。成功总数校正页码，空结果页1/总页1；总数未确定不以0覆盖已有页码。
- 受控Pagination提供总数、位置、首页/上页/页码组/下页/末页、数量及合法页码下拉；桌面完整，窄屏上/位置/下直接，其余details展开。新增pagination.controls五个布尔可隐藏可选部分，旧分支缺controls补默认，显式非法拒绝；10与5/10/15/20/25/50不变。
- PagedList为SearchList可选view呈现适配，接收完整获授权读取结果，不新增业务API/服务端分页协议。Next useSearchParams读取三项，原生replaceState保留其它参数/hash和历史，不保存搜索/筛选。单字段sort下拉及可排序表头同步，升/降/基础三态；排序/大小回1。ReadonlyTable不提供编辑。
- 示例扩为53条独立合成记录，保留既有三条/字段，提供53/12/0数据量情景验证页码收缩。排序仅名称/编号，基础稳定ID次序；搜索和分类仍在完整结果中先处理。重置恢复合成数据/输入，URL三项偏好仍按明确持久合同恢复。

## 执行与验收

1. 先写tests/list-state.test.mjs：非法/重复/极大参数、空/收缩页、配置兼容与invalid、稳定三态、地址只改三项和保留hash。红→纯语义/配置实现→绿。
2. 实施Pagination/PagedList/ReadonlyTable头部与SearchList可选view，沿品牌变量和原生键盘；现有无view消费者不变。默认/覆盖、可选隐藏、桌面/390px验证。
3. 正常隔离0008真实CLI/HTTP/密码浏览器；分页全入口/边界/大小、排序同步三态、replace/history/刷新/非法URL/数据收缩、搜索筛选异步与T12双计时边界。适当专项/typecheck/完整suite，记录精确源码点，不拿旧全套冒充最终。
4. 保留原0004/.env/presentation/真人/Ego31，不迁移原库；清理本票空间/工具容器/受限凭据，记录证据/平台局限，本地提交不push/关闭工单。

## Review Focus

- 初次总数未知不把恢复的末页提前重置：逻辑null-total与生产刷新验证。
- 非法/重复/越界参数不能与实际页/排序分歧：解析/规范化单测和真实地址验证。
- 相等排序值须有稳定基础次序且不改原数组：比较器/三态单测。
- 数据减少/空/错误不能混用总数：纯边界和真实情景验证。
- 新呈现适配不破坏400/1000等待及旧请求拒绝：T12组件专项保留/适当定向复验。
