## 发现的问题
<!-- 列出你识别出的每个问题 -->
1. `RoomRow.tsx` 启动即抛 `ReferenceError: Cannot access 'getBookingStatus' before initialization`：`getBookingStatus` 以 `const` 箭头函数声明，却在其声明语句之前的 `useMemo` 回调中被同步调用，触发 TDZ（暂时性死区）异常，导致组件首次渲染失败。
2. 视觉规格强耦合在 JSX inline `style` 中，缺乏单一事实来源：`RoomRow` / `BookingGrid` 等核心组件将颜色、间距、尺寸、圆角等视觉属性以字面量形式散落在 20+ 处 inline style 中（如 `#eee` / `#f0f0f0` / `#ddd` 三套近似分隔线、重复出现的 `48 / 140 / 40` 魔法数字）。带来的工程问题：(1) 同一语义的视觉值无统一约束，长期演进必然漂移；(2) hover / selected 等交互状态以三元运算耦合在 JSX 中，难以静态审查、复用与测试；(3) 无主题切换扩展点（dark mode / 多品牌主题），未来接入需要全文回改组件；(4) 每次渲染重新构造同一份 inline style 对象，无法被浏览器样式表缓存与共享。
3. `_app.tsx` 顶层 Provider 抽象越界，全局 Context 承载了本不该共享的状态：(1) `AppContext` 实际只暴露一份不可变默认配置 + 仅在 `BookingGrid` 子树内共享的 `hoveredCell`，被强行提升至 App 根，导致 `/messages` 等无关路由也进入订阅链路并被无谓重渲染；(2) `MessagesContext` 维护的 `currentHouse` / `activeTicketId` 与 URL query 完全同义，构成"路由 → context → 页面"的双真理来源，刷新与跳转两条路径下数据极易漂移；(3) `unreadCount` 是 `/api/tickets` 的派生量，却由 `/messages` 页面在 `useEffect` 里反向写入 Context 给 Sidebar 消费，形成"页面 setState → context → 侧栏"的脆弱同步链 —— SWR 同 key 自带跨组件缓存与一致性，根本无须再过一层 Context。
4. Booking 网格的运行时常量在多处重复定义且语义错位：列宽 `COLUMN_WIDTH_PX = 48` 同时硬编码于 `BookingGrid` / `RoomRow` / `useVisibleRange` 三处，`TOTAL_DAYS = 30` 与 `VISIBLE_COLUMNS = 14` 也分散在 `BookingGrid` 与 hook 内部，主体 `minWidth` 计算里的 `+ 140` 更是无名魔法数字；与此同时承载这些值的类型 `AppConfig` 与单例 `APP_CONFIG` 命名为"应用级"，但所有字段（日历窗口、列宽、表头背景）实际都是 Booking 网格专属，抽象层级与命名严重错位 —— 既无法跨文件保持一致（任何一处改 48 都会引入视觉漂移），也阻碍未来 Messages 等其他域配置的并行扩展。
5. SWR 请求层缺乏抽象，调用样板大量散落且各自为政：(1) 同一份 `(url) => fetch(url).then(r => r.json())` fetcher 在 `pages/index` / `pages/messages/index` / `Sidebar` / `BookingDrawer` 共复制 4 份，且全部缺失 `res.ok` 校验，4xx/5xx 响应会被当作正常 JSON 渲染；(2) API 路径以字符串字面量出现在多处（`'/api/tickets'` 在 Sidebar 与 messages 页各写一遍，`/api/tickets/:id/read` 在 messages 页内联拼接），改路径需要全仓搜索；(3) 写操作（`POST /api/tickets/:id/read`）以裸 `fetch` 形式与 SWR 体系并行存在，乐观更新模板（mutate + optimisticData + revalidate）只能耦合写在页面组件里，复用与单测都无从下手；(4) 没有错误类型定义，状态码差异无法在调用层做精细分支处理。整体表现为"SWR 用了，但请求层并没有真正建立"。
6. 日期处理逻辑分散且缺少统一基准，存在跨日边界（off-by-one）隐患：(1) `new Date()` 在 `lib/bookingConfig`（`DATE_RANGE_START` / `DATE_RANGE_END`）、`lib/mockData.dateStr`、`BookingGrid.getDayLabels`、`RoomRow.useMemo` 共 8+ 处独立调用，模块求值期与组件渲染期分别取系统时间，若用户在 23:59 → 00:01 边界触发渲染，"今天"在不同文件取到不同值，导致日历窗口起点、mock 锚点、预订条偏移量出现 1 天漂移；(2) 跨日天数计算以 `(new Date(a) - new Date(b)) / (1000 * 60 * 60 * 24)` 手算样板形式重复 4 处，遇夏令时切换会得到非整数误差，且无法统一替换实现；(3) 日期格式化（`d.getMonth() + 1` / `toISOString().split('T')[0]`）散落各处，无单一事实来源，未来若需扩展时区 / 国际化 / 农历能力需要全文回改。整体表现为"日期处理"作为基础设施完全缺失，业务代码直接耦合 `Date` 原生 API。
7. BookingDrawer缺少持久化能力, 可以通过url query做到持久化
8. `BookingDrawer`中`getStatusPillClass`缺少对`pengding`状态的处理, 需要补齐
9. `STATUS_LABELS`和`BookingStatus`维护了多份, BookingStatus改为枚举, 统一维护引用
10: /message 只需要ticketId即可定位, 无需houseId

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
3. 按 **「状态归属最小化 + 派生量不入仓」** 原则拆解全局 Context，整体下沉为局部状态、URL 派生与 SWR 派生三类来源，最终删除 `context/AppContext.tsx`、`context/MessagesContext.tsx` 及对应 Provider：
   - **静态配置常量化**：原 `AppContext.defaultConfig` 抽离到 `lib/bookingConfig.ts` 暴露 `BOOKING_CONFIG`（见第 4 条收敛后命名），作为模块级只读单例直接 `import` 消费。从未运行时写入的不可变数据无需 Provider 包装，去除一层订阅心智与重渲染抖动。
   - **cell hover 状态下沉**：`hoveredCell` 仅在 `BookingGrid` 子树内跨 `RoomRow` 共享，回归到 `BookingGrid` 内部 `useState` 维护，并以 `hoveredCell` / `onHoverCell` props 向 `RoomRow` 单向透传。其他路由不再被卷入该状态的渲染链路，`RoomRow` 也由"隐式订阅 Context"变为"显式接收 props"，便于复用与单测。
   - **路由状态去 Context 化**：`activeTicketId` / `currentHouse` 改由 `useRouter().query` 直接派生，消除"路由 ↔ Context"双真理来源；保留 `getServerSideProps` 注入的 `initialTicketId` 作为 SSR 首屏兜底。
   - **派生量改 SWR 共享**：`unreadCount` 由 `Sidebar` 直接 `useSWR<Ticket[]>('/api/tickets')` 后 `filter(t => t.unread).length` 得到；与 `/messages` 页共用同一 SWR key，天然获得请求去重、缓存复用与跨组件一致性，彻底删除"页面 `setUnreadCount` → Context → Sidebar"反向写入链路与配套 `useEffect`。
   - **已读态闭环（乐观更新 + 远端写入 + 真值兜底）**：新增 `POST /api/tickets/:id/read` 接口在 mock 数据层把 `unread` 幂等置 false。`/messages` 页点击未读 ticket 时调用 `useSWRConfig().mutate(TICKETS_KEY, ...)` 一气呵成完成三件事：(a) `optimisticData` 立即在缓存里把命中项 `unread` 改为 false，列表红点 + Sidebar 徽标无需等待网络即时收敛；(b) mutator 内 `fetch` 远端接口持久化已读事实；(c) `revalidate: true` 让 SWR 在请求完成后用服务端权威数据再回填一次，请求失败则 `rollbackOnError` 回滚到先前缓存。两侧消费者订阅同一 key，自动跟随刷新，无需任何手写广播。
   - **根组件瘦身**：`pages/_app.tsx` 移除 `AppProvider` / `MessagesProvider` 双层包裹，仅保留 Sidebar + main 两栏骨架；`context/` 目录连同两份 Context 文件一并删除，无残留死代码。
   - **覆盖清单**：新增 `lib/bookingConfig.ts`（详见第 4 条改名收敛过程）与 `pages/api/tickets/[id]/read.ts`；改动 `BookingGrid` / `RoomRow` / `Sidebar` / `pages/_app` / `pages/messages/index` 共 5 个文件；删除 `context/AppContext.tsx` / `context/MessagesContext.tsx`。`tsc --noEmit` 校验通过，无新增类型错误。
