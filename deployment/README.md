# 俄语课堂部署

正式地址：https://anastasiay.ipv64.net

## 登录与访问控制

Cloudflare Access Free 使用邮件一次性验证码，只允许以下三个邮箱：

- nastik6980@gmail.com
- lhllfc@gmail.com
- nastya.yanukovich@inbox.ru

应用名为“Private Russian Classroom”，会话有效期 24 小时。策略 `Russian classroom - approved emails` 使用精确 Emails 白名单，并要求 One-time PIN；没有其他放行策略。保护整个 Worker，包括正式域名、workers.dev 和预览地址。换电脑直接打开正式地址，使用白名单邮箱收取验证码即可，不需要共用密码。

旧密码、旧 Cookie 已失效，Google Secret Manager 的 `reader-auth:1` 已停用。Cloud Run 默认地址不能作为备用网站使用。后端同时校验 Worker 专用密钥和 Cloudflare Access JWT 签名、签发者、应用 audience、过期时间及身份字段；伪造邮箱请求头不能登录。登录内容不允许公共 CDN 缓存。

Access 应用 ID：`771f2175-027b-4c79-80ed-9989ca86be02`。团队地址：`https://wandering-brook-1a7e.cloudflareaccess.com`。修改白名单需在 Cloudflare Zero Trust 的该应用策略中操作；不得添加 Everyone、Bypass 或其他放行规则。退出按钮跳转 Access 注销端点。

## 当前资源与费用

- Google 项目：`russian-anastasiay-20261123`，管理账户：`liuhaolingtitan@gmail.com`。
- Cloud Run：`russian-reader`，`europe-west1`；按请求计费，1 vCPU、256 MiB、并发 20、最小实例 0、最大实例 1；关闭启动 CPU 提升。
- 当前修订版本：`russian-reader-00009-wfq`，100% 流量。
- 镜像标签：`20261124-phrase-v1`；构建使用独立服务账户，运行账户仅用于后端服务。
- 运行密钥：`reader-access-auth:1`；Worker 配置 `ORIGIN_AUTH_KEY` 与 `ACCESS_AUD`。
- Cloudflare Worker：`russian-reader-domain`，版本 `2696fb86-54d8-4629-8bbb-3f3516a0f9f1`。
- Cloudflare Access Free 已由用户完成激活；未升级 Workers 付费套餐，也没有新增 Google 负载均衡器。
- Google 每月预算告警为 50 SEK，在 50%、90%、100% 通知。告警不是费用硬上限，后端请求、互联网流量、构建、镜像、日志和密钥仍可能产生费用。
- 构建源 1 天后清理；镜像保留最新两个版本，超过 7 天的其他版本自动清理。教材首次下载较大，避免反复全量下载。

DNS 委托为 `cash.ns.cloudflare.com` 与 `sureena.ns.cloudflare.com`。不要通过 IPv64 自动覆盖委托或改回动态 IP。HTTPS 证书由 Cloudflare 管理。

## 更新教材

在项目根目录执行：

```powershell
./deployment/deploy.ps1
```

脚本运行安全测试，只压缩并打包四个原始 HTML、服务器及运行依赖，构建镜像，绑定 Access 配置，再执行未登录访问和绕过检查。原始 PDF、工作目录、Git 及本地凭据不进入镜像。

```powershell
npm test
python deployment/smoke.py
```

线上 smoke 不导出浏览器会话，只检查未登录请求必须经 Access、直接后端和旧 Cookie 被拒绝。实际邮件登录及教材访问需在浏览器验证。2026-11-23 已由 lhllfc@gmail.com 完成验证码登录，并打开课堂笔记和第 1–36 页教材。Google 边缘对 `/healthz` 返回 404，线上检查使用真实业务路由验证服务响应和保护。

学习进度保存在各浏览器本地，不会自动同步到另一台电脑。

## 更新 Worker

仅更新教材无需重新发布 Worker。转发源码和配置位于 deployment 目录。更新 Worker 前运行 npm test，再使用官方 Wrangler 登录和发布，完成后退出。

```powershell
npx wrangler login --scopes account:read user:read workers_scripts:write workers_routes:write zone:read
npx wrangler deploy --config deployment/wrangler.jsonc
npx wrangler logout
```

首次配置或轮换密钥由 `deployment/access_setup.py` 生成本地配置并写入 Google Secret Manager。Worker 与后端密钥必须保持一致，切换期间需要协调发布；不得将密钥放入源码或命令行参数。

`.local`、`.deploy`、`.wrangler` 和 node_modules 已排除 Git；不要分享 `.local`。本次发布后已退出 Wrangler，删除本机 OAuth 登录凭据。

