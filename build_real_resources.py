"""Extract a separate resource-map variant. Never writes base-game datasets."""
import argparse, ast, copy, datetime, hashlib, json, pathlib, re
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
DEFAULT_GAME = pathlib.Path(r'F:\Program Files (x86)\Steam\steamapps\common\Victoria 3')
DEFAULT_MOD = pathlib.Path(r'F:\Program Files (x86)\Steam\steamapps\workshop\content\529340\3459869359')
OUTPUT = 'map-real-resources-data.js'
PREFIX = 'window.V3_REAL_RESOURCES='
# Reuse the existing parser/localization resolver without importing its build side effects.
tree = ast.parse((HERE/'build_data.py').read_text('utf-8-sig'))
helpers = ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in ['parse', 'get', 'name']], type_ignores=[])
namespace = {'re': re}
exec(compile(helpers, 'build_data.py', 'exec'), namespace)
parse, get = namespace['parse'], namespace['get']

def read_data(path):
    return json.loads(path.read_text('utf-8-sig').split('=', 1)[1].rstrip().rstrip(';'))

def definitions(root, folder):
    return {key.split(':')[-1]: (value, p.relative_to(root).as_posix())
            for p in sorted((root/folder).glob('*.txt'))
            for key, value in parse(p.read_text('utf-8-sig')) if isinstance(value, list)}

def identifiers(values):
    return [key.strip('"') for key, _ in values]

def capacities(values):
    known = {k: float(v) for k, v in get(values, 'capped_resources', [])}
    hidden = {}
    for key, value in values:
        if key != 'resource': continue
        resource = get(value, 'type')
        if not resource: raise ValueError('Resource without type')
        known[resource] = known.get(resource, 0) + float(get(value, 'discovered_amount', 0))
        hidden[resource] = hidden.get(resource, 0) + float(get(value, 'undiscovered_amount', 0))
    if any(n < 0 for n in [*known.values(), *hidden.values()]): raise ValueError('Negative resource capacity')
    return known, hidden

def localizer(game, mod, language):
    loc = {}
    for root in [game, mod]:
        for p in sorted((root/'localization'/language).rglob('*.yml')):
            for line in p.read_text('utf-8-sig').splitlines():
                match = re.match(r'\s*([\w.\-]+):\d*\s*"(.*)"', line)
                if match: loc[match[1]] = match[2]
    # Independently bind the resolver for each language.
    ns = {'re': re, 'loc': loc, 'defines': {}, 'unresolved_localization': set(),
          'localization_fallbacks': json.loads((HERE/'localization-fallbacks.json').read_text('utf-8')) if language == 'simp_chinese' else {}}
    exec(compile(helpers, 'build_data.py', 'exec'), ns)
    return ns['name']

def artwork(texture, game, mod):
    if not texture: return ''
    dest = HERE/'assets'/(hashlib.sha1(texture.encode()).hexdigest()[:16]+'.png')
    source = mod/texture if (mod/texture).is_file() else game/texture
    if not source.is_file(): raise FileNotFoundError(source)
    if not dest.exists():
        with Image.open(source) as image:
            image = image.convert('RGBA'); image.thumbnail((256, 256)); image.save(dest, optimize=True)
    return dest.relative_to(HERE).as_posix()

def atomic_data(path, data):
    path.parent.mkdir(exist_ok=True)
    temp = path.with_suffix('.js.tmp')
    temp.write_text(PREFIX+json.dumps(data, ensure_ascii=False, separators=(',', ':'))+';', 'utf-8')
    temp.replace(path)