4. 按 **「Booking 域常量单一事实来源 + 抽象层级对齐」** 原则收敛配置：
   - **类型与单例改名**：`types/index.ts` 中 `AppConfig` 重命名为 `BookingConfig`，`lib/appConfig.ts` 重命名为 `lib/bookingConfig.ts` 并将 `APP_CONFIG` 重命名为 `BOOKING_CONFIG`；命名收窄到 Booking 域后，职责边界一目了然，未来如需新增 Messages 等其他域的配置可独立创建 `*Config` 文件而不污染此处。
   - **魔法数字下沉**：把原本散落在 `BookingGrid` / `RoomRow` / `useVisibleRange` 三处重复定义的 `COLUMN_WIDTH_PX = 48`、`BookingGrid` 内的 `TOTAL_DAYS = 30`、`useVisibleRange` 内的 `VISIBLE_COLUMNS = 14`、以及主体 `minWidth` 表达式里的无名 `+ 140` 全部纳入 `BookingConfig`，新增字段 `COLUMN_WIDTH_PX` / `TOTAL_DAYS` / `VISIBLE_COLUMNS` / `LABEL_COLUMN_WIDTH_PX`，命名按职责自描述，去掉原有未使用的 `visibleColumnsBuffer`。
   - **表头色下沉到 Token 层**：原 `bookingHeaderBackground = '#e8f4fc'` 本质是纯静态视觉规格，从未在运行时被外部写入，留在 JS 配置里只能让组件以 inline style 注入并阻断主题切换扩展点。改造为 `styles/tokens.css` 新增 `--color-bg-booking-header`，`BookingGrid.module.css` 的 `.headerLabel` / `.headerDays` 直接消费 `var(--color-bg-booking-header)`；`BookingConfig` 类型与 `BOOKING_CONFIG` 单例彻底删除该字段，组件层不再注入 `style={{ background: ... }}`。结果：表头色与项目其他视觉规格走同一条 token 通道，未来 dark mode / 多品牌主题挂载主题类即可整体换肤，组件与配置零改动。
   - **常量命名规范对齐**：`BookingConfig` 接口字段与 `BOOKING_CONFIG` 单例字段统一采用 `UPPER_SNAKE_CASE`（如 `COLUMN_WIDTH_PX` / `DATE_RANGE_START` / `BOOKING_HEADER_BACKGROUND`），与运行时 state 的驼峰命名形成视觉区分，调用点一眼即可识别"这是编译期已知、不可变的配置常量"，降低误改风险；常量本身命名沿用 `BOOKING_CONFIG` 全大写惯例。
   - **消费方改造**：`BookingGrid` 通过结构化解包从 `BOOKING_CONFIG` 取所需字段并就地使用，删除文件级 `COLUMN_WIDTH_PX` / `TOTAL_DAYS` 局部常量；`useVisibleRange` 同样直接 `import` 消费，去掉 hook 内部的 `COLUMN_WIDTH_PX` / `VISIBLE_COLUMNS` 复制品；`RoomRow` 保留显式 props 接口（`columnWidthPx` / `dateRangeStart` / `totalDays`，驼峰）由 `BookingGrid` 透传，保持单向数据流与可注入接口，便于复用与单测 —— 即使 `totalDays` 当前未被组件直接消费也保留为契约字段，避免未来扩展时反复增删 props。
   - **效果**：单一事实来源 —— 改 48 / 30 / 14 / 140 中任何一项只需在 `BOOKING_CONFIG` 改一处即可，跨文件视觉漂移风险归零；同时类型与命名抽象层级对齐 Booking 域，与 _app.tsx 注释 / `lib/bookingConfig` 头注释 / DECISIONS 第 5 条引用全部同步更新。
   - **覆盖清单**：`git mv lib/appConfig.ts → lib/bookingConfig.ts` 并改写常量；改动 `types/index.ts` / `BookingGrid` / `RoomRow` / `hooks/useVisibleRange` / `pages/_app` 共 5 个文件。`tsc --noEmit` 校验通过，无新增类型错误。