## 回滚

只回滚到验证过的 Access 版本。目前安全基线为 `russian-reader-00002-7gg`。不得切回 `russian-reader-00001-dpf`：该版本使用已退役的共用密码。不要重新启用 reader-auth 或恢复 AUTH_CONFIG。旧 setup_cloud.py 仅是最初资源初始化记录，不用于当前认证配置。

```powershell
gcloud run services update-traffic russian-reader --to-revisions=russian-reader-00002-7gg=100 --region=europe-west1 --project=russian-anastasiay-20261123 --account=liuhaolingtitan@gmail.com
```

## 登录页文字（2026-11-24）

Cloudflare 免费品牌设置已加入中俄双语课堂名称、欢迎语与邮箱验证码说明。欢迎语为“欢迎登录娜斯佳私人俄语课堂 / Добро пожаловать на частные уроки русского языка с Анастасией Янукович!”。Cloudflare 固定的 Log in to、Email、Send login code 控件仍保留英文；未升级付费 HTML 模板，也未更改白名单与会话设置。品牌文字在 Zero Trust → 可重用组件 → 自定义页面 → 访问登录页面中维护。

## 界面更新（2026-11-24）

课程首页、课堂笔记和三份点读教材统一为 Apple 风格的浅灰背景、白色圆角卡片、系统字体、蓝色主操作、分段阅读切换和半透明导航。手机可通过顶部“学习工具”展开目录、页码和播放速度；主要手机控件的触控高度至少为 44 px。遵循系统减少动态效果偏好，原图热点仍使用原始坐标。

样式源为 `deployment/apple-ui.css` 和 `deployment/home-ui.css`。`deployment/sync-ui.mjs` 将阅读样式内联进四份 HTML，保持离线阅读能力；每次同步核对嵌入教材 JSON 的 SHA-256，防止图片、音频及词语数据意外变化。build.mjs 在打包前自动同步。首页由 server.mjs 的 renderHome 生成。

已在桌面和 390 px 手机视口验证首页、工具展开、笔记朗读进度、静音、教材翻页和阅读视图切换。浏览器未报告脚本错误；安全测试和线上未登录绕过检查通过。新修订版本 `russian-reader-00003-vrq` 接收 100% 流量。此次视觉检查使用仅绑定 127.0.0.1 的本地预览，不导出线上登录 Cookie；上线后未再次进行真人验证码登录。

无新增付费服务、外部字体或第三方前端库。Cloudflare 托管验证码页继续使用已有的双语品牌设置，受免费版布局限制。需要回滚此次界面时可切回同样使用 Access 的 `russian-reader-00002-7gg`，不得回滚到使用旧密码的 00001 修订版本。

## 登录页漫画头像（2026-11-24）

通过内置 image_gen 将现有教师头像转为插画漫画头像，成品为 `assets/teacher-cartoon.png`；生成提示记录在同目录的 teacher-cartoon.prompt.txt。原始参考照仅保存在本地 .local，不加入公开资产。

Cloudflare 免费品牌设置使用浅灰背景 #f5f5f7、现有双语欢迎语，并将徽标设置为公开漫画头像 URL：
`https://russian-reader-103843597903.europe-west1.run.app/public/teacher-cartoon-v1.png`。

为在登录前显示头像，后端仅对该精确 PNG 路径开放 GET/HEAD，缓存一天；POST、资产目录、原始照片、课程和其他路径仍需原有身份验证。测试覆盖例外边界，线上 smoke 对图片做哈希比对并继续检查所有课程和旧会话绕过。没有新增付费套餐或存储服务，图片随现有 Cloud Run 镜像发布。

Cloudflare 免费版不能替换表单 HTML/CSS，因此此方案定制品牌与背景，不声称完整替换为 Apple 原生登录组件。

## 免费登录欢迎页（2026-11-24）

主要登录入口：https://login.anastasiay.ipv64.net/ 。这是独立的公开欢迎页，点击任一语言的登录按钮才进入原受 Access 保护的网站。直接打开 anastasiay.ipv64.net 仍会进入 Cloudflare 验证，不会先显示欢迎页。

