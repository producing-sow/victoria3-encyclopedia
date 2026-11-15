# 更新记录 / Changelog

## v2026.11.15 — 本地一键更新与 MOD 支持

这是百科的发布版本号，内置原版游戏数据为 **Victoria 3 1.15.1 (Ivan-Chai)**。

### 新增与改进

- **百科内启动更新**：侧栏进入“更新百科”，可启动本地更新程序。首次运行 `打开百科.cmd` 或 `更新数据.cmd` 注册 Windows 启动入口，此后按浏览器提示打开即可；移动百科文件夹后需重新运行一次 CMD。
- **原版一键更新**：填写游戏根目录，重新生成八个原版模块、游戏图标与中英文数据，显示更新日志。原版文件内容变化才新增快照，重复更新或仅文件时间变化不会重复归档。
- **MOD 更新设置**：可选择仅原版、仅所选 MOD，或一起更新；自动查找当前游戏所在 Steam 库中的 MOD，也可填写其他安装路径。路径仅保存在本机。
- **MOD 不生成快照**：工业之链、真实资源、更多公司及其独立汉化更新当前中英文图鉴，不混入原版版本对比。勾选的 MOD 全部生成并校验成功后才替换其数据；失败保留原 MOD 数据。一起更新时，已成功保存的原版更新不因后续 MOD 失败而撤销。
- **工业之链图鉴**：独立数据切换、生产方式组合与产值计算；覆盖 144 类建筑，支持投入产出百分比和吞吐量修正。
- **真实资源地图**：独立的 676 州资源配置与 502 项州特质，保留原版地图几何与人口数据。
- **更多公司图鉴**：923 家公司，含 692 家新增及 231 家覆盖条目；支持中文检索、行业筛选、成立条件、名贵商品与原版条目对照。
- **资料与界面**：保留 1.15.0 历史快照，增加 1.15.1 快照；完善 MOD 来源与作者署名、中英文显示及页面样式。

### 下载和使用

1. 下载本发布附件 **victoria3-encyclopedia-v2026.11.15.zip**，完整解压。
2. 只查阅资料：直接打开 `index.html`，无需安装游戏或 Python。
3. 更新数据：安装 Python 3.10+，执行 `python -m pip install Pillow numpy`，然后双击 `更新数据.cmd`。填写包含 `game` 和 `launcher` 的游戏根目录，选择更新范围。
4. 更新 MOD 时勾选项目并确认路径；更多公司需要本体与汉化两个目录。自动查找未找到时可手动填写。单独更新 MOD 前，原版百科与游戏版本需一致，否则选择一起更新。
5. 原版差异在“版本档案与对比”查看。保留更新程序窗口直至更新完成。

下载包含已生成的中英文数据和图标，不含游戏安装文件、MOD 安装包、用户路径设置或宣传视频制作文件。原有游戏与 MOD 素材归各自权利人所有，参见 [MOD 来源与署名](MOD_CREDITS.md)。

### 验证

已实际完成原版与三个 MOD 的提取更新，并验证重复更新不重复归档、MOD 不修改原版快照、失败恢复、更新接口与路径校验。中英文数据一致性、原版各模块、三个 MOD 图鉴及更新页面的桌面／手机交互检查均通过。

### English summary

- Bundled vanilla data updated to Victoria 3 **1.15.1**; earlier vanilla snapshots remain available.
- Added an in-page local launcher and full bilingual vanilla rebuilds with content-based snapshots.
- Added selectable MOD updates, Steam-library path detection and locally saved paths. MOD updates replace current catalogs without creating or altering vanilla snapshots.
- Included Chains of Industry, Explorable Real-World Resources, and More Unique Companies with Chinese localization and source credits.
- Download and extract the attached ZIP, then open `index.html` for offline browsing. For local updates, install Python 3.10+, Pillow and NumPy, and run `更新数据.cmd` once. Accept the browser prompt when launching the updater from the page.

Created by **Alice Junior**.