5. 按 **「单一请求入口 + 领域 hook + 抛错型 fetcher」** 原则建立统一请求层 `lib/api.ts`，把原本散落在 4 个文件中的 SWR / fetch 样板全部收敛：
   - **端点常量化**：新增 `API_ENDPOINTS` 对象集中所有 API 路径（`bookings` / `bookingDetail(id)` / `tickets` / `ticketRead(id)`），静态路径用常量、含参路径用函数生成；调用方禁止再写裸 URL 字面量，改路径只需在此处改一处。
   - **抛错型 fetcher**：内部封装 `httpGet<T>` / `httpPost<T>`，强制 `res.ok` 校验，非 2xx 抛出携带 `status` 的 `HttpError`（同样 export 供上层精细分支判断）。从根本上修复原各处复制 fetcher 把 4xx/5xx 当 JSON 渲染的隐患。
   - **领域 hook 收敛**：暴露 `useBookings()` / `useBookingDetail(id)` / `useTickets()` 三个领域 hook，调用方零样板（无需自带 fetcher、无需写 SWR key、无需手动处理 conditional key —— `useBookingDetail` 已在内部实现 id 为空时不发请求）；所有 hook 透传 `SWRConfiguration` 便于个别调用方覆盖刷新策略。
   - **写操作模板化**：导出 `markTicketRead(mutate, ticketId)`，把"乐观更新 + 远端写入 + revalidate 兜底 + rollbackOnError"四步走模板封装在请求层；调用方仅需 `useSWRConfig().mutate` 注入即可，业务页面不再持有 SWR mutator 细节。
   - **消费方改造**：`pages/index` / `pages/messages/index` / `Sidebar` / `BookingDrawer` 共 4 个文件移除各自的 `fetcher` / `useSWR` 直接调用，替换为对应领域 hook；`pages/messages/index` 内联的乐观更新逻辑删除（30+ 行），替换为单行 `markTicketRead(mutate, ticket.id)`。
   - **效果**：fetcher 与 SWR key 单一事实来源；HTTP 错误统一抛出可被 SWR `onError` / 全局 ErrorBoundary 捕获；新增端点只需在 `lib/api.ts` 加 endpoint + hook 两行，调用方零侵入；4xx/5xx 渲染隐患被根除。
   - **覆盖清单**：新增 `lib/api.ts`；改动 `pages/index.tsx` / `pages/messages/index.tsx` / `components/Sidebar/Sidebar.tsx` / `components/BookingDrawer/BookingDrawer.tsx` 共 4 个文件。`tsc --noEmit` 校验通过，仓库内除 `lib/api.ts` 外不再有 `fetch(` 或 `useSWR` 直接调用（仅 `pages/messages/index` 保留 `useSWRConfig` 以拿 mutate 引用，符合预期）。
