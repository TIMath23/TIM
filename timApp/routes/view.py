"""Routes for document view."""
import time
from typing import Tuple, Union, Optional

from flask import Blueprint, render_template

import pluginControl
import routes.lecture
from documentmodel.document import get_index_from_html_list, dereference_pars
from htmlSanitize import sanitize_html
from options import *
from .common import *

Range = Tuple[int, int]

view_page = Blueprint('view_page',
                      __name__,
                      url_prefix='')


def get_whole_document(doc):
    pars = [par for par in doc]
    return pars


def get_partial_document(doc: Document, view_range: Range) -> List[DocParagraph]:
    i = 0
    pars = []
    for par in doc:
        if i >= view_range[1]:
            break
        if i >= view_range[0]:
            pars.append(par)
        i += 1
    return pars


def get_document(doc_id: int, view_range: Optional[Range] = None) -> Tuple[Document, List[DocParagraph]]:
    # Separated into 2 functions for optimization
    # (don't cache partial documents and don't check ranges in the loop for whole ones)
    doc = Document(doc_id).get_latest_version()
    doc.load_pars()
    return doc, (get_whole_document(doc) if view_range is None else get_partial_document(doc, view_range))


@view_page.route("/show_slide/<path:doc_name>")
def show_slide(doc_name):
    html = view(doc_name, 'show_slide.html')
    return html


@view_page.route("/view_content/<path:doc_name>")
def view_document_content(doc_name):
    return view(doc_name, 'view_content.html')


@view_page.route("/view/<path:doc_name>")
@view_page.route("/view_html/<path:doc_name>")
@view_page.route("/doc/<path:doc_name>")
def view_document(doc_name):
    return view(doc_name, 'view_html.html')


@view_page.route("/teacher/<path:doc_name>")
def teacher_view(doc_name):
    usergroup = request.args.get('group')
    return view(doc_name, 'view_html.html', usergroup=usergroup, route="teacher")


@view_page.route("/velp/<path:doc_name>")
def velp_view(doc_name):
    usergroup = request.args.get('group')
    return view(doc_name, 'view_html.html', usergroup=usergroup, route="velp")


@view_page.route("/answers/<path:doc_name>")
def see_answers_view(doc_name):
    usergroup = request.args.get('group')
    return view(doc_name, 'view_html.html', usergroup=usergroup, route="answers")


@view_page.route("/lecture/<path:doc_name>")
def lecture_view(doc_name):
    return view(doc_name, 'view_html.html', route="lecture")


@view_page.route("/slide/<path:doc_name>")
def slide_document(doc_name):
    html = view(doc_name, 'view_html.html', route="slide")
    return html


@view_page.route("/par_info/<int:doc_id>/<par_id>")
def par_info(doc_id, par_id):
    timdb = getTimDb()
    info = {}

    def just_name(fullpath):
        return ('/' + fullpath).rsplit('/', 1)[1]

    doc_name = timdb.documents.get_first_document_name(doc_id)
    info['doc_name'] = just_name(doc_name) if doc_name is not None else 'Document #{}'.format(doc_id)

    group = timdb.users.get_owner_group(doc_id)
    users = timdb.users.get_users_in_group(group.id, limit=2)
    if len(users) == 1:
        info['doc_author'] = '{} ({})'.format(users[0]['name'], group.name)
    else:
        info['doc_author'] = group.name

    par_name = Document(doc_id).get_closest_paragraph_title(par_id)
    if par_name is not None:
        info['par_name'] = par_name

    return jsonResponse(info)


def parse_range(start_index: Union[int, str, None], end_index: Union[int, str, None]) -> Optional[Range]:
    if start_index is None and end_index is None:
        return None
    return int(start_index), int(end_index)


