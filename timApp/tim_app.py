"""Creates the Flask application for TIM.

Insert only configuration-related things in this file. Do NOT define routes here.

"""
import inspect
import mimetypes
import sys
from typing import Optional

from flask import Flask
from flask_migrate import Migrate
from flask_wtf import CSRFProtect
from sqlalchemy import func
from sqlalchemy.sql.ddl import CreateTable

from timApp.answer.answer import Answer, AnswerSaver
from timApp.answer.answer_models import AnswerTag, AnswerUpload, UserAnswer
from timApp.auth.auth_models import AccessTypeModel, BlockAccess
from timApp.document.docentry import DocEntry
from timApp.document.timjsonencoder import TimJsonEncoder
from timApp.document.translation.translation import Translation
from timApp.folder.folder import Folder
from timApp.item.block import Block
from timApp.item.blockassociation import BlockAssociation
from timApp.item.blockrelevance import BlockRelevance
from timApp.item.tag import Tag
from timApp.korppi.openid import KorppiOpenID
from timApp.lecture.askedjson import AskedJson
from timApp.lecture.askedquestion import AskedQuestion
from timApp.lecture.lecture import Lecture
from timApp.lecture.lectureanswer import LectureAnswer
from timApp.lecture.lectureusers import LectureUsers
from timApp.lecture.message import Message
from timApp.lecture.question import Question
from timApp.lecture.questionactivity import QuestionActivity
from timApp.lecture.runningquestion import Runningquestion
from timApp.lecture.showpoints import Showpoints
from timApp.lecture.useractivity import Useractivity
from timApp.note.usernote import UserNote
from timApp.notification.notification import Notification
from timApp.notification.pending_notification import PendingNotification, DocumentNotification, CommentNotification
from timApp.plugin.timtable.row_owner_info import RowOwnerInfo
from timApp.printing.printeddoc import PrintedDoc
from timApp.readmark.readparagraph import ReadParagraph
from timApp.sisu.scimusergroup import ScimUserGroup
from timApp.slide.slidestatus import SlideStatus
from timApp.timdb.sqa import db
from timApp.user.consentchange import ConsentChange
from timApp.user.hakaorganization import HakaOrganization
from timApp.user.newuser import NewUser
from timApp.user.personaluniquecode import PersonalUniqueCode
from timApp.user.user import User
from timApp.user.usergroup import UserGroup
from timApp.user.usergroupdoc import UserGroupDoc
from timApp.user.usergroupmember import UserGroupMember
from timApp.util.flask.filters import map_format, timdate, humanize_timedelta, humanize_datetime
from timApp.util.logger import setup_logging
from timApp.util.utils import datestr_to_relative, date_to_relative
from timApp.velp.annotation_model import Annotation
from timApp.velp.velp_models import Velp, VelpContent, VelpGroup, VelpGroupDefaults, VelpGroupLabel, \
    VelpGroupSelection, VelpGroupsInDocument, VelpInGroup, VelpLabel, VelpLabelContent, VelpVersion, \
    LabelInVelp, AnnotationComment


# All SQLAlchemy models must be imported in this module.
all_models = (
    AccessTypeModel,
    Annotation,
    AnnotationComment,
    Answer,
    AnswerSaver,
    AnswerTag,
    AnswerUpload,
    AskedJson,
    AskedQuestion,
    Block,
    BlockAccess,
    BlockAssociation,
    BlockRelevance,
    CommentNotification,
    ConsentChange,
    DocEntry,
    DocumentNotification,
    Folder,
    HakaOrganization,
    LabelInVelp,
    Lecture,
    LectureAnswer,
    LectureUsers,
    Message,
    NewUser,
    Notification,
    PendingNotification,
    PersonalUniqueCode,
    PrintedDoc,
    Question,
    QuestionActivity,
    ReadParagraph,
    RowOwnerInfo,
    Runningquestion,
    ScimUserGroup,
    Showpoints,
    SlideStatus,
    Tag,
    Translation,
    User,
    Useractivity,
    UserAnswer,
    UserGroup,
    UserGroupDoc,
    UserGroupMember,
    UserNote,
    Velp,
    VelpContent,
    VelpGroup,
    VelpGroupDefaults,
    VelpGroupLabel,
    VelpGroupSelection,
    VelpGroupsInDocument,
    VelpInGroup,
    VelpLabel,
    VelpLabelContent,
    VelpVersion,
)

sys.setrecursionlimit(10000)
app = Flask(__name__)

app.jinja_env.auto_reload = True  # uncomment this to autoreload templates

app.jinja_env.trim_blocks = True
app.jinja_env.lstrip_blocks = True
app.config.from_pyfile('defaultconfig.py', silent=False)
app.config.from_envvar('TIM_SETTINGS', silent=True)
app.config.from_json('hosts.json', silent=True)
setup_logging(app)

# Compress(app)

# Disabling object expiration on commit makes testing easier
# because sometimes objects would expire after calling a route.
if app.config['TESTING']:
    db.session = db.create_scoped_session({'expire_on_commit': False})

db.init_app(app)
db.app = app
migrate = Migrate(app, db)
oid = KorppiOpenID(app, safe_roots=['https://korppi.jyu.fi'])

csrf = CSRFProtect(app)

app.jinja_env.filters['map_format'] = map_format
app.jinja_env.filters['datestr_to_relative'] = datestr_to_relative
app.jinja_env.filters['date_to_relative'] = date_to_relative
app.jinja_env.filters['timdate'] = timdate
app.jinja_env.filters['timtimedelta'] = humanize_timedelta
app.jinja_env.filters['timreldatetime'] = humanize_datetime
app.jinja_env.add_extension('jinja2.ext.do')

mimetypes.add_type('text/plain', '.scss')

app.json_encoder = TimJsonEncoder


@app.shell_context_processor
def make_shell_context():
    ctx = {
        c.__name__: c for c in all_models
    }
    ctx['db'] = db
    ctx['func'] = func
    return ctx


def print_schema(bind: Optional[str] = None):
    """Prints the database schema generated by the models.

    :param bind: The bind to use.

    """
    models = inspect.getmembers(sys.modules[__name__], lambda x: inspect.isclass(x) and hasattr(x, '__table__'))
    eng = db.get_engine(app, bind)

    for _, model_class in models:
        print(CreateTable(model_class.__table__).compile(eng), end=';')
    print()
    sys.stdout.flush()


# print_schema()


def get_home_organization_group() -> UserGroup:
    return UserGroup.get_organization_group(app.config['HOME_ORGANIZATION'])
