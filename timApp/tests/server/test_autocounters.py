"""A test for markdownconverter module."""
import unittest

import yaml

import timApp.markdown.dumboclient
from timApp.document.docparagraph import DocParagraph
from timApp.document.usercontext import UserContext
from timApp.document.viewcontext import default_view_ctx
from timApp.markdown.autocounters import AutoCounters
from timApp.markdown.markdownconverter import md_to_html, par_list_to_html_list
from timApp.printing.documentprinter import DocumentPrinter
from timApp.tests.db.timdbtest import TimDbTest, TEST_USER_1_ID
from timApp.user.user import User
from tim_common.cs_sanitizer import tim_sanitize


class AutoCountersTest(TimDbTest):
    def test_fig_counter(self):
        macros = {}
        counters = AutoCounters(macros)
        s = counters.fig_counter("figA")
        self.assertEqual(
            '<a id=""></a>[?figA?]{.red}',
            s,
            msg="AutoCounters figure before renumbering",
        )

        counters.renumbering = True
        s = counters.fig_counter("figA")
        counters.fig_counter("figB")
        counters.fig_counter("figC")
        self.assertEqual(
            '<a id=""></a>[?figA?]{.red}', s, msg="AutoCounters figure when renumbering"
        )
        auto_macros = counters.get_counter_macros()
        auto_json = yaml.load(auto_macros, Loader=yaml.SafeLoader)
        fig_a = auto_json["macros"]["autocnts"]["figA"]
        fig_a_ex = {
            "h": "c:figA",
            "l": "1",
            "n": "figA",
            "p": "1",
            "r": "1",
            "s": "1",
            "t": "1",
            "v": 1,
            "y": "fig",
        }
        self.assertEqual(
            fig_a_ex, fig_a, msg="AutoCounters figure macros after renumbering"
        )
        macros = auto_json["macros"]
        counters = AutoCounters(macros)
        sa = counters.fig_counter("figA")
        self.assertEqual(
            '<a id="c:figA"></a>1', sa, msg="AutoCounters figure A after renumbering"
        )
        sb = counters.fig_counter("figB")
        self.assertEqual(
            '<a id="c:figB"></a>2', sb, msg="AutoCounters figure B after renumbering"
        )
        sc = counters.fig_counter("figC")
        self.assertEqual(
            '<a id="c:figC"></a>3', sc, msg="AutoCounters figure C after renumbering"
        )

        sb = counters.show_ref_value("figB")
        self.assertEqual("[2](#c:figB)", sb, msg="AutoCounters ref to figB")

        macros["tex"] = True
        counters = AutoCounters(macros)
        sb = counters.fig_counter("figB").strip()
        self.assertEqual("\\label{c:figB}2", sb, msg="AutoCounters figB in LaTeX")

    def check_conversion(self, html, md, macros=None):
        s = md_to_html(md, sanitize=True, macros=macros)
        self.assertEqual(html, s)

    def doc_with_counters(self, docstr, htmls_ex, msg):
        settinsgtr = """``` {settings=""}
auto_number_headings: 0
```
"""
        str = settinsgtr + docstr
        d = self.create_doc(initial_par=str)
        printer = DocumentPrinter(d, template_to_use=None, urlroot="")
        counters = printer.get_autocounters(
            UserContext.from_one_user(User.query.get(TEST_USER_1_ID))
        )
        new_counter_macro_values = (
            f'``` {{settings="counters"}}\n{counters.get_counter_macros()}```\n'
        )

        str = settinsgtr + new_counter_macro_values + docstr
        d = self.create_doc(initial_par=str)
        p = d.document.get_paragraphs()[2:]
        htmls = (
            par_list_to_html_list(
                p, settings=d.document.get_settings(), view_ctx=default_view_ctx
            ),
        )
        actual = "\n".join(htmls[0])
        self.assertEqual(htmls_ex.strip("\n"), actual, msg=msg)

    def test_begin1_environment(self):
        docstr = """#- 
%%"Pythagoras |py" | c_begin1%%
a^2+b^2=c^2
%%""|c_end%%
#-
Katso %%"py"|lref%%
"""
        htmls_ex = """
<p><a id="eq:py"></a><span class="math display">\\[\\begin{align*}\\tag{Pythagoras 1}
a^2+b^2=c^2
\\end{align*}\\]</span></p>
<p>Katso <a href="#eq:py">(Pythagoras 1)</a></p>
"""
        self.doc_with_counters(docstr, htmls_ex, "AutoCounters c_begin1")

    def test_begin_environment(self):
        docstr = """#- 
%%"x"|c_begin%%
a+1 §\\
a+2 §\\
a+3 {§a3§}\\\\
a+4 §\\
%%""|c_end%%
#-
Katso %%"x1"|ref%%, %%"x2"|ref%%, %%"a3"|ref%%
"""
        htmls_ex = """
<p><a id="eq:x"></a><span class="math display">\[\\begin{align*}
a+1 \\tag{1}\\\\
a+2 \\tag{2}\\\\
a+3 \\tag{3}\\\\
a+4 \\tag{4}\\\\
\end{align*}\]</span></p>
<p>Katso <a href="#eq:x">(1)</a>, <a href="#eq:x">(2)</a>, <a href="#eq:x">(3)</a></p>
"""
        self.doc_with_counters(docstr, htmls_ex, "AutoCounters c_begin")

    def test_begin_no_base_name_environment(self):
        docstr = """#- 
%%""|c_begin%%
a+3 {§a3§}\\\\
a+4 {§a4§}\\\\
%%""|c_end%%
#-
Katso %%"a3"|ref%%, %%"a4"|ref%% 
"""
        htmls_ex = """
<p><a id="eq:a3"></a><a id="eq:a4"></a><span class="math display">\[\\begin{align*}
a+3 \\tag{1}\\\\
a+4 \\tag{2}\\\\
\end{align*}\]</span></p>
<p>Katso <a href="#eq:a3">(1)</a>, <a href="#eq:a4">(2)</a></p>
"""
        self.doc_with_counters(docstr, htmls_ex, "AutoCounters c_begin no basename")

    def test_tasks(self):
        docstr = """ 
``` {plugin="csPlugin" #shell1}
type: shell
path: user
header: 'Tehtävä §n: Eka'
```

``` {plugin="csPlugin" #shell2}
type: shell
path: user
header: 'Tehtävä §n: Toka'
```
#-
Katso %%"shell1"|ref%%, %%"shell2"|ref%% 
"""
        htmls_ex = """
<pre><code>type: shell
path: user
header: &#39;Tehtävä 1: Eka&#39;</code></pre>
<pre><code>type: shell
path: user
header: &#39;Tehtävä 2: Toka&#39;</code></pre>
<p>Katso <a href="#shell1">1</a>, <a href="#shell2">2</a></p>
"""
        self.doc_with_counters(docstr, htmls_ex, "AutoCounters tasks")
