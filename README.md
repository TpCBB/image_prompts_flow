# AI Image Prompts 图像提示词库

基于 Next.js 15、React、TypeScript 和 Supabase 的提示词库，支持图片 / 功能性提示词切换、中英文展示、搜索、分类、标签、分页和一键复制。

## 本地运行

```bash
npm ci
cp .env.local.example .env.local
```

在 `.env.local` 中填写 Supabase 项目地址和仅供服务端使用的 `SUPABASE_SERVICE_ROLE_KEY`。新数据库先执行 `supabase/schema.sql`，再按顺序执行 `supabase/migrations/` 下的迁移。网页通过服务端读取，不需要向浏览器提供数据库密钥。已有项目的升级步骤见 [数据库查询](docs/database-queries.md)。

```bash
npm run dev
```

打开 http://localhost:3000。

## 功能与查询规则

- 默认展示图片提示词，按创建时间和 ID 倒序分页，每页 24 条。
- 同一图片被多个图片提示词引用时，随机固定保留一条展示，其余条目隐藏；搜索、筛选、标签统计和分页总数使用同一规则。
- 搜索覆盖中英文标题、提示词正文和作者，最多 200 个字符。
- NSFW 分类和标签在筛选入口、卡片及详情标签中隐藏，默认列表排除 NSFW 分类；不删除数据库记录。
- 图片去重、分类和标签统计由数据库执行，应用只接收分页结果和聚合数据；同一类型的统计共享 5 分钟缓存和进行中的查询。
- 切换筛选会取消旧请求，清空筛选恢复首页数据；切换语言保留当前列表和已加载的分页。
- 搜索、分类、标签、语言、提示词类型与详情 ID 同步到网址，支持刷新恢复和浏览器前进 / 后退。详情可复制链接；直接打开详情链接后关闭弹窗会回到当前列表。
- 图片按需加载，加载失败时显示本地占位图。
- 首屏数据在加载时显示骨架屏；数据库或筛选统计失败时显示可重试的错误页，真实空结果与故障分开处理。首页按请求渲染，成功数据仍共享 60 秒缓存。

## API

公开读取：

- `GET /api/prompts`：支持 `search`、`category`、`tag`、`prompt_type`、`page` 和 `limit`；`prompt_type` 默认 `image`，可选 `functional`，`limit` 范围 1–100。
- `GET /api/prompts/:id`：查询单个提示词。
- `GET /api/categories`、`GET /api/tags`：可传 `prompt_type` 筛选。

管理写入：

- `POST /api/prompts`：新增。
- `PUT /api/prompts/:id`：修改。
- `DELETE /api/prompts/:id`：删除。

写入需要在服务端配置 `SUPABASE_SERVICE_ROLE_KEY` 和 `ADMIN_API_TOKEN`，并携带 `Authorization: Bearer <ADMIN_API_TOKEN>`。管理令牌只供受信任的服务端或本地工具使用，不能放入浏览器代码或 `NEXT_PUBLIC_` 环境变量。未配置管理令牌时写入返回 403，令牌缺失或不匹配时返回 401。

## 验证

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

测试包括筛选切换的异步竞态、分页去重、重复图片的固定展示选择、请求取消和超时、管理写入授权、查询参数校验，以及超过 1000 条数据时的标签统计。

`npm run check` 一次运行代码检查、类型检查与测试。推送和 Pull Request 会触发同样的自动检查，并构建服务端应用；检查流程不使用生产数据库密钥，也不发布网站。构建使用系统字体，不依赖下载 Google 字体。

## 部署

本项目使用服务端渲染和 API 路由，需要 Vercel 等支持 Next.js 的平台，或运行 Node.js 服务，不能直接部署到仅托管静态文件的 GitHub Pages。

已有 GitHub Pages 自动发布流程已移除，改为持续检查。Vercel 使用现有 Git 集成或平台部署命令发布，发布前先应用数据库迁移、准备并发布图片素材，具体见 [数据库查询](docs/database-queries.md) 和 [图片托管](docs/image-storage.md)。

Vercel Production 必须有共享 Redis 限流配置：可使用 Marketplace 自动注入的 `KV_REST_API_URL` / `KV_REST_API_TOKEN`，或手动配置完整的 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`。手动配置优先，不能混用两套凭据；缺失或故障时页面和 API 返回 503。完整的上线顺序、数据库匿名直连关闭步骤和保护边界见 [防刷配置](docs/abuse-protection.md)。

在部署平台配置与 `.env.local` 对应的环境变量，然后执行：

```bash
npm run build
npm start
```

`R2_*` 环境变量为图片上传工具预留，当前浏览页面不依赖它们。通过 `NEXT_PUBLIC_IMAGE_BASE_URL` 明确配置自己的静态图片服务；不配置时只访问本站同路径静态文件。

### 正式环境与预览隔离

Vercel 的 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、管理令牌及正式 Redis 凭据只勾选 **Production**，不要同时勾选 Preview。浏览器不需要数据库密钥，历史 `NEXT_PUBLIC_SUPABASE_*` 配置也不要共享到 Preview。

Preview 只读取 `PREVIEW_SUPABASE_URL` 和 `PREVIEW_SUPABASE_SERVICE_ROLE_KEY`，必须指向另一个测试数据库；缺少任一项时构建会明确失败，不会回退使用正式库。尚无独立测试库时保持 Preview 未配置即可，GitHub 检查仍使用假的本地构建配置。代码也会拒绝与同次部署的通用配置相同的数据库地址或管理密钥，但不能识别被单独复制且改名的正式凭据，因此仍须在平台上正确限定变量环境。

预览需要图片时另配测试图片域名或本站静态文件。仓库中的 Cloudflare 配置使用示例 Worker 名称；正式账号与发布目标保存在被忽略的 `image-hosting/wrangler.production.local.jsonc` 中，发布时显式选择该文件。克隆项目不会获得 Cloudflare 授权，部署前仍须使用自己的账号登录。

检查步骤与历史部署处理见 [环境隔离](docs/environment-isolation.md)。

## 许可

MIT License