def build(game_root, mod, force=False):
    if not mod.is_dir():
        print('Real resources MOD not installed; keeping the bundled variant.'); return
    game = game_root/'game'
    base = read_data(HERE/'map-data.js')
    base_version = read_data(HERE/'data.js')['version']
    mod_files = sorted(p for p in mod.rglob('*') if p.is_file() and p.suffix in ['.txt', '.yml', '.json'])
    input_files = [HERE/'map-data.js', HERE/'data.js', HERE/'build_data.py', pathlib.Path(__file__), *mod_files]
    for folder in ['map_data/state_regions', 'common/state_traits', 'common/modifier_type_definitions', 'localization/simp_chinese', 'localization/english']:
        input_files.extend(sorted(p for p in (game/folder).rglob('*') if p.is_file() and p.suffix in ['.txt', '.yml']))
    digest = hashlib.sha256()
    for p in input_files:
        digest.update(p.as_posix().encode()); digest.update(p.read_bytes())
    fingerprint = digest.hexdigest()
    if not force and (HERE/OUTPUT).exists() and (HERE/'en'/OUTPUT).exists() and read_data(HERE/OUTPUT).get('fingerprint') == fingerprint:
        print('Real resources MOD unchanged.'); return
    vanilla_defs = definitions(game, 'map_data/state_regions')
    mod_defs = definitions(mod, 'map_data/state_regions')
    trait_defs = {**definitions(game, 'common/state_traits'), **definitions(mod, 'common/state_traits')}
    modifier_defs = {**definitions(game, 'common/modifier_type_definitions'), **definitions(mod, 'common/modifier_type_definitions')}
    patches, resource_ids, farm_ids, trait_ids = {}, set(), set(), set()
    counts = {key: 0 for key in ['resources', 'hidden', 'arable', 'farms', 'traits']}
    for state in base['states']:
        key = state['id']
        if key not in mod_defs: continue
        values, source = mod_defs[key]
        if set(identifiers(get(values, 'provinces', []))) != set(identifiers(get(vanilla_defs[key][0], 'provinces', []))):
            raise ValueError(f'{key}: MOD changes province geometry; cannot reuse the base map')
        known, hidden = capacities(values)
        patch = {'resources': known, 'hidden': hidden, 'arable': float(get(values, 'arable_land', 0)),
                 'farms': identifiers(get(values, 'arable_resources', [])), 'traits': identifiers(get(values, 'traits', [])),
                 'source': 'workshop/3459869359/'+source}
        changed = [field for field in counts if patch[field] != state[field]]
        for field in changed: counts[field] += 1
        patch['changedFields'] = changed
        patches[key] = patch
        resource_ids.update(known); resource_ids.update(hidden)
        farm_ids.update(patch['farms']); trait_ids.update(patch['traits'])
    missing = trait_ids-trait_defs.keys()
    if missing: raise ValueError(('Undefined MOD traits', sorted(missing)))
    metadata = {'id': 'real-resources', 'workshopId': '3459869359', 'modName': 'Explorable Real-World Resources',
                'author': 'Asuna', 'workshopUrl': 'https://steamcommunity.com/sharedfiles/filedetails/?id=3459869359',
                'attributionVerified': '2026-11-15',
                'baseVersion': base_version, 'generated': datetime.datetime.now().isoformat(timespec='seconds'),
                'overriddenStates': len(patches), 'changedStates': sum(bool(s['changedFields']) for s in patches.values()),
                'changedFields': counts, 'source': 'workshop/3459869359/map_data/state_regions',
                'scope': 'static-state-definitions', 'population': 'base-game'}
    for language in ['simp_chinese', 'english']:
        name = localizer(game, mod, language)
        traits = {}
        for key in sorted(trait_ids):
            values, source = trait_defs[key]
            effects = []
            for effect, value in get(values, 'modifier', []):
                if effect not in modifier_defs: raise ValueError(('Undefined trait modifier', key, effect))
                props = modifier_defs[effect][0]
                effects.append({'id': effect, 'name': name(effect), 'value': float(value),
                                'percent': get(props, 'percent') == 'yes', 'color': get(props, 'color', 'neutral')})
            traits[key] = {'id': key, 'name': name(key), 'icon': artwork(get(values, 'icon'), game, mod), 'effects': effects,
                           'source': ('workshop/3459869359/' if (mod/source).is_file() else 'game/')+source,
                           'requiredTechnologies': [name(t) for t in identifiers(get(values, 'required_techs_for_colonization', []))],
                           'disablingTechnologies': [name(t) for t in identifiers(get(values, 'disabling_technologies', []))]}
        data = {'metadata': metadata, 'fingerprint': fingerprint, 'states': patches,
                'resources': {key: name(key) for key in sorted(resource_ids)}, 'farms': {key: name(key) for key in sorted(farm_ids)}, 'traits': traits}
        atomic_data(HERE/OUTPUT if language == 'simp_chinese' else HERE/'en'/OUTPUT, data)
    print('Real resources MOD:', metadata['overriddenStates'], 'states;', metadata['changedStates'], 'changed;', len(trait_ids), 'traits.', counts)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('game', nargs='?', type=pathlib.Path, default=DEFAULT_GAME)
    parser.add_argument('--mod', type=pathlib.Path, default=DEFAULT_MOD)
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    build(args.game, args.mod, args.force)
