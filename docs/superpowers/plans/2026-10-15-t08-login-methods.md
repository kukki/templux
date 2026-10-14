# T08 已验证登录方式关联与人员随机重置

基线cdf61c6；Gitea #9/#1及ADR0024，TL授权在既定范围内自主选择。

1. 管理员网页或受信宿主CLI创建15分钟请求，固定person目标/auth_version及方式；不合并账户。启用密码需已有当前Feishu身份且无已启用密码；姓名/邮箱不作为证据。
2. 目标本人通过正常登录（5分钟内）证明所有权：启用密码为fresh Feishu正常会话；关联Feishu为fresh password正常会话+请求绑定一次性OAuth state/browser。后端验证组织及identity唯一性后仅标记verified，最终仍需当前有效管理员确认。
3. Web/CLI共享锁内操作者/目标/版本/请求校验、同事务审计/失效；person随机reset不改变状态/角色、保留方法enabled状态，旧Feishu/pwd都失效；Agent reset CLI原0600文件语义保持。T07失败限制不清除。
4. CLI敏感值只写指定新0600文件；Web他人新密码只在本次no-store成功响应触发JSON下载、不复取，提示私有目录/受控交付。Web本人密码变更须用CLI文件避免会话强制结束抢先交付。网络/COMMIT未知不给假成功、不自动重试。
5. 新0006请求表及每人员/realm Feishu唯一约束，隔离0005迁移前pg_dump；不升级原0004。先红灯、真实SQL/HTTP/CLI的正常/冲突/权限/审计/并发及双方法旧会话拒绝，实际页面OAuth模拟和下载边界，完整suite/typecheck，提交交TL。
