import json
import sys
from datetime import datetime
from typing import List, Tuple

import click
from flask.cli import AppGroup
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from timApp.admin.datetimetype import DateTimeType
from timApp.answer.answer import Answer, AnswerSaver
from timApp.answer.answer_models import UserAnswer
from timApp.document.docentry import DocEntry
from timApp.document.docinfo import DocInfo
from timApp.timdb.sqa import db
from timApp.user.user import User
from timApp.user.usergroup import UserGroup
from timApp.velp.annotation_model import Annotation
from timApp.velp.velp_models import AnnotationComment

answer_cli = AppGroup('answer')


@answer_cli.command()
@click.option('--dry-run/--no-dry-run', default=True)
def fix_double_c(dry_run: bool) -> None:
    answers: List[Answer] = (
        Answer.query
            .filter((Answer.answered_on > datetime(year=2020, month=2, day=9)) & Answer.content.startswith('{"c": {"c":'))
            .order_by(Answer.id)
            .all()
    )
    count = 0
    for a in answers:
        cont = a.content_as_json
        if not isinstance(cont, dict):
            continue
        c = cont.get('c')
        if isinstance(c, dict):
            if 'c' in c:
                print(f'Modifying {a.id} ({a.task_id}, {a.answered_on})')
                count += 1
                if not dry_run:
                    a.content = json.dumps(c)
    print(f'Total {count}')
    commit_if_not_dry(dry_run)


@answer_cli.command()
@click.argument('doc')
@click.option('--dry-run/--no-dry-run', default=True)
def clear_all(doc: str, dry_run: bool) -> None:
    d = get_doc_or_quit(doc)
    ids = Answer.query.filter(Answer.task_id.startswith(f'{d.id}.')).with_entities(Answer.id)
    cnt = ids.count()
    UserAnswer.query.filter(UserAnswer.answer_id.in_(ids)).delete(synchronize_session=False)
    AnswerSaver.query.filter(AnswerSaver.answer_id.in_(ids)).delete(synchronize_session=False)
    anns = Annotation.query.filter(Annotation.answer_id.in_(ids))
    AnnotationComment.query.filter(AnnotationComment.annotation_id.in_(anns.with_entities(Annotation.id))).delete(synchronize_session=False)
    anns.delete(synchronize_session=False)
    Answer.query.filter(Answer.id.in_(ids)).delete(synchronize_session=False)
    click.echo(f'Total {cnt}')
    commit_if_not_dry(dry_run)


@answer_cli.command()
@click.argument('doc')
@click.option('--deadline', type=DateTimeType(), required=True)
@click.option('--group', required=True)
@click.option('--dry-run/--no-dry-run', default=True)
@click.option('--may-invalidate/--no-may-invalidate', default=False)
def revalidate(doc: str, deadline: datetime, group: str, dry_run: bool, may_invalidate: bool) -> None:
    d = get_doc_or_quit(doc)
    answers: List[Tuple[Answer, str]] = (
        Answer.query
            .filter(Answer.task_id.startswith(f'{d.id}.'))
            .join(User, Answer.users)
            .join(UserGroup, User.groups)
            .filter(UserGroup.name == group)
            .order_by(Answer.answered_on.desc())
            .with_entities(Answer, User.name)
            .all()
    )
    changed_to_valid = 0
    changed_to_invalid = 0
    for a, name in answers:
        if a.answered_on < deadline and not a.valid:
            changed_to_valid += 1
            a.valid = True
            click.echo(f'Changing to valid: {name}, {a.task_name}, {a.answered_on}, {a.points}')
        elif a.answered_on >= deadline and a.valid and may_invalidate:
            changed_to_invalid += 1
            a.valid = False
            click.echo(f'Changing to invalid: {name}, {a.task_name}, {a.answered_on}, {a.points}')
    total = len(answers)
    click.echo(f'Changing {changed_to_valid} to valid, {changed_to_invalid} to invalid.')
    click.echo(f'Total answers in document for group: {total}')
    commit_if_not_dry(dry_run)


def commit_if_not_dry(dry_run: bool) -> None:
    if not dry_run:
        db.session.commit()
    else:
        click.echo('Dry run enabled, nothing changed.')


def get_doc_or_quit(doc: str) -> DocInfo:
    d = DocEntry.find_by_path(doc)
    if not d:
        click.echo(f'cannot find document "{doc}"', err=True)
        sys.exit(1)
    return d


@answer_cli.command()
@click.argument('doc')
@click.option('--limit', required=True, type=int)
@click.option('--to', required=True, type=int)
@click.option('--dry-run/--no-dry-run', default=True)
def truncate_large(doc: str, limit: int, to: int, dry_run: bool) -> None:
    if limit < to:
        click.echo('limit must be >= to')
        sys.exit(1)
    d = get_doc_or_quit(doc)
    anss: List[Answer] = (
        Answer.query
            .filter(Answer.task_id.startswith(f'{d.id}.'))
            .filter(func.length(Answer.content) > limit)
            .options(joinedload(Answer.users_all))
            .all()
    )
    note = '\n\n(answer truncated)'
    try_keys = ['usercode', 'c']
    truncated = 0
    for a in anss:
        diff = len(a.content) - to
        if diff > 0:
            loaded = a.content_as_json
            if not isinstance(loaded, dict):
                continue
            for k in try_keys:
                c = loaded.get(k)
                if c:
                    c_diff = len(c) - to
                    if c_diff <= 0:
                        continue
                    try:
                        new_c = c[:-(c_diff + len(note))] + note
                    except IndexError:
                        continue
                    print(f'Truncating: {a.task_id}, {a.users_all[0].name}, {a.answered_on}, length {len(a.content)}')
                    truncated += 1
                    loaded[k] = new_c
                    a.content = json.dumps(loaded)
                    break
    print(f'Truncating {truncated} answers.')
    commit_if_not_dry(dry_run)
