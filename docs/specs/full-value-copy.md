# 完整值复制与本地反馈

T18/#19、父规格故事90。共享`shared/copy`控制反馈代次，React `CopyButton`和原生`clipboard`适配器负责用户操作；examples仅合成数据，不反向进入共享能力。

## 采用

```tsx
<CopyButton value={completeValue} label="复制订单编号" settings={elements.copy}/>
```

`value`只接受string/null/undefined。空定义为null、undefined或长度0字符串；`' '`、制表符、换行与首尾空白都是项目原值，不trim。数字/布尔/对象拒绝隐式转换；需要复制数字0时项目明确传`String(0)`，业务格式化也由项目负责。组件不从子节点、可视文本、选区或省略号猜测目标。显式label为非空≤200字符的可识别操作名称，不应含密码等敏感内容。

按钮不显示目标；项目如需展示预览自行提供，视觉ellipsis与value互不影响。默认空值按钮disabled，可选hide；隐藏时无可操作入口。非空按钮始终`type="button"`，只按钮点击或原生Enter/Space触发；click默认/冒泡被阻止，键盘Enter/Space不冒泡，避免常见行点击及表单提交。不能嵌套在链接或其它按钮内；父级capture监听须排除交互控件，子组件不能撤销已执行的父capture副作用。展示文本/行空白不是复制热区，不接管整行。

## 兼容与结果

默认适配器在真实点击处理内直接调用`navigator.clipboard.writeText(value)`，不先await权限查询，保留浏览器瞬时激活。只支持安全上下文（HTTPS及浏览器认可的localhost等）；缺API/不安全上下文为unsupported，NotAllowedError为denied，其它异常为failed。各浏览器对激活、焦点、Permissions Policy及权限支持不同，不能保证后台或未聚焦页面复制。无需剪贴板读权限；生产不读取已有剪贴板。

协议按2026-10-15 Context7核对[MDN Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API)及[writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText)。

不使用已弃用execCommand/隐藏textarea或绕过权限的fallback。失败只提示当前按钮与邻近polite live状态，可再次尝试；不显示异常文本/目标、不默认发全局通知。项目可传`write:(value:string)=>Promise<void>`适配其它平台，必须在真实复制确认后才resolve，失败reject合适分类；不得用假成功适配器替代平台结果。示例“演示复制被拒绝”只模拟拒绝，不模拟成功，和真实权限拒绝证据分开。

idle点击后pending并禁用重复写，API resolve后才copied；成功原按钮“已复制”，默认1500ms后恢复，后台浏览器不承诺精确到毫秒。成功期间再点是一次新的明确复制；新尝试清除前一次timer。失败消息保留至重试或目标变化，不自动声称成功。读屏通过局部role=status播报，ARIA名称保留操作名称，反馈不嵌目标。

## 异步、身份与隐私

每个value/label/设置/write函数绑定一个实例；这些依赖改变时新实例idle，旧实例清理代次和timer。pending的晚成功/失败、旧timer不能修改新目标或已卸载控件。组件内部常规重渲染不重置反馈；适配器应是稳定函数。StrictMode setup/cleanup可重复，cleanup invalidate而非永久结束新挂载。

`templux:session-ending`无条件end并移除按钮/反馈；已结束实例不允许新复制，晚结果不能恢复。原生OS复制一旦发出不能撤回：更换目标/取消页面/权限失效会阻止旧UI反馈，但不能保证取消浏览器/OS尚在完成的写入，也不自动清空用户剪贴板。没有自动复制、自动重试、自动清理剪贴板或持久复制历史。

控制器snapshot只含状态/empty/hidden/ended，不含原值或异常；不输出日志、URL、storage或DOM属性中的目标。值只在调用者props/实例内存和指定平台写操作中存在。此控件不是凭据交付通道，未接入登录关联下载/密码重置界面：人员单次no-store交付及CLI/Agent0600、拒覆盖和不打印规则继续按[登录方式合同](login-methods.md)执行。示例不含真实密码、Agent凭据或业务数据。

## 配置及移除

`elements.copy`默认`{feedbackMs:1500,emptyMode:'disable'}`，whole branch缺省兼容schema1旧文件；显式null/空对象/不完整/未知字段/错误类型拒绝。feedbackMs须100–60000整数，emptyMode仅hide/disable。`CopyButton.settings`可以项目显式覆盖，计时范围和空值枚举仍校验；完整呈现配置另执行上述严格字段校验。既有配置载入快照/重启合同保持，实际presentation本票不修改。

受保护/examples的短/长/空值和拒绝开关均纯内存/合成文本；刷新/重置清除演示状态。复制按钮不授予业务权限，不增业务API/SQL。物理移除examples及其copy后共享组件与正常登录/管理不依赖该模块。
