## 发现的问题
<!-- 列出你识别出的每个问题 -->

> 二级分类：**A 运行时缺陷** · **B 架构与状态归属** · **C 基础设施缺位（单一事实源）** · **D 网格渲染性能**

### A. 运行时缺陷

1. `RoomRow.tsx` 启动即抛 TDZ 异常：`getBookingStatus` 以 `const` 声明，却在其上方 `useMemo` 中被同步调用，组件首屏渲染失败。

2. `getStatusPillClass` 枚举不完备：`if/else` 仅覆盖两态、入参 `status: string` 弱类型，新增枚举成员编译器无法静态强制覆盖，五态在 UI 层只表达三态。

3. bar `width` 与 `left` clamp 不一致：`x = LABEL + max(0, startDay × COL)` 把负 `startDay`（如 b1 `checkIn = -2`）的视觉左缘钳到 timeline 起点，但 `width = (endDay - startDay + 1) × COL` 仍按真实负 startDay 计算 —— 被钳掉的 `|startDay|` 列以"右缘多出宽度"形式溢出（b1 endDay=5/1 实际渲染到 5/3）。

4. 同 room 重叠 booking 的 bar 几何相互覆盖：`mockData` 生成器（`room = i%20+8`、`checkIn = i%7`）在 i 与 i+20 配对时高概率制造同房型时间区间重叠（如 b27/b47 同处 room-24、共享 day 2-4），单 lane 渲染下后绘 bar 完全遮住先绘 bar，整条数据在视图上消失。

### B. 架构与状态归属

1. `_app.tsx` 顶层 Provider 抽象越界：`AppContext` 把 `BookingGrid` 子树态提到根、卷入无关路由；`MessagesContext` 与 URL query 形成双真理来源；`unreadCount` 反向回写 Context 是 SWR 派生量，链路脆弱。

2. Drawer 选中态仅本地 `useState`，无持久化与可分享性：刷新丢失、URL 不带选中、前进/后退失效；与 `/messages` 的 `ticketId` 派生策略形成双标。

3. `/messages` 路由 query 双参 `ticketId + houseId`：`houseId` 是 `ticket` 派生量，构成双真理来源，刷新 / 分享 / 外链易出非法 URL 状态。

4. Drawer 共有字段事实来源错位：Guest / Room / Dates / Status / Amount 取 `booking` 快照不切到 `detail`，服务端在抽屉打开期间更新会出现同屏新旧值并存。

### C. 基础设施缺位（单一事实源）

1. 视觉规格强耦合 inline style，缺单一事实来源：核心组件散落 20+ 处字面量（`#eee` / `48` / `140`），近似值漂移、交互态以三元判断耦合 JSX、无主题切换扩展点、style 对象逐帧重建无法被样式表缓存。

2. Booking 网格常量多处重复 + 抽象层级错位：`COLUMN_WIDTH_PX = 48` / `TOTAL_DAYS` / `VISIBLE_COLUMNS` / 魔法数 `+ 140` 散落 3 文件；`AppConfig` 命名为应用级实为 Booking 域，跨文件改一处即漂移。

3. SWR 请求层缺抽象：`fetcher` 在 4 文件复制且无 `res.ok` 校验、API 路径字面量散落、写操作裸 `fetch` 与 SWR 并行、无错误类型 —— 名义上用 SWR，请求层未真正建立。

4. 日期处理无统一基准：`new Date()` 在 8+ 处独立调用，跨日边界取值漂移；`(a - b) / 86400000` 手算样板重复 4 处遇 DST 失精；格式化散落各处，无单一替换点。

5. `BookingStatus` 与展示元数据多份事实来源：string union 无运行时句柄、`STATUS_LABELS` / `STATUS_COLOR_VARS` 双副本，新增成员需跨文件同步且 TS 漏写不报错。

6. 异步态视图层基础设施缺失：loading / error / empty 三态各自为政、文案重复；**error 在视图层全局缺席** —— SWR `error` 字段无消费者、无 ErrorBoundary，渲染抛错即白屏。

### D. 网格渲染性能

1. `BookingGrid` 内联 `bookings.filter(b => b.roomUnit.roomId === room.id)` 派发：每帧重构数组破坏 `React.memo` 浅比较，且 O(N×M) 重复扫描在高频重渲染路径下被放大。

2. `RoomRow` 日格 hover 接入 React state：纯视觉态触发全部 `RoomRow` 重渲染；日格几何层与 booking 数据层未分离，SWR 刷新连带 cell 层重渲染。

3. `BookingGrid` 缺首行 / 首列 sticky：`.header` 与 `.body` 双 scroll container 横滚后表头与日格失对位；纵滚时行标签滚出；窗口式表头与全量 body 渲染口径错位。

