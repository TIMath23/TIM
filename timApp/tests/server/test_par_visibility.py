"""Server tests for user/view-specific document rendering."""
from timApp.auth.accesstype import AccessType
from timApp.tests.server.timroutetest import TimRouteTest
from timApp.timdb.sqa import db


class ParVisibilityTest(TimRouteTest):
    def test_belongs(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
#-
a

#- {nocache=true visible="%%'testuser1'|belongs%%"}
testuser1 only

#-
anyone
""")
        self.assert_content(self.get(d.url, as_tree=True), ['a', 'testuser1 only', 'anyone'])
        p = d.document.get_paragraphs()[1]
        p.set_markdown('testuser1 only edited')
        d.document.modify_paragraph_obj(p.get_id(), p)
        self.assert_content(self.get(d.url, as_tree=True), ['a', 'testuser1 only edited', 'anyone'])

        self.test_user_2.grant_access(d, AccessType.view)
        db.session.commit()
        self.login_test2()
        self.assert_content(self.get(d.url, as_tree=True), ['a', 'anyone'])
        self.test_user_2.grant_access(d, AccessType.edit)
        db.session.commit()
        self.assert_content(self.get(d.url, as_tree=True), ['a', 'anyone'])  # TODO shouldn't editors always see everything?
        p = d.document.get_paragraphs()[1]
        p.set_attr('visible', "%%'testuser2'|belongs%%")
        p.set_markdown('testuser2 only')
        d.document.modify_paragraph_obj(p.get_id(), p)
        self.assert_content(self.get(d.url, as_tree=True), ['a', 'testuser2 only', 'anyone'])
        self.login_test1()
        self.assert_content(self.get(d.url, as_tree=True), ['a', 'anyone'])

    def test_isview(self):
        self.login_test1()
        d = self.create_doc(initial_par="""
#- {nocache=true visible="%%False|isview%%"}
only teacher
        """)
        self.assert_content(self.get(d.url, as_tree=True), [])
        self.assert_content(self.get(d.get_url_for_view('slide'), as_tree=True), [])
        self.assert_content(self.get(d.get_url_for_view('answers'), as_tree=True), ['only teacher'])
        self.assert_content(self.get(d.get_url_for_view('teacher'), as_tree=True), ['only teacher'])
        self.assert_content(self.get(d.url, as_tree=True), [])  # make sure the teacher route is not cached incorrectly