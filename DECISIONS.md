## 发现的问题
<!-- 列出你识别出的每个问题 -->
1. `RoomRow.tsx` 启动即抛 `ReferenceError: Cannot access 'getBookingStatus' before initialization`：`getBookingStatus` 以 `const` 箭头函数声明，却在其声明语句之前的 `useMemo` 回调中被同步调用，触发 TDZ（暂时性死区）异常，导致组件首次渲染失败。
2. 样式问题, 目前组件样式没有分离难以维护
3. _app.tsx问题
4. new Date()取值问题, 统一取值, 单例, 防止出现多次初始化, 如23:59和00:01分别new Date()

## 应用的修复
<!-- 对于每个修复：你改变了什么，为什么，以及你选择了什么方法 -->
1. `getBookingStatus` 仅有单一调用点且逻辑为一行映射，无独立封装价值。移除该函数定义，将 `useMemo` 内的调用就地替换为 `STATUS_COLORS[b.status] ?? "#ccc"`，从根本上消除 TDZ 引用顺序问题，同时减少一层冗余间接调用。
2. 将css抽离到module.css中, 并支持theme token主题系统, 确定颜色 / 排版 / 间距 / 尺寸 / 圆角 / 阴影 / 动效 七类样式变量的语义化集合，组件只消费 token、不写死值，从而实现统一视觉与多主题切换。

## 权衡取舍

<!-- 你有意识地没有做什么，为什么？ -->

## 如果有更多时间

<!-- 你会进一步改进或调查什么？ -->