"""Update supported MOD catalogs without creating or changing vanilla snapshots."""
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import version_history as history

CATALOGS = {
    'industry': {'name': '工业之链', 'id': '3723966801', 'folder': 'common/buildings', 'output': 'industrial-chain-data.js'},
    'resources': {'name': '真实资源', 'id': '3459869359', 'folder': 'map_data/state_regions', 'output': 'map-real-resources-data.js'},
    'companies': {'name': '更多公司', 'id': '3032185644', 'folder': 'common/company_types', 'output': 'mod-companies-data.js'},
}


def discover(root):
    workshop = pathlib.Path(root).parent.parent/'workshop/content/529340'
    return {key: {'path': str(workshop/info['id']) if (workshop/info['id']).is_dir() else '',
                  **({'translation': str(workshop/'3086429193') if (workshop/'3086429193').is_dir() else ''} if key == 'companies' else {})}
            for key, info in CATALOGS.items()}


def validate(config):
    if not isinstance(config, dict):raise ValueError('MOD 设置格式无效。')
    result = {}
    for key, value in config.items():
        if key not in CATALOGS or not isinstance(value, dict):raise ValueError('不支持的 MOD 类型。')
        if not value.get('enabled'):continue
        info = CATALOGS[key]
        root = pathlib.Path(str(value.get('path', '')).strip().strip('"')).resolve()
        if not (root/info['folder']).is_dir() or not (root/'.metadata/metadata.json').is_file():
            raise ValueError(info['name']+'目录无效，请选择该 MOD 本体文件夹。')
        item = {'enabled': True, 'path': str(root)}
        if key == 'companies':
            translation = pathlib.Path(str(value.get('translation', '')).strip().strip('"')).resolve()
            if not (translation/'localization/simp_chinese').is_dir() or not (translation/'.metadata/metadata.json').is_file():
                raise ValueError('更多公司需要独立的汉化 MOD 目录。')
            item['translation'] = str(translation)
        result[key] = item
    return result


def fingerprint(roots):
    digest = hashlib.sha256()
    for root in roots:
        for path in sorted(root.rglob('*')):
            if path.is_file():
                digest.update(str(path).encode('utf-8'));digest.update(path.read_bytes())
    return digest.hexdigest()


def update(root, config, log=print):
    root = history.validate_root(root)
    config = validate(config)
    if not config:raise ValueError('请勾选至少一个要更新的 MOD。')
    here = history.HERE
    with history.update_lock():
        installed = json.loads((root/'launcher/launcher-settings.json').read_text('utf-8-sig'))['version']
        if history.read_data(here/'data.js')['version'] != installed:
            raise ValueError('原版百科与游戏版本不同，请先更新原版，或选择“原版和所选 MOD”。')
        roots = [pathlib.Path(value[field]) for value in config.values() for field in ['path','translation'] if field in value]
        before = fingerprint(roots)
        # Read source files from the requested installation, not a previous default.
        history.ROOT = root
        game_files = history.source_files();game_before = history.fingerprint(game_files)
        with tempfile.TemporaryDirectory(prefix='.v3-update-mod-', dir=here) as temp:
            stage = pathlib.Path(temp)
            for p in here.iterdir():
                if p.is_file() and p.suffix in {'.py','.json','.js'}:shutil.copy2(p,stage/p.name)
            (stage/'assets').mkdir();(stage/'en').mkdir()
            for p in (here/'en').glob('*.js'):shutil.copy2(p,stage/'en'/p.name)
            outputs = []
            for key, value in config.items():
                info = CATALOGS[key];log('正在更新 MOD：'+info['name'])
                if key == 'industry':args = ['build_industrial_chain.py','--game',str(root),'--mod',value['path'],'--force']
                elif key == 'resources':args = ['build_real_resources.py',str(root),'--mod',value['path'],'--force']
                else:args = ['build_mod_companies.py','--game-root',str(root),'--mod-root',value['path'],'--translation-root',value['translation']]
                # Remove prior outputs so a builder cannot silently report success with stale files.
                for rel in [info['output'],'en/'+info['output']]:
                    (stage/rel).unlink(missing_ok=True);outputs.append(pathlib.Path(rel))
                with subprocess.Popen([sys.executable,'-B',str(stage/args[0]),*args[1:]],cwd=stage,
                                      env={**os.environ,'PYTHONIOENCODING':'utf-8','PYTHONUNBUFFERED':'1'},
                                      stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace') as proc:
                    for line in proc.stdout:log(line.rstrip())
                    if proc.wait():raise RuntimeError(info['name']+'生成失败，原有 MOD 数据保持不变。')
                for rel in [info['output'],'en/'+info['output']]:history.read_data(stage/rel)
                if key == 'industry':outputs.append(pathlib.Path('industrial-chain-source.json'))
            if fingerprint(roots) != before or history.fingerprint(history.source_files()) != game_before:
                raise RuntimeError('更新期间游戏或 MOD 文件发生变化，请等待 Steam 更新完成后重试。')
            outputs.extend(p.relative_to(stage) for p in (stage/'assets').rglob('*') if p.is_file())
            history.publish(stage, outputs)
    log('所选 MOD 中英文数据已更新，不生成版本快照。')
    return {'mods':list(config),'snapshot':None,'mode':'mods'}
