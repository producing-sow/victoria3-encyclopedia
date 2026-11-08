import unittest
from version_history import changes,records

class HistoryTests(unittest.TestCase):
    def test_diff(self):
        before={'商品/coal':{'name':'煤','price':30},'建筑/old':{'name':'旧'}}
        after={'商品/coal':{'name':'煤','price':40},'建筑/new':{'name':'新'}}
        result={r['key']:r for r in changes(before,after)}
        self.assertEqual(result['商品/coal']['fields'],['price'])
        self.assertEqual(result['建筑/old']['kind'],'移除')
        self.assertEqual(result['建筑/new']['kind'],'新增')
        self.assertEqual(changes(after,after),[])
    def test_normalize(self):
        a=records({'data.js':{'buildings':[{'id':'mine','name':'矿','icon':'a','source':'x'}]}})
        b=records({'data.js':{'buildings':[{'id':'mine','name':'矿','icon':'b','source':'y'}]}})
        self.assertEqual(changes(a,b),[])
        self.assertIn('建筑/mine',a)

if __name__=='__main__':unittest.main()
