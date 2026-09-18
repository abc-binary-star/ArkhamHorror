# 前端视觉交接

本仓库提供复用当前前端样式所需的源码和 UI 资产。完整卡牌图片由接收方提供，不加入 Git；音频不是视觉交付的一部分。

## 需要一起保留的目录

- `frontend/src/`：Vue 页面、交互组件、布局、样式、中文文案、图标映射与动画数据。
- `frontend/public/assets/`：当前主题背景、纸纹、装饰、导航和牌桌素材（45 个文件，约 24.9 MiB）。
- `frontend/public/fonts/`：牌面符号字体、英文字体和中文思源宋体（22 个文件，约 7.1 MiB）。不可只复制 CSS 而漏掉字体。
- `frontend/public/img/` 中已跟踪的通用图片：牌背、混沌标记等，共 205 项，列表在 `frontend/scripts/runtime-images.json`。
- `frontend/public/build/`：内嵌卡组构筑器及其页面资源。
- `frontend/card-data/`、`frontend/homebrew/` 中已跟踪的数据：卡牌文字及自定义内容定义，不是完整卡面图片。
- `frontend/package.json`、`frontend/package-lock.json`、Vite 配置和 `frontend/scripts/`：锁定依赖和数据生成流程。
- `design-assets/`：已有的视觉设计源稿与清单，供参考；不是页面加载时的替代资源目录。

公共资源路径以站点根目录为基准（例如 `/assets/`、`/fonts/`）。迁移到其他框架时需要保持路径，或同时修改引用。迁移时还要一起带上 `src/styles/`、入口样式导入、主题 CSS 变量与 i18n，单独复制 Vue 模板不能复现完整样式。

## 启动

使用符合 Vite 7 要求的 Node.js（20.19+ 或 22.12+）。在 `frontend` 中运行：

```sh
npm ci
npm run dev
```

`predev` / `preserve` 会从已跟踪的 `card-data` 生成被忽略的 `public/cards`；生产构建已有对应 `prebuild`。生成文件不必提交。

Vite 开发服务器默认监听 8080，并将 `/api` 转发给本机 3002 后端。登录、牌局、战役日志等页面依赖后端数据，单独复制前端不能创建相同的游戏状态。使用配套后端或接收方自己的等价数据接口；卡牌左上角的静默铃铛还依赖配套的 `SetCardSilenced` 消息处理。

## 接收方已有的卡牌图片

完整卡面、翻译卡面、头像等大型图库继续不进 Git。默认使用 `https://assets.arkhamhorror.app`，也可在本地环境文件设置 `VITE_ASSET_HOST`，并保持 `/img/arkham/` 下的目录结构。服务端 `/api/site-settings` 返回的 `assetHost` 也会影响最终地址。

若使用已有本地图库，将资源放入 `frontend/public/img/arkham/`，并把 `VITE_ASSET_HOST` 设为空字符串，同时让后端站点配置使用本地资产地址。自定义战役图片沿用 `frontend/homebrew/<campaign>/img/` 结构。

核心 UI 图片清单现在直接走本地公共资源，不依赖卡牌 CDN。Vite 的资源镜像中间件优先放行实际存在的本地图片；只有缺少的图片才请求 CDN。

## 音频与 Git 边界

音乐和音效文件已从当前版本的 Git 跟踪中排除，原本地文件保留。音频播放代码、资源出处和许可证文本仍保留。新克隆没有这些可选声音，不影响视觉布局；可在界面关闭音乐、音效开关，或自行放入相同路径的本地文件。

排除当前版本的文件不等于删除 Git 历史中的音频。本次不会重写历史。

## 静态清点

在 `frontend` 运行：

```sh
npm run assets:check
```

检查运行时图片清单、主题素材、字体、源码直接引用的公共图片是否存在并已跟踪，同时禁止音频文件进入索引。它不启动浏览器、不运行构建，也不验证动态卡面 URL、游戏数据或像素级显示效果。

此次交付仅做源码和文件/Git 检查，未做浏览器视觉验收。复现时请使用相同语言、字体、视口和牌桌模式；接收方卡面版本及数据不同会影响卡牌内容显示。
