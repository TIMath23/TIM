from enum import Enum

from timApp.timdb.sqa import db


class DisplayType(Enum):
    TOP_OF_PAGE = 0
    STICKY = 1


class InternalMessage(db.Model):
    """A TIM message."""

    __tablename__ = 'internalmessage'

    id = db.Column(db.Integer, primary_key=True)
    """Message identifier."""

    doc_id = db.Column(db.Integer, db.ForeignKey('block.id'), nullable=False)
    """Block identifier."""

    par_id = db.Column(db.Text, nullable=False)
    """Paragraph identifier."""

    can_mark_as_read = db.Column(db.Boolean, nullable=False)
    """Whether the recipient can mark the message as read."""

    reply = db.Column(db.Boolean, nullable=False)
    """Whether the message can be replied to."""

    display_type = db.Column(db.Enum(DisplayType), nullable=False)
    """How the message is displayed."""

    displays = db.relationship('InternalMessageDisplay', back_populates='message')
    readreceipt = db.relationship('InternalMessageReadReceipt', uselist=False, back_populates='message')
    block = db.relationship('Block', back_populates='internalmessage')

    # TODO: Expiration date and sender if necessary
    #  Expiration date: use Block's BlockAccess: accessible_from and accessible_to?
    #  Sender: use Block's BlockAccess: usergroup_id (owner?)


class InternalMessageDisplay(db.Model):
    """Where and for whom a TIM message is displayed."""

    __tablename__ = 'internalmessage_display'

    message_id = db.Column(db.Integer, db.ForeignKey('internalmessage.id'), primary_key=True)
    """Message identifier."""

    usergroup_id = db.Column(db.Integer, db.ForeignKey('usergroup.id'))
    """Who sees the message; if null, displayed for everyone."""

    display_doc_id = db.Column(db.Integer, db.ForeignKey('block.id'), nullable=False)
    """Identifier for the document or the folder where the message is displayed."""
    # VIESTIM: If null, displayed globally on TIM? We're not doing message approval through admin though.
    #  Currently not nullable.

    message = db.relationship('InternalMessage', back_populates='displays')
    usergroup = db.relationship('UserGroup', back_populates='internalmessage_display')
    display_block = db.relationship('Block', back_populates='internalmessage_display')


class InternalMessageReadReceipt(db.Model):
    """Metadata about read receipts."""

    __tablename__ = 'internalmessage_readreceipt'

    message_id = db.Column(db.Integer, db.ForeignKey('internalmessage.id'), primary_key=True)
    """Message identifier."""

    user_id = db.Column(db.Integer, db.ForeignKey('useraccount.id'), nullable=False)
    """Identifier for the user who marked the message as read."""

    marked_as_read_on = db.Column(db.DateTime)
    """Timestamp for when the message was marked as read."""

    message = db.relationship('InternalMessage', back_populates='readreceipt')
    user = db.relationship('User', back_populates='internalmessage_readreceipt')
