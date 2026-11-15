"""Updater regression tests use synthetic game data; never rebuild the real catalog."""
import json
import pathlib
import tempfile
import threading
import time
import unittest
import urllib.request
import urllib.error
from unittest.mock import patch
import version_history as h
import update_server as server
import update_mods


class UpdateTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='.v3-update-test-',dir=h.HERE)
        self.addCleanup(self.temp.cleanup)
        self.site=pathlib.Path(self.temp.name)
        self.game=self.site/'game-install'
        for name in ['game/common','game/localization/english','game/localization/simp_chinese','game/map_data','launcher']:
            (self.game/name).mkdir(parents=True)
        (self.game/'launcher/launcher-settings.json').write_text('{"version":"1.0"}')
        (self.game/'game/map_data/provinces.png').write_bytes(b'map')
        (self.game/'game/common/example.txt').write_text('first')
        self.patches=[patch.object(h,'HERE',self.site),patch.object(h,'HISTORY',self.site/'history'),patch.object(h,'ROOT',self.game),patch.object(h,'BUILDERS',['fake_builder.py'])]
        for p in self.patches:p.start();self.addCleanup(p.stop)
        (self.site/'fake_builder.py').write_text('''import pathlib,json,sys
root=pathlib.Path(sys.argv[1]);here=pathlib.Path(__file__).parent
version=json.loads((root/'launcher/launcher-settings.json').read_text())['version']
for name in '''+repr(h.OUTPUTS)+''':
 value={'version':version}
 if name=='data.js':value['goods']={'coal':{'name':'Coal','price':len((root/'game/common/example.txt').read_text())}}
 (here/name).write_text('window.TEST='+json.dumps(value)+';')
(here/'assets/new.png').write_bytes(b'new icon')
''',encoding='utf-8')
        (self.site/'build_i18n.py').write_text('''import pathlib,shutil
here=pathlib.Path(__file__).parent
for name in '''+repr(h.OUTPUTS+['history-data.js'])+''':shutil.copyfile(here/name,here/'en'/name)
for name in ['i18n-dictionary.js','i18n-ui.json','i18n-report.json']:(here/name).write_text('{}')
''',encoding='utf-8')

    def update(self):return h.update(self.game,log=lambda _:None)
    def index(self):return json.loads((self.site/'history/index.json').read_text('utf-8'))

    def test_first_repeat_timestamp_and_hotfix(self):
        self.assertTrue(self.update()['changed']);self.assertEqual(len(self.index()),1)
        before=(self.site/'history-data.js').read_bytes()
        (self.game/'game/common/example.txt').touch()
        (self.game/'workshop').mkdir();(self.game/'workshop/mod.txt').write_text('ignored')
        self.assertFalse(self.update()['changed']);self.assertEqual(len(self.index()),1)
        self.assertEqual((self.site/'history-data.js').read_bytes(),before)
        (self.game/'game/common/example.txt').write_text('hotfix changed values')
        self.assertTrue(self.update()['changed']);self.assertEqual(len(self.index()),2)
        self.assertTrue(self.index()[-1]['changes'])
        self.assertEqual((self.site/'history-data.js').read_bytes(),(self.site/'en/history-data.js').read_bytes())
        (self.game/'launcher/launcher-settings.json').write_text('{"version":"1.1"}')
        self.assertEqual(self.update()['version'],'1.1');self.assertEqual(len(self.index()),3)

    def test_failed_build_preserves_site_and_archives(self):
        self.update();before=(self.site/'data.js').read_bytes();archive=(self.site/'history/index.json').read_bytes()
        (self.site/'fake_builder.py').write_text("raise RuntimeError('simulated failure')")
        with self.assertRaises(RuntimeError):self.update()
        self.assertEqual(before,(self.site/'data.js').read_bytes())
        self.assertEqual(archive,(self.site/'history/index.json').read_bytes())
        self.assertFalse((self.site/'history-update.lock').exists())
        self.assertFalse(list(self.site.glob('.v3-update-*')))

    def test_bad_root_and_concurrent_update(self):
        with self.assertRaises(ValueError):h.validate_root(self.site)
        with h.update_lock():
            with self.assertRaises(RuntimeError):self.update()

    def test_publish_failure_rolls_back(self):
        stage=self.site/'stage';stage.mkdir()
        (self.site/'one.js').write_text('old');(stage/'one.js').write_text('new')
        with self.assertRaises(FileNotFoundError):h.publish(stage,[pathlib.Path('one.js'),pathlib.Path('missing.js')])
        self.assertEqual((self.site/'one.js').read_text(),'old')

    def test_legacy_fingerprint_coverage(self):
        self.assertFalse(h.sources_changed({'game/common/a.txt':'a'},{'game/common/a.txt':'a','game/gfx/interface/icon.dds':'x'}))
        self.assertTrue(h.sources_changed({'game/common/a.txt':'a'},{'game/common/a.txt':'b'}))

    def test_mod_updates_leave_vanilla_and_snapshots_untouched(self):
        self.update()
        vanilla={name:(self.site/name).read_bytes() for name in h.OUTPUTS+['history-data.js','history/index.json']}
        config={}
        scripts={'industry':'build_industrial_chain.py','resources':'build_real_resources.py','companies':'build_mod_companies.py'}
        for key,info in update_mods.CATALOGS.items():
            folder=self.site/key
            (folder/info['folder']).mkdir(parents=True);(folder/'.metadata').mkdir()
            (folder/'.metadata/metadata.json').write_text('{}')
            config[key]={'enabled':True,'path':str(folder)}
            if key=='companies':
                (folder/'localization/simp_chinese').mkdir(parents=True)
                config[key]['translation']=str(folder)
            (self.site/scripts[key]).write_text("from pathlib import Path\np=Path(__file__).parent\n"+
                "for name in "+repr([info['output'],'en/'+info['output']])+":(p/name).write_text('window.MOD={\"updated\":true};')\n"+
                ("(p/'industrial-chain-source.json').write_text('{}')\n" if key=='industry' else ''))
        result=update_mods.update(self.game,config,log=lambda _:None)
        self.assertEqual(set(result['mods']),set(config));self.assertIsNone(result['snapshot'])
        for name,content in vanilla.items():self.assertEqual(content,(self.site/name).read_bytes())
        for info in update_mods.CATALOGS.values():self.assertTrue(h.read_data(self.site/info['output'])['updated'])
        before=(self.site/'industrial-chain-data.js').read_bytes()
        (self.site/'build_real_resources.py').write_text("raise RuntimeError('failure')")
        with self.assertRaises(RuntimeError):update_mods.update(self.game,config,log=lambda _:None)
        self.assertEqual(before,(self.site/'industrial-chain-data.js').read_bytes())
        self.assertEqual(vanilla['history/index.json'],(self.site/'history/index.json').read_bytes())
        with patch.object(server,'HERE',self.site), patch.object(h,'update',side_effect=AssertionError('MOD-only must not update vanilla')), patch.object(update_mods,'update',return_value={'mods':list(config)}):
            updater=server.Updater();updater.start(self.game,'mods',config)
            deadline=time.monotonic()+5
            while updater.view()['running'] and time.monotonic()<deadline:time.sleep(.01)
            self.assertEqual(updater.view()['status'],'success')
            self.assertEqual(updater.view()['result']['mode'],'mods')
            self.assertIsNone(updater.view()['result']['snapshot'])
        config['industry']['path']='missing-mod'
        with self.assertRaises(ValueError):update_mods.validate(config)

    def test_local_http_protection_and_validation(self):
        with patch.object(server,'HERE',self.site):
            srv=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler);srv.updater=server.Updater()
            thread=threading.Thread(target=srv.serve_forever,daemon=True);thread.start()
            try:
                url=f'http://127.0.0.1:{srv.server_port}'
                state=json.load(urllib.request.urlopen(url+'/api/update'))
                request=urllib.request.Request(url+'/api/discover-mods',data=json.dumps({'root':str(self.game)}).encode(),headers={'X-Update-Token':state['token']})
                self.assertEqual(set(json.load(urllib.request.urlopen(request))['mods']),set(update_mods.CATALOGS))
                for headers,code in [({},403),({'X-Update-Token':state['token']},400),({'X-Update-Token':state['token'],'Origin':'https://example.com'},403)]:
                    request=urllib.request.Request(url+'/api/update',data=b'{"root":"invalid"}',headers=headers)
                    with self.assertRaises(urllib.error.HTTPError) as err:urllib.request.urlopen(request)
                    self.assertEqual(err.exception.code,code)
                (self.site/'updater-settings.json').write_text('{}')
                with self.assertRaises(urllib.error.HTTPError) as err:urllib.request.urlopen(url+'/updater-settings.json')
                self.assertEqual(err.exception.code,404)
                request=urllib.request.Request(url+'/api/update',data=json.dumps({'root':str(self.game)}).encode(),headers={'X-Update-Token':state['token']})
                self.assertEqual(urllib.request.urlopen(request).status,202)
                deadline=time.monotonic()+15
                while time.monotonic()<deadline:
                    status=json.load(urllib.request.urlopen(url+'/api/update'))
                    if not status['running']:break
                    time.sleep(.05)
                self.assertEqual(status['status'],'success',status)
                self.assertTrue(status['result']['snapshot'])
            finally:srv.shutdown();srv.server_close();thread.join()


if __name__=='__main__':unittest.main()
