import datetime
from datetime import timezone

import dateutil.parser

from timroutetest import TimRouteTest


class LectureTest(TimRouteTest):
    def test_lecture(self):
        self.login_test1()
        doc = self.create_doc(initial_par='testing lecture')
        db = self.get_db()
        name = db.documents.get_first_document_name(doc.doc_id)
        current_time = datetime.datetime.now(tz=timezone.utc)
        time_format = '%H:%M:%S'
        start_time = (current_time - datetime.timedelta(minutes=15))
        end_time = (current_time + datetime.timedelta(hours=2))
        lecture_code = 'test lecture'
        j = self.post('/createLecture', query_string=dict(doc_id=doc.doc_id,
                                                          end_date=end_time,
                                                          lecture_code=lecture_code,
                                                          max_students=50,
                                                          password='1234',
                                                          start_date=start_time), expect_status=200, as_json=True)
        lecture_id = j['lectureId']
        self.assertIsInstance(lecture_id, int)
        j = self.get('/checkLecture', as_json=True, expect_status=200, query_string=dict(doc_id=doc.doc_id))

        self.assertDictEqual({'doc_name': name,
                              'endTime': end_time.isoformat(),
                              'isInLecture': True,
                              'isLecturer': True,
                              'lectureCode': lecture_code,
                              'lectureId': lecture_id,
                              'lecturers': [],  # TODO This is probably wrong, should have one element
                              'startTime': start_time.isoformat(),
                              'students': [],
                              'useQuestions': True,
                              'useWall': True}, j)

        resp = self.get('/getUpdates',
                        as_json=True,
                        query_string=dict(client_message_id=-1,
                                          doc_id=doc.doc_id,
                                          get_messages=True,
                                          lecture_id=lecture_id))
        self.check_time(current_time, resp, time_format)
        self.assertDictEqual({'data': ['No new messages'],
                              'isLecture': True,
                              'lastid': -1,
                              'lectureEnding': 100,
                              'lectureId': lecture_id,
                              'lecturers': [{'active': resp['lecturers'][0]['active'], 'name': self.current_user_name()}],
                              'status': 'no-results',
                              'students': []}, resp)

        msg_text = 'hi'
        j = self.post('/sendMessage', query_string=dict(lecture_id=lecture_id, message=msg_text), expect_status=200, as_json=True)

        msg_id = j['id']
        self.assertIsInstance(msg_id, int)
        msg_datetime = dateutil.parser.parse(j['time'])
        msg_time = msg_datetime.strftime(time_format)
        resp = self.get('/getUpdates',
                        as_json=True,
                        query_string=dict(client_message_id=-1,
                                          doc_id=doc.doc_id,
                                          get_messages=True,
                                          lecture_id=lecture_id))

        self.check_time(current_time, resp, time_format)
        self.assertDictEqual({'data': [{'message': msg_text, 'sender': self.current_user_name(), 'time': msg_time}],
                              'isLecture': True,
                              'lastid': msg_id,
                              'lectureEnding': 100,
                              'lectureId': lecture_id,
                              'lecturers': [
                                  {'active': resp['lecturers'][0]['active'],
                                   'name': self.current_user_name()}],
                              'status': 'results',
                              'students': []}, resp)

        resp = self.get('/getUpdates',
                        as_json=True,
                        query_string=dict(client_message_id=msg_id,
                                          doc_id=doc.doc_id,
                                          get_messages=True,
                                          lecture_id=lecture_id))

        self.check_time(current_time, resp, time_format)
        self.assertDictEqual({'data': ['No new messages'],
                              'isLecture': True,
                              'lastid': msg_id,
                              'lectureEnding': 100,
                              'lectureId': 1,
                              'lecturers': [
                                  {'active': resp['lecturers'][0]['active'],
                                   'name': self.current_user_name()}],
                              'status': 'no-results',
                              'students': []}, resp)

    def check_time(self, current_time, resp, time_format):
        returned_time = datetime.datetime.strptime(resp['lecturers'][0]['active'], time_format).replace(tzinfo=timezone.utc)
        self.assertLess(returned_time - current_time, datetime.timedelta(seconds=2))
