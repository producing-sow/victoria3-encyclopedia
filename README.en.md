# Victoria 3 Encyclopedia

Latest release: [v2026.11.15 · Downloads & release notes](https://github.com/producing-sow/victoria3-encyclopedia/releases/tag/v2026.11.15) · [Changelog](CHANGELOG.md)

[简体中文](README.md) | **English**

An interactive encyclopedia built from Victoria 3 game files, bringing together production, resources, companies, cultures, religions, geopolitics, laws, characters, and military units. Explore the game through Chinese and English interfaces, offline browsing, combined filters, and visual statistics.

From a factory's inputs and outputs to a country's population breakdown, from laws and amendments to character ideologies and personality traits: connected entries, maps, and charts make it easier to look up mechanics, compare options, and plan a campaign.

## Features

| Module | What you can explore |
| --- | --- |
| Buildings & Production | Combine production methods and compare inputs, outputs, workforce, and theoretical net output value. Browse rankings, base goods prices, and unlock requirements. |
| State Resource Map | Explore resources, arable land, population, cultures, and state traits on an interactive map. Combine resource requirements to find suitable states. |
| Companies | Browse core and expansion industries, preferred headquarters, prestige goods, prosperity bonuses, and establishment conditions. Filter by industry and effects. |
| Cultures & Religions | Explore heritage, languages, traditions, faiths, and starting population distributions. Compare cultural and religious acceptance scores under different laws. |
| Geopolitics | Explore 1836 country profiles, population charts, resources, buildings, armed forces, starting laws, power blocs, and nested subject relationships. |
| Laws | Browse laws and special institutions by their in-game categories. Preview amendments, tax levels, and institution investment effects; inspect starting adoption through country lists and pie charts. |
| Characters | Filter historical character records by country, name, role, ideology, and traits. Explore biographies, stances on laws, and trait effects for different roles. |
| Military | Browse army and navy unit types, mobilization options, and supply effects. Inspect starting formations, national force composition, and global distributions. |
| Version History & Comparison | Save local data snapshots, inspect field changes, and compare production methods, resources, and population across saved versions. |

## Designed for browsing and comparison

- **Chinese / English:** Switch languages at the top of the page and retain your preference.
- **Game icons and maps:** Recognize entries through original icons and localized names, with links between related topics.
- **Combined filters:** Narrow results by country, category, name, resources, ideology, and other criteria.
- **Charts and exports:** Explore pie charts and detailed tables, with CSV or JSON exports where supported.
- **Offline and responsive:** Open the generated encyclopedia directly in a browser. No backend service is required, and layouts adapt to desktop and narrow screens.
- **Traceable data:** Relevant entries expose definitions, conditions, sources, or counting rules, distinguishing explicit settings from inferred defaults and conditional content.

## Getting started

1. Download or clone the project, keeping the complete directory structure, including `assets/`, `en/`, and the generated data files.
2. Open `index.html` in a browser to explore the bundled encyclopedia.
3. Select **English** in the language control and use the sidebar to navigate between modules.

Opening the HTML directly does not require Python or read your local game installation. On Windows, `打开百科.cmd` also launches the encyclopedia, first attempting to check the local game files for changes.

Additional operating and calculation details are available in the [Chinese usage guide](使用说明.md).

## Updating data and project structure

The frontend uses HTML, CSS, and JavaScript. Python scripts extract definitions, localization, and images from a local game installation and generate browser-readable data. Regeneration requires local game files, Python, Pillow, and NumPy. Parts of the English translation completion process may access the network.

On Windows, run `更新数据.cmd` to force an update, or use `python version_history.py --force`. The build scripts currently use the author's default game installation path; check and adjust installation paths in the scripts before regenerating on another computer. The extraction process reads game files without modifying the installation.

| File or directory | Purpose |
| --- | --- |
| `index.html` and other `*.html` files | Encyclopedia module entry points |
| `*.js`, `*.css` | Page interactions, data, and styles |
| `assets/`, `en/` | Image assets and English data |
| `build_*.py` | Game data extraction and localization generation |
| `version_history.py`, `history/` | Updates, snapshots, and version records |
| `verify-*.cjs`, `verify-*.py` | Module data and logic checks |

## Data scope

The current content is based on locally extracted **Victoria 3 1.15.1 (Ivan-Chai)** data. Refer to the version shown in the interface and snapshot records for the exact dataset in use.

- Starting statistics are based on static 1836 definitions, not a live save. Some runtime scripts, events, and conditions are not evaluated; inferred defaults and conditional records are identified in the interface.
- Theoretical net output value uses base goods prices and excludes wages, taxes, and other costs. It is not actual profit or a prediction of the best production setup in a live market.
- Law, institution, and amendment previews compare defined effects without simulating every enactment requirement or save-specific modifier.
- Character counts represent fixed templates and creation records. One historical person may have multiple templates; generators without fixed names are excluded.
- Version comparisons cover saved base-game snapshots only. Buildings & Production also offers a separate Chains of Industry dataset, kept outside base-game snapshots.

## Feedback

See [MOD Sources & Credits](MOD_CREDITS.md) for original authors, Chinese localization authors, and translation contributors. Relevant modules also link to the original Workshop pages.

Issues reporting data errors, translation problems, and feature suggestions are welcome. Please include the game version, page, entry name or ID, and screenshots or reproduction steps when possible.

Created by **Alice Junior**. This is an unofficial, fan-made encyclopedia. The Victoria 3 name, icons, and game assets belong to their respective rights holders.


### One-click local updates

Run `打开百科.cmd` or `更新数据.cmd`, open **Update encyclopedia**, enter the Victoria 3 installation folder (containing `game` and `launcher`), and click **Update entire encyclopedia**. Keep the service window open. Requires Python 3.10+, Pillow and NumPy (`python -m pip install Pillow numpy`).

All eight vanilla modules, icons and both languages are rebuilt. Only vanilla file-content changes create a new snapshot, including same-version hotfixes; repeated updates and timestamp changes do not. Previous snapshots remain available in Version Archive, and failed builds preserve existing data. MOD catalogs are maintained separately and excluded from vanilla snapshots. Direct changes to installed game files still count as differences; Steam file verification restores vanilla files. Static/GitHub pages require the local launcher to perform updates.

CLI: `python version_history.py --root "D:\SteamLibrary\steamapps\common\Victoria 3" --force`. Force rebuilds without forcing duplicate snapshots. The selected path is stored locally and ignored by Git.


### In-page launcher and MOD updates

Run either local CMD launcher once to register `v3encyclopedia://update` for your Windows user. Afterwards, click **Launch local updater** inside the encyclopedia and accept the browser prompt. Re-run the CMD after moving the folder. Registration does not require administrator rights; remove `HKEY_CURRENT_USER\Software\Classes\v3encyclopedia` to unregister.

Choose vanilla only, selected MODs only, or both. Auto-detection searches the game's Steam library. Enter paths manually for other libraries or local MODs. Supported catalogs: Chains of Industry (3723966801), Real Resources (3459869359), and More Unique Companies (3032185644) with its Chinese translation (3086429193). Paths are saved locally.

MOD updates replace current bilingual catalogs without creating snapshots or changing vanilla archives. Failed MOD builds preserve existing MOD catalogs. Combined updates save vanilla first and MODs second; a MOD failure does not undo a completed vanilla update. MOD-only updates require the vanilla catalog to match the installed game version.
