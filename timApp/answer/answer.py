import json
from sqlalchemy import func

from timApp.answer.answer_models import UserAnswer
from timApp.plugin.taskid import TaskId
from timApp.timdb.sqa import db, include_if_loaded


class AnswerSaver(db.Model):
    """Holds information about who has saved an answer. For example, in teacher view, "Save teacher's fix"
    would store the teacher in this table.
    """
    __tablename__ = 'answersaver'
    answer_id = db.Column(db.Integer, db.ForeignKey('answer.id'), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('useraccount.id'), primary_key=True)


class Answer(db.Model):
    """An answer to a task."""
    __tablename__ = 'answer'
    id = db.Column(db.Integer, primary_key=True)
    """Answer identifier."""

    task_id = db.Column(db.Text, nullable=False, index=True)
    """Task id to which this answer was posted. In the form "doc_id.name", for example "2.task1"."""

    content = db.Column(db.Text, nullable=False)
    """Answer content."""

    points = db.Column(db.Float)
    """Points."""

    answered_on = db.Column(db.DateTime(timezone=True), nullable=False, default=func.now())
    """Answer timestamp."""

    valid = db.Column(db.Boolean, nullable=False)
    """Whether this answer is valid."""

    last_points_modifier = db.Column(db.Integer, db.ForeignKey('usergroup.id'))
    """The UserGroup who modified the points last. Null if the points have been given by the task automatically."""

    uploads = db.relationship('AnswerUpload', back_populates='answer', lazy='dynamic')
    users = db.relationship('User', secondary=UserAnswer.__table__,
                            back_populates='answers', lazy='dynamic')
    users_all = db.relationship('User', secondary=UserAnswer.__table__,
                                back_populates='answers_alt', order_by='User.real_name', lazy='select')
    annotations = db.relationship('Annotation', back_populates='answer')
    saver = db.relationship('User', lazy='select', secondary=AnswerSaver.__table__, uselist=False)

    @property
    def content_as_json(self):
        return json.loads(self.content)

    def get_answer_number(self):
        u = self.users.first()
        if not u:
            return 1
        return u.get_answers_for_task(self.task_id).filter(Answer.id <= self.id).count()

    @property
    def task_name(self) -> str:
        return TaskId.parse(
            self.task_id,
            require_doc_id=True,
            allow_block_hint=False,
            allow_custom_field=False,
            allow_type=False,
        ).task_name

    def to_json(self):
        return {
            'id': self.id,
            'task_id': self.task_id,
            'content': self.content,
            'points': self.points,
            'answered_on': self.answered_on,
            'valid': self.valid,
            'last_points_modifier': self.last_points_modifier,
            **include_if_loaded('users_all', self, 'users'),
        }
