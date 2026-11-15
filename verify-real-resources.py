"""Audit every shipped MOD resource value against the local workshop definitions."""
import collections, pathlib
from build_real_resources import DEFAULT_GAME, DEFAULT_MOD, HERE, definitions, get, identifiers, read_data

source = definitions(DEFAULT_MOD, 'map_data/state_regions')
data = read_data(HERE/'map-real-resources-data.js')
base = read_data(HERE/'map-data.js')
for state in base['states']:
    key = state['id']; raw = source[key][0]; actual = data['states'][key]
    expected = collections.defaultdict(float, {k: float(v) for k, v in get(raw, 'capped_resources', [])})
    undiscovered = collections.defaultdict(float)
    for field, entries in raw:
        if field != 'resource': continue
        values = dict(entries)
        expected[values['type']] += float(values.get('discovered_amount', 0))
        undiscovered[values['type']] += float(values.get('undiscovered_amount', 0))
    assert dict(expected) == actual['resources'], key
    assert dict(undiscovered) == actual['hidden'], key
    assert float(get(raw, 'arable_land', 0)) == actual['arable'], key
    assert identifiers(get(raw, 'arable_resources', [])) == actual['farms'], key
    assert identifiers(get(raw, 'traits', [])) == actual['traits'], key
    assert actual['source'] == 'workshop/3459869359/'+source[key][1]
assert len(data['states']) == len(base['states']) == 676
assert data['states']['STATE_SHANXI']['resources']['building_coal_mine'] == 143
assert data['states']['STATE_SHANXI']['hidden']['building_coal_mine'] == 807
print('PASS: all 676 state resource, discovered/undiscovered, arable, farm and trait records match the supplied MOD files exactly.')