- Worker：russian-classroom-welcome，版本 53c98f9e-4879-4257-b16a-7cee6d61e1ca。
- 源码：welcome.html、welcome-worker.mjs、wrangler-welcome.jsonc，均位于 deployment 目录。
- 桌面头像直径 224 px，窄屏 176 px；教师姓名仅出现一次。
- 桌面中文、俄语左右分栏；宽度不超过 680 px 时分区纵向排列，每个区块只用一种语言，不含英文文案。
- 头像在欢迎页 Worker 边缘缓存一天，减少 Google 源站流量。只开放欢迎页和固定头像，课程路径返回 404；不接收账号或验证码提交。
- 原 Access 验证页也移除重复姓名：组织显示名为 Анастасия Янукович，应用名为 Private Russian Classroom；页眉仅中文，底部说明仅俄语，默认英文表单独立显示。

已验证正式域名、图片哈希、姓名单次出现、公开路由范围、POST 拒绝、HEAD 响应，以及登录按钮进入原邮箱验证页。原站的全部课程与直接源站防绕过检查继续通过。桌面与 615 px 窄屏实际呈现已检查；浏览器尺寸覆盖未生效，因此不把本次检查记为 390 px 真机验证。

没有升级付费套餐，发布后已退出 Wrangler 并确认本地登录配置清除。更新欢迎页时使用：

```powershell
npx wrangler deploy --config deployment/wrangler-welcome.jsonc
npx wrangler logout
```

不要在此 Worker 中加入课程代理或身份凭据；它只展示公开欢迎页和漫画头像。

## 全站统一大漫画头像（2026-11-24）

首页、错误提示页、课堂笔记及三份点读教材统一使用 assets/teacher-cartoon.png。首页与阅读页头像为桌面 160 px、窄屏 128 px；阅读页头像移至页首，不再随手机工具栏折叠。欢迎页为桌面 280 px、窄屏 208 px。Cloudflare 验证页继续使用同一漫画头像，但其原生图标尺寸由平台固定。

阅读文档内嵌漫画头像以保留离线显示；每份文档压缩后约增加 2.13 MB。已核对四份文档的头像解码 SHA-256 与原始漫画 PNG 完全一致，并保留嵌入教材 JSON 的完整性检查。手机工具收起时头像仍可见，桌面和 615 px 窄屏已检查。

Cloud Run 当前修订版本 russian-reader-00005-786，镜像标签 20261124-avatars-v2；欢迎 Worker 版本 90c6b5ea-8a01-4878-9cce-cc07213e8534。安全测试与线上绕过检查通过，发布后已退出 Wrangler。未新增付费服务；教材下载量因内嵌头像有所增加。

## 浅色、深色与跟随系统（2026-11-24）

首页、错误提示页、笔记、三份教材和公开欢迎页均提供外观选择。默认跟随 prefers-color-scheme；手动浅色/深色优先。欢迎页中文与俄语控件同步，仍各自使用单一语言。漫画头像和教材扫描图不反色。

共享实现为 theme.css 和 theme-script.txt。课程文档由 sync-ui.mjs 内联，保持离线可用；首页由 server.mjs 内联。欢迎 Worker 只在 /theme.js 和 /theme.css 提供固定静态资源，CSP 仅新增同源脚本和样式许可，不允许任意外部脚本。

偏好使用 reader_theme 本地存储，并在正式域名以同名非敏感 Cookie 共享给 login 子域；Cookie 只接受 system、light、dark 三个值，Secure、SameSite=Lax，不承载身份或课程权限。系统主题变化、同源 storage 事件和跨子域回到页面时会更新显示；存储不可用时仍可在当前页面切换。

Cloudflare 托管验证码页无法加入本站主题控件，已关闭固定浅色背景，让其使用平台默认外观；不承诺与本站的手动选择同步。

新增功能测试覆盖系统变化、手动覆盖、持久化、双语控件同步、共享偏好与禁用存储，四项自动测试全部通过。浏览器已验证本地首页和课程深/浅切换、跨页与刷新记忆，正式欢迎页双语切换与刷新记忆，未发现脚本错误；原安全 smoke 继续通过。本次未重新进行真人 OTP 登录。

当前 Cloud Run 修订 russian-reader-00006-zt8；欢迎 Worker 版本 d89899bc-0937-4e93-923a-8a02d28592b0。发布后已退出 Wrangler。没有新增付费套餐或服务。

## 11月24日课堂词汇补充

将用户文字与截图中的词汇加入 course.html，新增 31 个不重复词条，共 66 项、9 个主题。原有 отлично、Что значит «как дела»?、книга 保留并合并，重复的 спортсменка 和 журнал 只新增一次。新分组为职业人物、物品购物、名词的性、姓名昵称；包含截图中的全部五个阳性例词、两个中性例词及三组姓名昵称。

