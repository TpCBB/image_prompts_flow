# 数据库端列表与统计

已有项目先应用 `supabase/migrations/20261110121918_gallery_queries.sql`，再发布网站。新项目先执行 `supabase/schema.sql`，再按时间顺序执行 `supabase/migrations/` 下的迁移。

迁移新增 `gallery_prompts` 只读视图、`gallery_filter_metadata(text)` 聚合函数和带 ID 排序的索引，不修改或删除原始提示词。

- 图片提示词先在数据库中按图片地址选定固定代表，再执行搜索、分类、标签和分页。同一张图片的代表沿用原来的 SHA-256 规则，切换展示域名不会更换代表。功能性提示词和没有图片的条目不参加图片去重。
- 列表直接查询视图，不再先全量读取元数据或拼接排除 ID。首页与列表 API 共用查询、60 秒缓存和并发合并。
- 分类和标签数量由函数聚合后一次返回，数量不受单次 1,000 行上限影响。同一提示词的重复标签只计一次，分类和标签中的 NSFW 判断忽略大小写及首尾空格。统计缓存 5 分钟。
- 视图启用 `security_invoker`；视图与函数仅授权 `service_role`，匿名访客和普通用户不能绕过网站限流直接查询。

`src/__tests__/lib/gallery-database.test.ts` 使用内存 PostgreSQL 执行真实建表和迁移 SQL，验证 1,100 多条数据的去重、统计及权限。页面、API 仍使用现有 Supabase PostgreSQL。

回退网站代码时可以保留这些新增对象，它们不会影响旧查询。需要清理时，先停用新查询，再删除函数、视图和 `prompts_type_created_id_idx`；保留 `prompts` 表与所有数据。
