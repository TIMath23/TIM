from timApp.tests.server.timroutetest import TimRouteTest
from timApp.user.usergroup import UserGroup
from timApp.timdb.sqa import db


class SettingsTest(TimRouteTest):

    def test_info(self):
        self.login_test1()
        d = self.create_doc()
        t1id = self.get_test_user_1_group_id()
        self.get('/settings/info',
                 expect_content={'annotations': [],
                                 'answer_uploads': [],
                                 'answers': [],
                                 'groups': [{'id': t1id, 'name': 'testuser1'}],
                                 'lectureanswers': [],
                                 'notes': [],
                                 'owned_documents':
                                     [{'id': d.id,
                                       'isFolder': False,
                                       'location': 'users/test-user-1',
                                       'modified': 'just now',
                                       'name': 'doc1',
                                       'owner': {'id': t1id, 'name': 'testuser1'},
                                       'path': 'users/test-user-1/doc1',
                                       'public': True,
                                       'rights': {'browse_own_answers': True,
                                                  'can_comment': True,
                                                  'can_mark_as_read': True,
                                                  'editable': True,
                                                  'manage': True,
                                                  'owner': True,
                                                  'see_answers': True,
                                                  'teacher': True},
                                       'title': 'document 2',
                                       'unpublished': True},
                                      {'id': 4,
                                       'isFolder': False,
                                       'location': 'users/test-user-1',
                                       'modified': 'just now',
                                       'name': 'Bookmarks',
                                       'owner': {'id': t1id, 'name': 'testuser1'},
                                       'path': 'users/test-user-1/Bookmarks',
                                       'public': True,
                                       'rights': {'browse_own_answers': True,
                                                  'can_comment': True,
                                                  'can_mark_as_read': True,
                                                  'editable': True,
                                                  'manage': True,
                                                  'owner': True,
                                                  'see_answers': True,
                                                  'teacher': True},
                                       'title': 'Bookmarks',
                                       'unpublished': True}],
                                 'owned_folders':
                                     [{'id': 1,
                                       'isFolder': True,
                                       'location': 'users',
                                       'modified': 'just now',
                                       'name': 'test-user-1',
                                       'owner': {'id': t1id, 'name': 'testuser1'},
                                       'path': 'users/test-user-1',
                                       'public': True,
                                       'rights': {'browse_own_answers': True,
                                                  'can_comment': True,
                                                  'can_mark_as_read': True,
                                                  'editable': True,
                                                  'manage': True,
                                                  'owner': True,
                                                  'see_answers': True,
                                                  'teacher': True},
                                       'title': 'Test user 1',
                                       'unpublished': True},
                                      {'id': 2,
                                       'isFolder': True,
                                       'location': '',
                                       'modified': 'just now',
                                       'name': 'users',
                                       'owner': {'id': t1id, 'name': 'testuser1'},
                                       'path': 'users',
                                       'public': True,
                                       'rights': {'browse_own_answers': True,
                                                  'can_comment': True,
                                                  'can_mark_as_read': True,
                                                  'editable': True,
                                                  'manage': True,
                                                  'owner': True,
                                                  'see_answers': True,
                                                  'teacher': True},
                                       'title': 'users',
                                       'unpublished': True}],
                                 'owned_lectures': [],
                                 'readparagraphs': [],
                                 'uploaded_files': [],
                                 'uploaded_images': [],
                                 'velpgroups': [],
                                 'velps': []})
        self.get('/settings/info/testuser2', expect_status=403)
        u = self.test_user_1
        u.groups.append(UserGroup.get_admin_group())
        db.session.commit()
        self.get('/settings/info/testuser2',
                 expect_content={'annotations': [],
                                 'answer_uploads': [],
                                 'answers': [],
                                 'groups': [{'id': self.get_test_user_2_group_id(), 'name': 'testuser2'}],
                                 'lectureanswers': [],
                                 'notes': [],
                                 'owned_documents': [],
                                 'owned_folders': [],
                                 'owned_lectures': [],
                                 'readparagraphs': [],
                                 'uploaded_files': [],
                                 'uploaded_images': [],
                                 'velpgroups': [],
                                 'velps': []})