def try_return_folder(doc_name):
    timdb = getTimDb()
    user = getCurrentUserId()
    user_name = getCurrentUserName()
    is_in_lecture, lecture_id, = timdb.lectures.check_if_in_any_lecture(user)
    if is_in_lecture:
        is_in_lecture = routes.lecture.check_if_lecture_is_running(lecture_id)

    possible_groups = timdb.users.get_usergroups_printable(getCurrentUserId())
    settings = get_user_settings()

    item_name = doc_name.rstrip('/')
    block_id = timdb.folders.get_folder_id(item_name)

    if block_id is None and item_name == 'users/' + user_name and timdb.folders.get_folder_id('users') is not None:
        # This is the user's personal folder and it doesn't exist yet.
        # Create it
        block_id = timdb.folders.create('users/' + user_name, getCurrentUserGroup())

    elif block_id is None:
        while (block_id is None):
            item_name, _ = timdb.folders.split_location(item_name)
            block_id = timdb.folders.get_folder_id(item_name)
            if block_id is None:
                block_id = timdb.documents.get_document_id(item_name)

        foundItem = None
        if verify_view_access(block_id, require=False):
            foundItem = item_name

        rights = can_write_to_folder(item_name) and timdb.folders.get_folder_id(item_name) is not None

        return render_template('create_new.html',
                           userName=getCurrentUserName(),
                           userId=user,
                           userGroups=possible_groups,
                           rights=rights,
                           in_lecture=is_in_lecture,
                           settings=settings,
                           newItem=doc_name,
                           foundItem=foundItem,
                           doc={'id': -1, 'fullname': ''}), 404

    doc = timdb.folders.get(block_id)
    return render_template('index.html',
                           doc=doc,
                           userGroups=possible_groups,
                           rights=get_rights(block_id),
                           folder=True,
                           in_lecture=is_in_lecture,
                           settings=settings)


debug_time = time.time()


def show_time(s):
    global debug_time
    nyt = time.time()
    print(s, nyt - debug_time)
    debug_time = nyt


