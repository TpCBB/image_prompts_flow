# 图片静态托管

网站和图片单独发布。图片文件通过 Cloudflare Workers Static Assets 直接提供，不运行图片代理脚本，也不绑定 R2。

图片服务地址：`https://image-prompts-flow-images.hsc28yo.workers.dev`。

2026-11-10 已上传全部 1,051 个文件，并逐个读取线上内容，与原始备份的 SHA-256 和文件大小核对，全部一致。

## 图片文件

- 待发布目录：`local_data/image-assets/`，不提交到 Git。
- 原始完整备份：`local_data/r2-backup-2026-11-10/`。
- 图片名称及目录结构保持不变，数据库继续保存相对路径。
- `image-hosting/_headers` 随图片复制到发布目录，设置一小时浏览器缓存。
- `image-hosting/index.html` 是图片域名的说明首页，提供网站和示例图片入口。

备份包含 1,050 张图片和 1 个文本文件。数据库中已有一条引用 `G6YNznVWoAEoBuQ`，原 R2 桶内不存在对应文件，迁移记录中保留了这项检查结果。

## 发布图片

先执行 `npm run images:prepare`，从原图生成 480 / 960 像素 WebP 缩略图和 `src/lib/image-manifest.json` 尺寸清单。原图保留，详情仍使用原图；列表按屏幕宽度选择缩略图，并预留图片比例。生成工具依赖 `sharp`，只在本地准备素材时运行，不增加在线图片处理入口。

缩略图位于 `local_data/image-assets/thumbnails/v1/`，文件名含内容哈希，使用一年不可变缓存。新增或替换原图后需重新生成、提交清单，并先发布图片，再发布网站。缩略图未发布或失效时，卡片依次回退到原图和本地占位图。

2026-11-10 已发布本轮缩略图，保留原图；抽样验证线上文件与本地生成内容一致，且 `Cache-Control` 包含一年缓存和 `immutable`。

```bash
cp image-hosting/_headers local_data/image-assets/_headers
cp image-hosting/index.html local_data/image-assets/index.html
npx --yes wrangler@4.159.0 deploy --config image-hosting/wrangler.jsonc
```

如需登录，使用 Wrangler 登录授权。配置中的 Cloudflare 目标账号是本次授权的 `hsc28yo@gmail.com`，与原 R2 账号不同。

新增图片时，先将文件放入待发布目录，再完整发布这个目录。保留所有仍被网站引用的旧图片。

## 切换网站

图片地址默认配置位于 `src/lib/config.ts`，可通过 `NEXT_PUBLIC_IMAGE_BASE_URL` 使用自定义域名（更改后重新构建网站）。新图片服务验证完成后再切换。完整 URL 会保持原样；第三方图片不使用本地缩略图清单。国内网络访问质量需用目标用户的实际网络验证。

2026-11-10 按用户要求清空旧 R2 桶 `promptsimage` 的全部 1,051 个文件，并确认桶内已无文件。本地原始备份和 ZIP 保留。删除空桶时现有密钥返回 `AccessDenied`，需原 R2 账号的管理权限继续完成；R2 订阅和付款设置尚未更改。
