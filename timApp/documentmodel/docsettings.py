from contracts import contract, new_contract
from utils import parse_yaml
from documentmodel.docparagraph import DocParagraph
from timdb.timdbbase import TimDbException

class DocSettings:
    global_plugin_attrs_key = 'global_plugin_attrs'
    css_key = 'css'
    macros_key = 'macros'
    macro_delimiter_key = 'macro_delimiter'
    source_document_key = "source_document"
    auto_number_headings_key = 'auto_number_headings'

    @classmethod
    def is_valid_paragraph(cls, par):
        if par.is_reference():
            par = par.get_referenced_pars(set_html=False)[0]
        if not par.is_setting():
            return True

        md = par.get_markdown().replace('```', '').replace('~~~', '')
        return parse_yaml(md).__class__ != str

    @classmethod
    def from_paragraph(cls, par):
        """Constructs DocSettings from the given DocParagraph.

        :param par: The DocParagraph to extract settings from.
        :type par: DocParagraph
        :return: The DocSettings object.
        """
        if par.is_reference():
            try:
                par = par.get_referenced_pars(set_html=False)[0]
            except TimDbException as e:
                # Invalid reference, ignore for now
                return DocSettings()
        if par.is_setting():
            md = par.get_markdown().replace('```', '').replace('~~~', '')
            yaml_vals = parse_yaml(md)
            if type(yaml_vals) is str:
                #raise ValueError("DocSettings yaml parse error: " + yaml_vals)
                print("DocSettings yaml parse error: " + yaml_vals)
                return DocSettings()
            else:
                return DocSettings(settings_dict=yaml_vals)
        else:
            return DocSettings()

    @contract
    def __init__(self, settings_dict: 'dict|None' = None):
        self.__dict = settings_dict if settings_dict else {}
        self.sanitize_macros()

    def sanitize_macros(self):
        macros = self.__dict.get(self.macros_key, {})
        if type(macros) is dict:
            macros = {str(k): str(macros[k]) for k in macros}
        else:
            macros = {}

        self.__dict[self.macros_key] = macros

    @contract
    def to_paragraph(self, doc) -> 'DocParagraph':
        text = "\n".join(['{}: {}'.format(k, self.__dict[k]) for k in self.__dict ])
        return DocParagraph.create(doc, md=text, attrs={"settings": ""})

    @contract
    def get_settings(self) -> 'dict':
        return self.__dict

    @contract
    def global_plugin_attrs(self) -> 'dict':
        return self.__dict.get(self.global_plugin_attrs_key, {})

    def css(self):
        return self.__dict.get(self.css_key)

    @contract
    def get_macros(self) -> 'dict':
        return self.__dict.get(self.macros_key, {})

    @contract
    def get_macro_delimiter(self) -> 'str':
        return self.__dict.get(self.macro_delimiter_key, '%%')

    @contract
    def get_source_document(self) -> 'int|None':
        return self.__dict.get(self.source_document_key)

    @contract
    def set_source_document(self, source_docid: 'int|None'):
        self.__dict[self.source_document_key] = source_docid

    @contract
    def auto_number_headings(self) -> 'bool':
        return self.__dict.get(self.auto_number_headings_key, False)

new_contract('DocSettings', DocSettings)
