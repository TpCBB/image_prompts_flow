# Vercel 上线与防刷配置

## 代码中的规则

- 同一访客的页面与 API 请求合计每分钟 60 次，10 秒最多 15 次。
- 搜索额外限制每分钟 20 次、10 秒 5 次。更换搜索词、页码、路径不会重置总额度。
- 写操作额外限制每分钟 10 次，仍需要管理令牌。未提供令牌不能写入。
- 所有访客合计每分钟最多 600 次。这是小型站点的初始上限，应根据正常流量调整；攻击期间正常访客也可能收到繁忙提示。
- 超频返回 429 和 `Retry-After`；共享存储缺失或故障返回 503，不放开数据库查询。这些响应禁止缓存。
- IP 只取 Vercel 管理的转发头，IPv6 按 /64 聚合；Redis 不存原始 IP。IP 限制可能影响共用出口的用户。
- 首页、HEAD、预取请求也检查。静态图片、脚本、样式不计入额度。当前 middleware 保护 `/` 和全部 `/api/*`，新增页面时需扩充 matcher。
- 列表和详情缓存 60 秒，同一进程内相同并发请求只查一次；不存在的详情也缓存。分类与标签统计缓存 5 分钟，管理写入清理当前实例缓存。
- 同一实例最多同时进行 8 个数据库读取，8 秒超时并取消。列表起始偏移超过 10000 时引导使用搜索筛选。
- 浏览器遇到 429 / 503 不自动重试，避免放大拥堵。
- 列表使用提前生成的静态缩略图，详情加载原图；关闭未使用的 Next.js 图片缩放服务，减少额外的计算入口。图片服务配置和素材发布见 `docs/image-storage.md`。

## Vercel 上线顺序

1. 配置 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`。旧的 `NEXT_PUBLIC_SUPABASE_URL` 仍兼容，浏览器不再需要匿名密钥。
2. 从 Vercel Marketplace 添加 Upstash Redis 可直接使用自动注入的 `KV_REST_API_URL`、`KV_REST_API_TOKEN`。也可手动配置完整的 `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`；手动配置优先且必须成对提供。免费方案应关闭自动升级，确认服务条款的步骤由账号所有者完成。建议 Preview 用独立 Redis；计数键也按环境隔离。密钥不能加 `NEXT_PUBLIC_` 前缀。
3. 部署并验证首页、筛选、搜索、详情。**Production 未配置共享 Redis 时，页面和 API 返回 503。** 本地与 Preview 未配置时用内存计数，仅适合开发验证。
4. 新版本工作后，在该站点的 Supabase 数据库执行 `supabase/harden-public-access.sql`，取消 `prompts/categories/tags` 的匿名和普通用户直读权限。若数据库被其他网站共用，先核对它们是否依赖这些权限。
5. 复验网站正常；用旧匿名 key 请求 `rest/v1/prompts?select=id&limit=1` 应得到权限错误。不要把管理密钥放进浏览器验证。
6. 在 Vercel Firewall 配置适合该站点的机器人防护和异常流量规则，观察日志及使用量。后台开关与预算配置需要所属 Vercel 项目的访问权限，不能仅靠仓库配置完成。

CLI 发布时先运行 `vercel deploy --dry --json` 核对文件列表。`.vercelignore` 明确排除本地环境文件、`local_data/` 备份、图片原始目录及检查输出；Vercel 的生产配置通过环境变量注入。

可先用 `vercel deploy --prod --skip-domain` 创建使用生产配置的独立部署，验证页面和 API 后再 `vercel promote` 切换正式域名。新版验证通过后应用 `supabase/migrations/` 中关闭匿名读取的迁移；原始表和记录保留。

完成后执行 `npm run verify:access`，使用本地匿名 / publishable key 验证网站仍能展示数据、未授权写入被拒绝、四个数据库表 / 视图的直接读取均返回权限错误。脚本拒绝服务端管理密钥。受限网络下可用 `HTTPS_PROXY=http://127.0.0.1:7891 NODE_USE_ENV_PROXY=1 npm run verify:access`。

规则在 `src/middleware.ts` 中。Redis 使用一个原子 Lua 命令检查全部额度，实例扩容不会重置计数。Redis 故障会暂时影响可用性，这是避免故障期间无限查库的取舍。

## 边界与验证

应用限流不能保证防住大规模分布式攻击，也不能消除已到达 Vercel 入口的请求费用。每次受保护请求都会访问 Redis，入口机器人拦截仍然重要。图片直接来自独立的静态图片域名，不经过应用限流；图片域名的访问保护需要单独管理。

缓存与数据库并发上限是单实例的，总访问额度在配置 Redis 后跨实例共享。管理写入后，其他实例可能继续返回最多 60 秒的旧列表/详情、最多 5 分钟的旧统计。

本地运行 `npm test`、`npx tsc --noEmit`、`npm run build`。测试覆盖搜索换词、IP 处理、HEAD/预取、共享存储失败、窗口恢复、缓存请求合并和写入期间失效、数据库过载及前端不自动重试。

参考：

- [Vercel 访客 IP 请求头](https://vercel.com/docs/headers/request-headers)
- [Upstash Redis REST EVAL](https://upstash.com/docs/redis/commands/scripting/eval)
- [Supabase Data API 权限](https://supabase.com/docs/guides/api/securing-your-api)
