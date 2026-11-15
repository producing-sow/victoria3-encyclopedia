"""Build an isolated base-game + Chains of Industry dataset, without changing either installation."""
import argparse
import hashlib
import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
DEFAULT_GAME = pathlib.Path(r'F:\Program Files (x86)\Steam\steamapps\common\Victoria 3')
DEFAULT_MOD = pathlib.Path(r'F:\Program Files (x86)\Steam\steamapps\workshop\content\529340\3723966801')
OUTPUTS = [HERE/'industrial-chain-data.js', HERE/'en/industrial-chain-data.js']
MANIFEST = HERE/'industrial-chain-source.json'


def source_fingerprint(game, mod):
    files = [HERE/'build_data.py', HERE/'build_industrial_chain.py', HERE/'localization-fallbacks.json',
             game/'launcher/launcher-settings.json', mod/'.metadata/metadata.json']
    for root in [game/'game', mod]:
        for folder in ['common/goods', 'common/buildings', 'common/production_methods',
                       'common/production_method_groups', 'common/defines',
                       'localization/simp_chinese', 'localization/english']:
            files.extend(p for p in (root/folder).rglob('*') if p.suffix in {'.txt', '.yml'})
    # Include MOD artwork so Steam updates to an existing icon are detected too.
    files.extend(p for p in (mod/'gfx').rglob('*') if p.is_file())
    digest = hashlib.sha256()
    for path in sorted(set(files)):
        digest.update(str(path).encode('utf-8'))
        digest.update(path.read_bytes())
    return digest.hexdigest()


def build(game=DEFAULT_GAME, mod=DEFAULT_MOD, force=False):
    if not game.is_dir() or not mod.is_dir():
        print('工业之链 MOD 或游戏目录不可用，保留现有 MOD 离线数据。')
        return
    fingerprint = source_fingerprint(game, mod)
    if not force and all(p.exists() for p in OUTPUTS) and MANIFEST.exists():
        if json.loads(MANIFEST.read_text('utf-8')).get('fingerprint') == fingerprint:
            print('工业之链 MOD 内容未变化，使用本地数据。')
            return
    staged = [p.with_suffix('.js.pending') for p in OUTPUTS]
    try:
        for language, destination in zip(['simp_chinese', 'english'], staged):
            subprocess.run([sys.executable, '-B', str(HERE/'build_data.py'), str(game),
                            '--mod', str(mod), '--language', language, '--output', str(destination)],
                           cwd=HERE, check=True)
        if source_fingerprint(game, mod) != fingerprint:
            raise RuntimeError('提取期间游戏或 MOD 文件发生变化，请等待 Steam 更新完成再重试。')
        for source, destination in zip(staged, OUTPUTS):
            source.replace(destination)
        MANIFEST.write_text(json.dumps({'fingerprint': fingerprint, 'game': str(game), 'mod': str(mod)},
                                       ensure_ascii=False, indent=2), encoding='utf-8')
        print('工业之链 MOD 中英文建筑数据已更新（独立于原版快照）。')
    finally:
        for path in staged:
            path.unlink(missing_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game', type=pathlib.Path, default=DEFAULT_GAME)
    parser.add_argument('--mod', type=pathlib.Path, default=DEFAULT_MOD)
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    build(args.game, args.mod, args.force)
