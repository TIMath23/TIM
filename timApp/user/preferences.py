import re
import sre_constants
from functools import cached_property
from typing import Optional

import attr

from timApp.document.docentry import DocEntry
from timApp.item.block import Block
from timApp.item.item import Item
from timApp.user.settings.theme_css import (
    generate_style,
)


def export_doc_to_style(block: Block):
    from timApp.printing.print import print_doc_scss

    doc: DocEntry = block.docentries[0]
    pars = [p for p in doc.document]
    print(pars)
    doc_path = print_doc_scss(doc)
    with open(doc_path, "r") as f:
        return f.read()


@attr.s(auto_attribs=True)
class Preferences:
    custom_css: str = ""
    use_document_word_list: bool = False
    disable_menu_hover: bool = False
    remember_last_sidebar_menu_tab: bool = False
    remember_last_sidebar_menu_state: bool = False
    word_list: str = ""
    email_exclude: str = ""
    language: Optional[str] = None
    theme_doc_ids: list[int] = attr.Factory(list)
    last_answer_fetch: dict[str, str] = attr.Factory(dict)
    auto_mark_all_read: bool = False
    bookmarks: Optional[list[dict[str, list[dict[str, str]]]]] = None
    max_uncollapsed_toc_items: Optional[int] = None

    @staticmethod
    def from_json(j: dict) -> "Preferences":
        j.pop("css_combined", None)
        return Preferences(**j)

    def theme_docs(self) -> list[DocEntry]:
        return DocEntry.query.filter(DocEntry.id.in_(self.theme_doc_ids)).all()

    @cached_property
    def css_combined(self) -> str:
        return generate_style(self.theme_docs())

    @cached_property
    def excluded_email_paths(self):
        if not isinstance(self.email_exclude, str):
            return []
        try:
            return [re.compile(s) for s in self.email_exclude.strip().splitlines()]
        except sre_constants.error:
            return []

    def is_item_excluded_from_emails(self, d: Item):
        return any(pat.search(d.path) for pat in self.excluded_email_paths)

    def to_json(self):
        return self.__dict__