def view(doc_path, template_name, usergroup=None, route="view"):
    save_last_page()

    timdb = getTimDb()
    doc_info = timdb.documents.resolve_doc_id_name(doc_path)

    if doc_info is None:
        return try_return_folder(doc_path)

    try:
        message = session['message']
        session['message'] = None
    except KeyError:
        message = None

    doc_id = doc_info['id']
    edit_mode = request.args.get('edit', None) if has_edit_access(doc_id) else None

    if route == 'teacher':
        if verify_teacher_access(doc_id, False) is False:
            if verify_view_access(doc_id):
                session['message'] = "Did someone give you a wrong link? Showing normal view instead of teacher view."
                return redirect('/view/' + doc_path)

    if route == 'answers':
        if verify_seeanswers_access(doc_id, False) is False:
            if verify_view_access(doc_id):
                session['message'] = "Did someone give you a wrong link? Showing normal view instead of answers view."
                return redirect('/view/' + doc_path)

    if not has_view_access(doc_id):
        if not logged_in():
            return redirect_to_login()
        else:
            abort(403)

    if get_option(request, 'login', False) and not logged_in():
        return redirect_to_login()

    try:
        view_range = parse_range(request.args.get('b'), request.args.get('e'))
    except (ValueError, TypeError):
        view_range = None
    start_index = max(view_range[0], 0) if view_range else 0

    doc, xs = get_document(doc_id, view_range)

    clear_cache = get_option(request, "nocache", False)
    hide_answers = get_option(request, 'noanswers', False)

    teacher_or_see_answers = route in ('teacher', 'answers')
    doc_settings = doc.get_settings()

    # Preload htmls here to make dereferencing faster
    DocParagraph.preload_htmls(xs, doc_settings, clear_cache)
    if doc_settings:
        src_doc_id = doc_settings.get_source_document()
        if src_doc_id is not None:
            src_doc = Document(src_doc_id)
            DocParagraph.preload_htmls(src_doc.get_paragraphs(), src_doc.get_settings(), clear_cache)

    # We need to deference paragraphs at this point already to get the correct task ids
    xs = dereference_pars(xs, edit_window=False, source_doc=doc.get_original_document())
    total_tasks = None
    total_points = None
    tasks_done = None
    task_ids = None
    user_list = []
    current_user = get_current_user() if logged_in() else None
    if teacher_or_see_answers or (doc_settings.show_task_summary() and logged_in()):
        task_ids = pluginControl.find_task_ids(xs)
        total_tasks = len(task_ids)
    if teacher_or_see_answers:
        user_list = None
        if usergroup is not None:
            user_list = [user['id'] for user in timdb.users.get_users_for_group(usergroup)]
        user_list = timdb.answers.getUsersForTasks(task_ids, user_list)
    elif doc_settings.show_task_summary() and logged_in():
        info = timdb.answers.getUsersForTasks(task_ids, [current_user['id']])
        if info:
            total_points = info[0]['total_points']
            tasks_done = info[0]['task_count']
    current_list_user = user_list[0] if user_list else None

    raw_css = doc_settings.css() if doc_settings else None
    doc_css = sanitize_html('<style type="text/css">' + raw_css + '</style>') if raw_css else None

    # Custom backgrounds for slides
    slide_background_url = None
    slide_background_color = None

    if template_name == 'show_slide.html':
        slide_background_url = doc_settings.get_slide_background_url()
        slide_background_color = doc_settings.get_slide_background_color()
        do_lazy = False
    else:
        do_lazy = get_option(request, "lazy", True)

    show_questions = False
    no_question_auto_numbering = None

    if route == 'lecture' and has_edit_access(doc_id):
        show_questions = True
        no_question_auto_numbering = doc_settings.auto_number_questions()

    texts, jsPaths, cssPaths, modules = post_process_pars(doc,
                                                          xs,
                                                          current_list_user or current_user,
                                                          sanitize=False,
                                                          do_lazy=do_lazy,
                                                          load_plugin_states=not hide_answers,
                                                          show_questions=show_questions)

    index = get_index_from_html_list(t['html'] for t in texts)

    if hide_names_in_teacher(doc_id):
        if not timdb.users.user_is_owner(current_list_user['id'], doc_id)\
           and current_list_user['id'] != getCurrentUserId():
            current_list_user['name'] = '-'
            current_list_user['real_name'] = 'Someone'
            current_list_user['email'] = 'someone@example.com'
        for user in user_list:
            if not timdb.users.user_is_owner(user['id'], doc_id)\
               and user['id'] != getCurrentUserId():
                user['name'] = '-'
                user['real_name'] = 'Someone {}'.format(user['id'])
                user['email'] = 'someone_{}@example.com'.format(user['id'])

    settings = get_user_settings()

    is_in_lecture = False
    if logged_in():
        is_in_lecture, lecture_id, = timdb.lectures.check_if_in_any_lecture(current_user['id'])
        if is_in_lecture:
            is_in_lecture = routes.lecture.check_if_lecture_is_running(lecture_id)


    show_unpublished_bg = is_considered_unpublished(doc_id)

    return render_template(template_name,
                           show_unpublished_bg=show_unpublished_bg,
                           route=route,
                           edit_mode=edit_mode,
                           doc=doc_info,
                           text=texts,
                           headers=index,
                           plugin_users=user_list,
                           version=doc.get_version(),
                           js=jsPaths,
                           cssFiles=cssPaths,
                           jsMods=modules,
                           doc_css=doc_css,
                           start_index=start_index,
                           in_lecture=is_in_lecture,
                           group=usergroup,
                           rights=get_rights(doc_id),
                           translations=timdb.documents.get_translations(doc_id),
                           reqs=pluginControl.get_all_reqs(),
                           settings=settings,
                           no_browser=hide_answers,
                           no_question_auto_numbering=no_question_auto_numbering,
                           slide_background_url=slide_background_url,
                           slide_background_color=slide_background_color,
                           message=message,
                           task_info={'total_points': total_points,
                                      'tasks_done': tasks_done,
                                      'total_tasks': total_tasks})


def redirect_to_login():
    session['came_from'] = request.url
    session['anchor'] = request.args.get('anchor', '')
    return render_template('loginpage.html',
                           came_from=request.url,
                           anchor=session['anchor']), 403
