import datetime
import json

import pytz

from documentmodel.docparagraph import DocParagraph


class DocParagraphEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, DocParagraph):
            return {'md': o.get_markdown(),
                    'html': o.get_html(),
                    't': o.get_hash(),
                    'id': o.get_id(),
                    'attrs': o.get_attrs()}
        if isinstance(o, datetime.datetime):
            if o.tzinfo is None:
                o = o.replace(tzinfo=pytz.UTC)
            return o.isoformat()
