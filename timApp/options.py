# -*- coding: utf-8 -*-


def get_option(request, name, default, cast=None):
    if name not in request.args: return default
    result = request.args[name]
    lresult = result.lower()
    if isinstance(default, bool):
        if lresult == "false":
            return False
        if lresult == "true":
            return True
    if isinstance(default, int):
        try:
            return int(lresult)
        except ValueError:
            return default
    if cast is not None:
        try:
            result = cast(result)
        except ValueError:
            pass
    return result
