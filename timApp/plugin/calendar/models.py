from timApp.timdb.sqa import db


class Eventgroup(db.Model):
    __tablename__ = "eventgroup"
    event_id = db.Column(db.Integer, db.ForeignKey("event.event_id"), primary_key=True)
    usergroup_id = db.Column(db.Integer, db.ForeignKey("usergroup.id"), primary_key=True)

class Event(db.Model):
    __tablename__ = "event"
    event_id = db.Column(db.Integer, primary_key=True)
    location = db.Column(db.Text)
    max_size = db.Column(db.Integer)
    event_tag = db.Column(db.Text)
    start_time = db.Column(db.DateTime(timezone=True), nullable=False)
    end_time = db.Column(db.DateTime(timezone=True), nullable=False)
    message = db.Column(db.Text)
    title = db.Column(db.Text, nullable=False)
    signup_before = db.Column(db.DateTime(timezone=True))
    creator_user_id = db.Column(db.Integer, db.ForeignKey("useraccount.id"), nullable=False)



class Enrollment(db.Model):
    __tablename__ = "enrollment"
    event_id = db.Column(db.Integer, db.ForeignKey("event.event_id"), primary_key=True)
    usergroup_id = db.Column(db.Integer, db.ForeignKey("usergroup.id"), primary_key=True)
    enroll_type_id = db.Column(db.Integer, db.ForeignKey("enrollmenttype.enroll_type_id"), nullable=False)

class Enrollmenttype(db.Model):
    __tablename__ = "enrollmenttype"
    enroll_type_id = db.Column(db.Integer, primary_key=True)
    enroll_type = db.Column(db.Text, nullable=False)