# AI Image Prompts 图像提示词库

基于 Next.js 15、React、TypeScript 和 Supabase 的提示词库，支持图片 / 功能性提示词切换、中英文展示、搜索、分类、标签、分页和一键复制。

## 本地运行

```bash
npm ci
cp .env.local.example .env.local
```

在 `.env.local` 中填写 Supabase 项目地址和匿名访问密钥。数据库需要包含 `prompts` 和 `tags` 表，并配置相应的公开读取权限。

```bash
npm run dev
```

打开 http://localhost:3000。

## 功能与查询规则

- 默认展示图片提示词，按创建时间和 ID 倒序分页，每页 24 条。
- 同一图片被多个图片提示词引用时，随机固定保留一条展示，其余条目隐藏；搜索、筛选、标签统计和分页总数使用同一规则。
- 搜索覆盖中英文标题、提示词正文和作者，最多 200 个字符。
- NSFW 分类和标签在筛选入口、卡片及详情标签中隐藏，默认列表排除 NSFW 分类；不删除数据库记录。
- 分类和标签统计使用分页读取，避免数据超过单次查询上限后遗漏；同一类型的统计共享 60 秒缓存和进行中的查询。
- 切换筛选会取消旧请求，清空筛选恢复首页数据；切换语言保留当前列表和已加载的分页。
- 图片按需加载，加载失败时显示本地占位图。

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
npx tsc --noEmit
npm run build
```

测试包括筛选切换的异步竞态、分页去重、重复图片的固定展示选择、请求取消和超时、管理写入授权、查询参数校验，以及超过 1000 条数据时的标签统计。

## 部署

本项目使用服务端渲染和 API 路由，需要 Vercel 等支持 Next.js 的平台，或运行 Node.js 服务，不能直接部署到仅托管静态文件的 GitHub Pages。

在部署平台配置与 `.env.local` 对应的环境变量，然后执行：

```bash
npm run build
npm start
```

`R2_*` 环境变量为图片上传工具预留，当前浏览页面不依赖它们。现有图片源配置在 `src/lib/config.ts`。

## 许可

MIT License