4. `BookingBars` 嵌在每行 `RoomRow` 内：横滚改 `visibleRange` 触发 N 行函数体执行 + N 个 BookingBars 各自 reconcile，与"全网格同一可视窗口"语义错配。

5. bar 几何走 inline `left / top`：每帧触发 layout / paint、无 GPU 合成；跨列时 `visibleBookings` 全量改写引发 layout 抖动，性能上限被钉死。

6. `useVisibleRange` 把 `scrollLeft` 直接进 state：60Hz 像素流引发 reconcile 但派生量仅 48px 跨列变化，同列内 ~48 次 setState 全无效；输出 `offsetPx` / `scrollLeft` 已无消费者。


## 应用的修复
<!-- 对于每个修复：你改变了什么，为什么，以及你选择了什么方法 -->

> 二级分类与"发现的问题"一一对应：**A 运行时缺陷** · **B 架构与状态归属** · **C 基础设施缺位（单一事实源）** · **D 网格渲染性能**

### A. 运行时缺陷

1. 移除单调用点的 `getBookingStatus`，`useMemo` 内就地查表 `STATUS_COLORS[b.status] ?? "#ccc"`，根除 TDZ 引用顺序问题。

2. **枚举完备性查表强制**：签名收紧 `status: BookingStatus`；新增 `STATUS_PILL_CLASSES: Record<BookingStatus, string>` TS 静态强制覆盖所有成员；`getStatusPillClass` 退化为单行查表；同步补齐 3 对 pill token 与 module 类，五态视觉对齐。

3. **width 同步用 clamp 后的起点**：`width = (endDay - max(0, startDay) + 1) × COL`，与 `x` 的 clamp 行为对齐 —— 负 startDay 被钳掉的列同时从宽度中扣除，bar 右缘恢复锚定真实 endDay；完全在可视范围内的 bar（`startDay ≥ 0`）公式退化为原版，行为不变。

4. **同 room 重叠区间贪心着色 + 行高自适应**：新增 `lib/laneAssignment.assignLanes`，对每个 roomId 按 `(startDay, endDay)` 升序、贪心扫描 `lanes[i] < startDay` 找最早可复用 lane（O(N log N)/room），输出 `laneByBookingId` + `laneCountByRoomId`；`BookingGrid` useMemo 累积 `rowTopByRoomId = Σ (laneCount × LANE_HEIGHT_PX + 1px border)` 取代旧版"等宽行 × rowIndex"的 stride 假设；`RoomRow` 接 `laneCount/laneHeightPx`，inline 设置 `.label/.timeline` 高度为 `laneCount × LANE_HEIGHT_PX`、`.cell` 高度改 `100%` 跟随多 lane 行延伸；`GridBookingBars` bar 的 `top = rowTop + lane × LANE_HEIGHT_PX + BAR_OFFSET_TOP_PX`，重叠区间错开堆叠不再相互覆盖。验证：room-1/22/28（无 overlap）单 lane 41px、room-23/24（含 overlap）双 lane 81px，b27/b47 在 room-24 内分到 lane 0/1 全部可见。

### B. 架构与状态归属

1. **状态归属最小化**拆 Context：静态 config 抽 `BOOKING_CONFIG` 模块常量；`hoveredCell` 下沉 `BookingGrid` 本地；路由态 `useRouter().query` 派生；`unreadCount` 改 `Sidebar` 直接 `useSWR` 同 key 共享；新增 `POST /api/tickets/:id/read` + `mutate optimisticData / rollbackOnError` 闭环已读态。删除 `context/` 整目录。

2. **URL 即真理源 + SSR 兜底**：`bookingId` 上提路由 query；`getServerSideProps` 注入 `initialBookingId` 覆盖水合前空 query；以 `router.isReady` 为分水岭防 `??` 误用导致关不掉；`router.push` 加 `shallow: true` 零网络代价；下游接口零侵入。

3. **路由 query 收敛**：`/messages` 移除 `houseId` 仅留 `ticketId` 单参；`houseId` 由 ticket 查表派生，"`houseId` 必须等于 `tickets[ticketId].houseId`"隐式不变量自动成立，外链非法状态根除。

4. **detail > booking 优先级**：组件顶部 `view = detail ?? booking` 合成单一视图模型，5 共有字段统一切 `view.*`；`BookingDetail extends Booking` 让 TS 自然收敛为 `Booking` 子类型零分支；约定写入头注释。

### C. 基础设施缺位（单一事实源）