词条源为 deployment/course-additions-20261124.json，合并脚本为 deployment/update-course-20261124.py。所有新词均有规范重音、中英文释义及可展开的发音/用法说明。复用教材中已有的俄语男声音频，另使用已安装的 edge-tts 与 ru-RU-DmitryNeural 为 камень、преподавательница、криминал、белоруска 补充四段 MP3；源文件位于 assets/course-audio，最终音频全部内嵌在笔记中。没有新增云端语音服务或运行时语音请求。

检查覆盖：全部用户及截图词汇存在、66 个唯一键、分组索引完整、所有音频均可解码且非空；浏览器中 66 张卡片和 9 个主题显示正确，四段新增音频完成点读，中文解释可展开，未见浏览器脚本错误。四项原自动测试与线上 Access 防绕过检查通过。Cloud Run 修订 russian-reader-00007-vhf 接收 100% 流量，镜像标签 20261124-notes-v1。本次没有重新进行真人 OTP 登录。

## 咖啡、年龄、学校教师与家庭专题（2026-11-24）

新增 39 个不重复词条，并将已有词条按专题重新归类，现为 105 个词条、15 个主题。第 10 节区分咖啡饮料、咖啡馆和咖啡店；第 11–13 节讲女性、男性与通用年龄称呼，说明年龄边界和称呼语气；第 14 节区分幼儿园、中小学、学院与大学常见教师称呼，附职务/职称区别；第 15 节包括 23 个家庭成员、亲属词条。

新内容源为 deployment/course-topics-20261124.json，由 deployment/update-course-topics.py 合并。每个词条只保留一张卡片，按新分组顺序重新编排内部索引，使连续朗读不会跳回旧分组。两张对照表用 textContent 创建单元格，兼容现有浅色与深色主题，窄屏在表格内部横向滚动。

复用 17 段教材录音，以现有 edge-tts / ru-RU-DmitryNeural 补充 22 段音频，源文件继续保存在 assets/course-audio。所有 105 个词条均含内嵌音频、重音/拼写、中英文词义和发音用法说明。没有新增云端语音调用服务。

检查通过：105 个唯一键、15 个非空分组、每个词条恰好归入一组、连续索引与阅读顺序一致、音频全部非空且可解码、专题合并可重复执行（比较标准化换行后的内容），原教材词条无遗漏。浏览器验证了两个对照表、咖啡、幼教称呼和堂表亲长词组点读；105 张卡片及 15 个主题显示正确，无脚本错误。四项自动测试与线上 Access 防绕过检查通过。

Cloud Run 当前修订 russian-reader-00008-r9c，100% 流量；镜像标签 20261124-topics-v1。此次未重新进行真人 OTP 登录，未操作 Wrangler，原主题与白名单保护保持。

内容维护应使用当前专题合并脚本，旧 update-course-20261124.py 只保留作历史记录，不应在新专题版本上重新执行。参考词义来源包括 Gramota 的咖啡店词条 https://gramota.ru/meta/kofeynya 及青年称呼词条 https://gramota.ru/poisk?mode=slovari&query=молодой 。

## 新增舒缓回应句（2026-11-24）

在第 2 节“问候与回应”加入 Коне́чно, спеши́ть не́куда.，释义“当然，不用着急。”，英语 Of course, there is no hurry.。说明包含 конечно 中 чн 的常用读法、两个后续词的重音，以及时间充裕时的使用语境。

配置位于 deployment/course-phrases.json，由 deployment/update-course-phrases.py 合并；保持词条唯一并按分组重新排列朗读索引。笔记现有 106 个词条、15 个主题。

Edge Dmitry 本次整句生成未返回音频，最终改用本机已安装的 Microsoft Pavel 俄语男声生成 WAV，再用已安装的 imageio-ffmpeg 编码为 assets/course-audio/phrase-no-rush.mp3。最终 MP3 完整内嵌，运行时不调用语音服务。已验证音频可完整解码、数据中只含一条该表达、位于第 2 节且朗读顺序连续；四项现有自动测试通过。

本句发布修订 russian-reader-00009-wfq，接收 100% 流量；镜像标签 20261124-phrase-v1。线上 Access 保护 smoke 通过。

## 右下角翻页

2026-11-24：课程目录、课堂笔记及三册教材均增加固定在右下角的导航按钮。教材优先使用原有翻页逻辑，册末进入下一册，第 108 页返回目录；按钮适配深浅色、键盘焦点和手机安全区域。通过 sync-ui.mjs 同步，不改动嵌入的课程和音频数据。

2026-11-25：右下角导航增加同款“上一页”，与“下一页”并排。优先使用教材页内翻页；每册首页可返回上一册末页，课堂笔记返回目录。课程目录的“上一页”禁用。
