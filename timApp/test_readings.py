from lxml.cssselect import CSSSelector

from timdb.readparagraphtype import ReadParagraphType
from timroutetest import TimRouteTest

readline_selector = CSSSelector('div.readline')

UNREAD = ''
READ = ReadParagraphType.click_red.class_str()
MODIFIED = READ + '-modified'
PAR_CLICK = ReadParagraphType.click_par.class_str()
PAR_CLICK_MODIFIED = PAR_CLICK + '-modified'


class ReadingsTest(TimRouteTest):
    def test_readings_normal(self):
        self.login_test1()
        doc = self.create_doc(initial_par='test\n#-\ntest2\n#-\ntest3').document
        pars = doc.get_paragraphs()

        self.check_readlines(self.get_readings(doc), (UNREAD, UNREAD, UNREAD))
        self.mark_as_read(doc, pars[0].get_id())
        self.check_readlines(self.get_readings(doc), (READ, UNREAD, UNREAD))
        self.mark_as_read(doc, pars[1].get_id())
        self.check_readlines(self.get_readings(doc), (READ, READ, UNREAD))
        doc.modify_paragraph(pars[1].get_id(), 'a')
        self.check_readlines(self.get_readings(doc), (READ, MODIFIED, UNREAD))
        self.mark_as_read(doc, pars[2].get_id(), ReadParagraphType.click_par)
        self.check_readlines(self.get_readings(doc), (READ, MODIFIED, PAR_CLICK))
        doc.modify_paragraph(pars[2].get_id(), 'b')
        self.check_readlines(self.get_readings(doc), (READ, MODIFIED, PAR_CLICK_MODIFIED))
        self.mark_as_read(doc, pars[2].get_id())
        self.check_readlines(self.get_readings(doc), (READ, MODIFIED, PAR_CLICK_MODIFIED + ' ' + READ))

    def test_readings_group(self):
        self.login_test1()
        self.login_test2(add=True)
        doc = self.create_doc(initial_par='test\n#-\ntest2\n#-\ntest3\n#-\ntest4').document
        self.check_readlines(self.get_readings(doc), (UNREAD, UNREAD, UNREAD, UNREAD))
        pars = doc.get_paragraphs()
        self.mark_as_read(doc, pars[0].get_id())

        self.check_readlines(self.get_readings(doc), (READ, UNREAD, UNREAD, UNREAD))
        self.mark_as_read(doc, pars[1].get_id())
        self.check_readlines(self.get_readings(doc), (READ, READ, UNREAD, UNREAD))

        self.login_test2()
        self.check_readlines(self.get_readings(doc), (READ, READ, UNREAD, UNREAD))
        self.mark_as_read(doc, pars[2].get_id())
        self.check_readlines(self.get_readings(doc), (READ, READ, READ, UNREAD))

        self.login_test1(add=True)
        self.check_readlines(self.get_readings(doc), (READ, READ, UNREAD, UNREAD))

        self.login_test1()
        self.mark_as_read(doc, pars[2].get_id())
        self.login_test2(add=True)
        self.check_readlines(self.get_readings(doc), (READ, READ, READ, UNREAD))
        doc.modify_paragraph(pars[2].get_id(), 'a')
        self.check_readlines(self.get_readings(doc), (READ, READ, MODIFIED, UNREAD))
        self.login_test2()
        self.mark_as_read(doc, pars[2].get_id())
        self.check_readlines(self.get_readings(doc), (READ, READ, READ, UNREAD))
        self.login_test1(add=True)
        self.check_readlines(self.get_readings(doc), (READ, READ, UNREAD, UNREAD))
        self.login_test1()
        self.check_readlines(self.get_readings(doc), (READ, READ, MODIFIED, UNREAD))

    def get_readings(self, doc):
        readlines = readline_selector(self.get('/view/{}'.format(doc.doc_id), as_tree=True))
        return readlines

    def mark_as_read(self, doc, par_id, read_type=ReadParagraphType.click_red):
        self.json_put('/read/{}/{}/{}'.format(doc.doc_id, par_id, read_type.value))

    def check_readlines(self, readlines, expected):
        self.assertEqual(len(readlines), len(expected))
        for r, e in zip(readlines, expected):
            classes = set(r.attrib['class'].split(' '))
            self.assertIn('readline', classes)
            if e:
                for c in e.split(' '):
                    self.assertIn(c, classes)