1. **Design Token + CSS Module 双层重构**：`tokens.css` 暴露 7 类语义变量（color / typography / spacing / size / radius / shadow / motion）作单一视觉事实源；组件全量切 `*.module.css` 消费 token，inline style 仅保留运行时几何与配置注入；交互态拆独立类配 `cx` 切换；天然支持主题挂载。覆盖 7 组件 / 页面 + 7 份 module。

2. **Booking 域常量收敛**：`AppConfig` → `BookingConfig`、`appConfig.ts` → `bookingConfig.ts`、字段命名 `UPPER_SNAKE_CASE`；`COLUMN_WIDTH_PX` / `TOTAL_DAYS` / `VISIBLE_COLUMNS` / `LABEL_COLUMN_WIDTH_PX` 单一事实源；`bookingHeaderBackground` 下沉为 `--color-bg-booking-header` token。

3. **统一请求层 `lib/api.ts`**：`API_ENDPOINTS` 集中路径；`httpGet / httpPost` 强校验 `res.ok` 抛 `HttpError`；领域 hook `useBookings` / `useBookingDetail` / `useTickets` 零样板；`markTicketRead` 模板化乐观更新四步走。4 文件迁移完毕，`fetch(` 与 `useSWR` 直接调用清零。

4. **统一日期工具 `lib/date.ts`**：引入 `dayjs`；暴露 `IsoDate` + `today` / `addDays` / `diffDays` / `formatMonthDay` / `buildDayLabels`；约定 `today()` 仅模块求值期取一次锚点向下派生；`RoomRow` 双倍 `new Date` 合并为单次遍历。仓库除该模块外零裸 `new Date(` 运行时调用。

5. **状态域单一模块 `lib/bookingStatus.ts`**：`BookingStatus` 由 string union 升 string `enum`（线缆兼容）；集中 `STATUS_LABELS` / `STATUS_COLOR_VARS` / `STATUS_PILL_CLASS_NAMES` 三表 `Record<BookingStatus, …>`；只持 className 字符串避免与具体 module 文件耦合。下游 4 文件去副本。

6. **统一异步态外壳**：新增 `<AsyncBoundary>`（render-prop、`error > loading > empty > success` 优先级）+ `<Loading>` / `<InlineLoading>` / `<ErrorMessage>` / `<EmptyState>` 四件套 + `<ErrorBoundary>`（渲染抛错降级）+ `SWRConfig.onError`（observability）+ 默认指数退避重试（1s → 2s → 4s × 3，4xx 跳过）。占位组件就位即附 `role` / `aria-live`。

### D. 网格渲染性能

1. **按 roomId 分桶**：`useMemo` 维护 `bookingsByRoom: Map<string, Booking[]>` 单次 O(M) 索引；模块级 `EMPTY_BOOKINGS` 作未命中兜底保引用稳定；`RoomRow` 接 `React.memo` 形成"分桶 → 子集稳定 → memo 命中"闭环。

2. **Hover CSS 化 + 几何/数据双子层**：`.row:hover` / `.cell:hover` 替伪类，删 `hoveredCell` 整条 props 链路；`<DayCells>` 几何层全量渲染永不重渲染、`<BookingBars>` 数据层窗口过滤独立 memo；`RoomRow` 退化为纯几何骨架接 `React.memo`。

3. **单一滚动容器 + position: sticky 双向吸附**：`.header` 下沉到 `.body` 内成兄弟节点，删 `headerDays overflow:hidden` 与窗口截断；`.header` sticky-top、首列 sticky-left、角落格双向吸附；二维 z-index：4(角落) > 3(表头) > 2(标签列) > 1(bar) > 0(cell)；表头改全量 30 列对齐 `DayCells`。

4. **BookingBars 提升到 grid 层**：新增 `<GridBookingBars>` 一次遍历全集 + `roomId → rowIndex` 索引、二维坐标定位、`clippedStart` 实现 sticky-left；`RoomRow` 收为 3 props 纯几何骨架，横滚下函数体执行 0 次；`BOOKING_CONFIG` 新增 `ROW_HEIGHT_PX:41`（含 1px 分隔线）/ `BAR_OFFSET_TOP_PX:6` 解决 stride 漂移。