6. 按 **「日期处理基础设施单一事实来源 + 业务零裸 Date」** 原则建立统一日期工具层 `lib/date.ts`，把原本散落在 4 个文件、8+ 处的 `new Date()` 与时间戳手算彻底收敛：
   - **底层选型**：引入 `dayjs`（不可变 API、< 3KB、与项目 ESM/SSR 链路兼容），相比直接封装原生 `Date`，dayjs 的 `add` / `diff` 在夏令时与时区切换边界结果稳定，且后续若需要时区 / 相对时间 / 农历能力可通过 plugin 平滑扩展，调用方零改动。
   - **统一接口**：`lib/date.ts` 暴露 `IsoDate` 类型别名 + `today()` / `addDays(date, n)` / `diffDays(start, end)` / `formatMonthDay(date)` / `buildDayLabels(start, length)` 五个纯函数。所有公开函数以 `YYYY-MM-DD` ISO 字符串为主输入输出类型，避免 `Date` 实例在 props / SWR 缓存 / SSR 序列化链路中的心智负担，保持纯字符串单向数据流。
   - **跨日边界一致性 ——「锚点一次读，向下派生」**：约定 `today()` 仅在模块求值期被调用一次，赋给模块级 const 锚点（`bookingConfig.DATE_RANGE_START` / `mockData.TODAY_ANCHOR`）后所有衍生值（`DATE_RANGE_END` / `dateStr(n)`）通过 `addDays` 从同一锚点派生，禁止在组件渲染、事件回调等运行时路径上反复调用。当前项目仅这两处取锚点，Node 模块缓存使二者实际在同一进程启动时刻先后毫秒内完成，工程上等价于单例；约定写在 `today()` 注释中，新增调用点遵循同一约束即可避免漂移。`BookingGrid` / `RoomRow` 的窗口计算改由父级透传 `DATE_RANGE_START`，组件本身不再持有"今天"的概念。
   - **手算样板根除**：`RoomRow.useMemo` 内 4 处 `(new Date(a) - new Date(b)) / 86400000` 替换为单行 `diffDays(dateRangeStart, b.checkIn)`；同时把原"先两次 filter 内 new Date、再两次 map 内 new Date"的双倍计算合并为"先 map 一次、再 filter"的单次遍历，消除每条预订条 4 次冗余 `Date` 构造的性能浪费。
   - **格式化下沉**：`BookingGrid.getDayLabels` 中的 `${d.getMonth()+1}/${d.getDate()}` 字符串拼接改为 `buildDayLabels` 调用，未来切语言 / 改格式（如 `MM-DD` / `D MMM`）只需改 `lib/date.ts` 一处，业务零侵入。
   - **效果**：仓库内除 `lib/date.ts` 外**零** `new Date(` 运行时调用（`grep` 验证残留仅为注释中的反引号引用）；日期处理具备统一替换点、单一基准时间、可测试纯函数、可扩展插件机制四项基础设施特性。
   - **覆盖清单**：新增 `lib/date.ts`；改动 `lib/bookingConfig.ts` / `lib/mockData.ts` / `components/BookingGrid/BookingGrid.tsx` / `components/BookingGrid/RoomRow.tsx` 共 4 个文件；`package.json` 新增依赖 `dayjs`。`tsc --noEmit` 校验通过，无新增类型错误。

## 权衡取舍

<!-- 你有意识地没有做什么，为什么？ -->
1. 手机号, 邮箱号, 金额是否做模糊处理 or 是否可见? 需要产品明确;
2. 进入/messages 是否选中第一条未读消息? 需要产品明确;

## 如果有更多时间

<!-- 你会进一步改进或调查什么？ -->
1. 如果Booking Detail Drawer支持刷新仍然显示, 在复杂业务场景下需要考虑优先加载渲染Drawer, 而后再渲染日历路由
2. 无极滚动日历/甘特在已有虚拟滚动后, 要看是否仍有性能问题, 若还是有问题, 可能要进一步考虑有canvas去做
3. UI适配多设备, 如pc小屏是否收起Sidebar, 是否适配pad和mobile