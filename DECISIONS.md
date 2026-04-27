## 发现的问题
<!-- 列出你识别出的每个问题 -->
1. `RoomRow.tsx` 启动即抛 `ReferenceError: Cannot access 'getBookingStatus' before initialization`：`getBookingStatus` 以 `const` 箭头函数声明，却在其声明语句之前的 `useMemo` 回调中被同步调用，触发 TDZ（暂时性死区）异常，导致组件首次渲染失败。
2. 视觉规格强耦合在 JSX inline `style` 中，缺乏单一事实来源：`RoomRow` / `BookingGrid` 等核心组件将颜色、间距、尺寸、圆角等视觉属性以字面量形式散落在 20+ 处 inline style 中（如 `#eee` / `#f0f0f0` / `#ddd` 三套近似分隔线、重复出现的 `48 / 140 / 40` 魔法数字）。带来的工程问题：(1) 同一语义的视觉值无统一约束，长期演进必然漂移；(2) hover / selected 等交互状态以三元运算耦合在 JSX 中，难以静态审查、复用与测试；(3) 无主题切换扩展点（dark mode / 多品牌主题），未来接入需要全文回改组件；(4) 每次渲染重新构造同一份 inline style 对象，无法被浏览器样式表缓存与共享。
3. _app.tsx问题
4. new Date()取值问题, 统一取值, 单例, 防止出现多次初始化, 如23:59和00:01分别new Date()
5. `BookingDrawer`中`getStatusPillClass`缺少对`pengding`状态的处理, 需要补齐
6. `STATUS_LABELS`和`BookingStatus`维护了多份, 若依产生问题
7. 所有对日期的处理抽离成一个工具层, 统一维护统一调用, 不要分散, 

## 应用的修复
<!-- 对于每个修复：你改变了什么，为什么，以及你选择了什么方法 -->
1. `getBookingStatus` 仅有单一调用点且逻辑为一行映射，无独立封装价值。移除该函数定义，将 `useMemo` 内的调用就地替换为 `STATUS_COLORS[b.status] ?? "#ccc"`，从根本上消除 TDZ 引用顺序问题，同时减少一层冗余间接调用。
2. 按 **Design Token + CSS Module** 双层结构对**全项目**进行样式隔离重构：
   - **Token 层（`styles/tokens.css`）**：以 `:root` 暴露七类语义化 CSS 自定义属性 —— color / typography / spacing / size / radius / shadow / motion（另含 z-index 一档辅助层），作为全局视觉单一事实来源；命名遵循 `--<类目>-<语义>-<修饰>` 约定（如 `--color-bg-row-hover`、`--size-row-height`、`--shadow-drawer`）。业务状态色（`--color-status-*`）与状态 Pill 配色（`--color-pill-*`）一并纳入 token，确保颜色定义集中化。
   - **样式层（每个组件独立 `*.module.css`）**：承载组件所有静态样式，仅消费 token 变量，禁止裸 hex 与魔法数字；交互态（hover / active / 未读 / pill 三态）拆分为独立类（如 `.rowHovered`、`.navLinkActive`、`.statusPillInHouse`），通过条件 className 切换，去除 JSX 中的三元样式分支。多 className 拼接由复用的 `cx(...)` 工具函数处理。
   - **组件层**：所有 `.tsx` 文件 inline style 仅保留运行时不可静态化的几何 / 配置值 —— 如 `RoomRow` 中的 `left` / `width` 与状态背景色（已改为 `var(--color-status-*)` 字符串）、`BookingGrid` 中由 `AppContext` 注入的 `config.bookingHeaderBackground` 与依赖 JS 常量的 `minWidth`；其余 `Sidebar` / `BookingDrawer` / `pages/_app` / `pages/index` / `pages/messages/index` 共 5 个文件 inline style 已 100% 清空。
   - **可扩展性**：该分层为后续 dark mode / 多品牌主题提供天然扩展点 —— 仅需挂载主题类（如 `[data-theme="dark"]`）覆盖 token 层即可整体换肤，组件代码零改动。
   - **覆盖清单**：`RoomRow` / `BookingGrid` / `BookingDrawer` / `Sidebar` / `pages/_app` / `pages/index` / `pages/messages/index` 共 7 个组件 / 页面已落地，配套 7 份 `*.module.css`。
   - **已知 token 缺口**（按「禁止扩展 token」约束保留为合成或字面量，并在对应 CSS 文件头注释中标注）：(a) `BookingDrawer` 状态 Pill 的 `padding: 3px 10px` 与详情行 `margin-bottom: 10px` 落在 spacing 阶梯空隙；(b) `Sidebar` 未读徽标圆角 10px 与 padding `1px 7px` 无 1:1 token，已就近映射到 `--radius-pill` + `--spacing-2`，存在 1px 量级偏离；(c) `pages` 中 14px / 3px 通过 `calc()` 合成现有 token 实现像素零差。后续若纳入扩展，集中在 token 层补齐即可，组件无需改动。

## 权衡取舍

<!-- 你有意识地没有做什么，为什么？ -->
1. 手机号, 邮箱号, 金额是否做模糊处理 or 是否可见? 

## 如果有更多时间

<!-- 你会进一步改进或调查什么？ -->
1. 如果Booking Detail Drawer支持刷新仍然显示, 在复杂业务场景下需要考虑优先加载渲染Drawer, 而后再渲染日历路由
2. 无极滚动日历/甘特在已有虚拟滚动后, 要看是否仍有性能问题, 若还是有问题, 可能要进一步考虑有canvas去做