5. **bar 用 `left/top` + 文字 `position:sticky` 横滚 sticky-left**：原计划用 `transform: translate3d` 走 GPU 合成层，但实测父级 `transform` 会破坏内部 `position:sticky` 的 scrollport 参照（sticky 把被 transform 的 `.bar` 自身当作 scrollport，文字粘在固定偏移、不再跟随真实 `scrollLeft`）；改回 inline `left/top`（坐标不依赖 scrollLeft，React 浅比对不写 DOM，滚动由滚动容器整体合成）。`.bar` 用 `clip-path: inset(0 round var(--radius-sm))` 替代 `overflow:hidden` 做内容裁剪 —— `overflow:hidden` 会让 `.bar` 成为 scrolling container 同样阻断 sticky；clip-path 仅做视觉裁剪不建立 scroll container。`.barLabel` 子元素用 `position: sticky; left: calc(var(--size-row-label-width) + var(--spacing-2))` 钉在 sticky `.label` 列右缘的 viewport 位置，bar 跨可视左缘时 guestName 自动贴可视左边可见、bar 完全滚出时受 .barLabel 父级 content-box 右界约束随 bar 退出，全程逐像素平滑（无需依赖 `useVisibleRange` 的 stepwise 阈值化）。

6. **`useVisibleRange` 阈值化 setState**：state 由 `scrollLeft` 改 `startIndex`，函数式 setter 比较新旧值实现同列短路；输出收窄为拍平的 `{ startIndex, endIndex, handleScroll }`，删除无消费者的 `offsetPx` / `scrollLeft`。


## 权衡取舍

<!-- 你有意识地没有做什么，为什么？ -->

1. **未引入虚拟滚动**：当前网格规模为 30 列 × 31 行 ≈ 930 cell + 数十条 bar，配合"几何层 memo 永不重渲染 + bar 提升至 grid 层 + bar 坐标不依赖 scrollLeft（不触发 reconcile）+ 滚动容器整体合成"已无可见瓶颈；虚拟化会引入滚动惯性 / sticky 边界 / 焦点跳跃等额外复杂度，性能 budget 报警再做。

2. **重叠预订只做错层不做 cap / 折叠**：同 room 重叠区间已用 lane 贪心着色错层堆叠（详见 A.4 修复），但未设 `MAX_LANES` 上限与"+N more"折叠徽标 —— 极端 overlap（如同一 room 10+ 重叠）会让单行高度失控；产品对"几条以内全展开 / 几条以上折叠"的口径未明，先保留全展开避免数据被遮蔽，待业务规则收敛再加 cap。同时 lane 改造放弃了 `useRowStride` 的 ResizeObserver-CSS-token 跟随能力（`LANE_HEIGHT_PX` 退回 JS 常量与 `--size-row-height` 手工保持一致），如需恢复"CSS as truth"可后续加 `useLaneHeight` 通过 `getComputedStyle` 读 CSS var。

3. **未做敏感字段脱敏**：手机 / 邮箱 / 金额是否模糊及触发条件需产品 + 合规明确，前端不擅自决定。

4. **未默认选中 `/messages` 第一条未读**：交互默认值属产品决策，未对齐前不预设以免后续返工。


## 如果有更多时间

<!-- 你会进一步改进或调查什么？ -->

1. **测试基建**：单测覆盖 `lib/date` / `lib/api` / `lib/bookingStatus` 等纯函数；React Testing Library 覆盖 `<AsyncBoundary>` 三态、Drawer URL 驱动；E2E（Playwright）覆盖横滚 sticky / Drawer 直链；视觉回归卡住 token 漂移。

2. **网格分页 / 时间窗口懒加载**：当前 30 天写死，无极滚动场景下应改为按窗口分页拉取 `bookings`，配合 SWR `keepPreviousData` 与游标 key，避免数据规模线性增长后的传输 / 内存压力。

3. **多设备适配**：PC 小屏自动收起 Sidebar、平板 / 移动端日历改为竖向时间轴或卡片视图、触屏手势替代 hover 视觉态。

4. **骨架屏替代 Spinner**：`<Loading>` 升级为按结构匹配的骨架，首屏感知延迟下降，特别是 Drawer 详情区。

5. **Drawer 直链优先级渲染**：`?bookingId=xxx` 直链场景下并行预取 detail 与 bookings，detail 命中即先绘 Drawer，避免必须等列表 SWR 完成才能解 `find` 出 booking 占位。

6. **canvas / WebGL 兜底方案**：若未来房型规模达到数千行 + 数月跨度，DOM 绝对定位 + 合成层会触达 GPU 内存与首次合成成本上限，届时评估迁移到 canvas（如 `react-konva`）渲染 bar 层、保留 DOM 仅做交互命中层。

7. **observability 接入**：`SWRConfig.onError` 与 `<ErrorBoundary>.componentDidCatch` 当前仅 `console.error`，接入 Sentry 上报 + 用户侧 Toast 反馈链路。

8. **a11y 完整化**：网格语义升级到 `role="grid"` + `aria-rowindex` / `aria-colindex`，键盘导航（方向键移动、Enter 打开 Drawer），屏幕阅读器朗读"X 房 Y 月 Z 日 已入住"。
