from subprocess import Popen, PIPE, check_call, CalledProcessError
from os import remove, path
from typing import Union, List
from uuid import uuid4

"""
Stamping and merging pdf-files with pdftk and pdflatex

Visa Naukkarinen
9.3.2018
"""

# TODO: scandinavian letters in stamps
# TODO: subprocess call validity checks (check_call?)


# Default parameter values
temp_folder_default_path = "/tmp"
stamp_model_default_path = "static/tex/stamp_model.tex"


##############################################################################
# Custom error classes:


class ModelStampMissingError(Exception):
    def __init__(self, file_path: str = ""):
        """
        :param file_path:
        """
        self.file_path = file_path


class ModelStampInvalidError(Exception):
    def __init__(self, file_path: str = ""):
        """
        :param file_path:
        """
        self.file_path = file_path


class TempFolderNotFoundError(Exception):
    """
    Raised if the folder for temporary files is missing
    """

    def __init__(self, folder_path: str = ""):
        """
        :param folder_path:
        """
        self.folder_path = folder_path


class AttachmentNotFoundError(Exception):
    def __init__(self, file_path: str = ""):
        """
        :param file_path: path of the attachment pdf that caused the error
        """
        self.file_path = file_path


class StampDataInvalidError(Exception):
    """
    Raised if stamp data type is wrong
    """

    def __init__(self, reason: str = "", item: Union[str, dict] = ""):
        """
        :param reason: error cause
        :param item: item that caused the error
        """
        self.reason = reason
        self.item = item


class StampDataMissingKeyError(Exception):
    """
    Raised when stamp data is missing one or more required keys.
    """

    def __init__(self, key: str = "", item: Union[str, dict] = ""):
        """
        :param key: the missing key
        :param item: the dict item which caused the error
        """
        self.key = key
        self.item = item


##############################################################################
# Functions:


def merge_pdf(pdf_path_list: Union[str, List[str]], output_path: str) -> str:
    """
    Merges a list of pdfs using pdftk
    :param pdf_path_list: list of pdfs to merge OR
           a string with paths separated with spaces
    :param output_path: merged output file path
    :return: output_path
    """
    cmd = "pdftk "
    if type(pdf_path_list) is list:  # if argument is a list
        cmd += " ".join(pdf_path_list)
    else:  # if argument is already a properly formatted string
        cmd += pdf_path_list
    cmd += " cat output " + output_path
    print(cmd)
    # TODO: try giving cmd as list
    # check_call(cmd)  # gives CalledProcessError if pdftk can't handle cmd
    p = Popen(cmd, shell=True, stdout=PIPE)
    print(str(p.communicate()))
    return output_path


def get_stamp_text(item: dict) -> str:
    """
    Gives formatted stamp text; note: may not work properly with non-ascii
    :param item: dictionary with 'date','attachment' and 'issue' keys
           or alternatively just 'text'
    :return: either contents of 'text' key or a formatted string like:
             "Kokous 25.2.2018\nLiite 1 asia 2"
    """
    # normal formatted stamp data takes precedence
    try:
        return "Kokous {0}\nLiite {1} asia {2}". \
            format(item['date'], item['attachment'], item['issue'])
    # if stamp data has only a free-form text, use that
    except KeyError:
        try:
            return item['text']
        # if dictionary doesn't have 'text'-key either;
        # normally this part is obsolete, since checks have been done before
        except KeyError:
            raise StampDataMissingKeyError('text', item)
    # if input data wasn't dictionary
    except TypeError:
        raise StampDataInvalidError("wrong type", item)


def create_stamp(model_path: str, work_dir: str, stamp_name: str, text: str) -> str:
    """
    Creates a stamp pdf-file with given text into temp folder
    :param model_path: model stamp tex-file's complete path; contains
           '%TEXT_HERE' to locate the text area
    :param work_dir: the folder where stamp output and temp files will be
    :param stamp_name: name of the stamp and temp files (no file extension)
    :param text: text displayed in the stamp
    :return: complete path of the created stamp pdf-file
    """
    try:
        # TODO: does stamp_model file close properly later?
        stamp_model = open(model_path, "r")
    # raises custom error if stamp_model is missing
    except FileNotFoundError:
        raise ModelStampMissingError()
    with stamp_model, open(path.join(work_dir, stamp_name + ".tex"), "w+") as stamp_temp:
        try:
            for line in stamp_model:
                if "%TEXT_HERE" in line:
                    stamp_temp.write(text)
                else:
                    stamp_temp.write(line)
        # if stamp_model file is broken
        # TODO: check if failure to write a new stamp file may raise this as well
        except UnicodeDecodeError:
            raise ModelStampInvalidError(model_path)

    # pdflatex can't write files outside of working directory!
    cmd = "pdflatex " + stamp_name
    print(cmd)
    # gives CalledProcessError if pdflatex can't handle cmd
    # pdflatex floods the console if there's no errors
    # check_call(cmd, cwd=work_dir)
    p = Popen(cmd, cwd=work_dir, shell=True, stdout=PIPE)
    print(str(p.communicate()))
    return work_dir + stamp_name + ".pdf"


def stamp_pdf(pdf_path: str, stamp_path: str, output_path: str) -> str:
    """
    Creates a new stamped pdf file (with stamp overlay on each page)
    :param pdf_path:
    :param stamp_path:
    :param output_path:
    :return: output_path
    """
    cmd = "pdftk " + pdf_path + " stamp " + \
          stamp_path + " output " + output_path
    print(cmd)
    # check_call(cmd)  # gives CalledProcessError if pdftk can't handle cmd
    p = Popen(cmd, shell=True, stdout=PIPE)
    print(str(p.communicate()))
    return output_path


def remove_temp_files(dir_path: str, temp_file_name: str) -> None:
    """
    Deletes temp files created for the stamping process
    :param dir_path: temp-file folder path
    :param temp_file_name: common part of the names
    :return:
    """
    ext_list = [".aux", ".log", ".out", ".pdf", ".tex", "_stamped.pdf"]
    # fail_list = []
    for ext in ext_list:
        try:
            remove(path.join(dir_path, temp_file_name + ext))
        # removes the rest of files even if some are missing
        except FileNotFoundError:
            # fail_list.append(path.join(dir_path, temp_file_name + ext))
            continue
    # return fail_list


def check_stamp_data_validity(stamp_data: List[dict]) -> None:
    """
    Raises a specific error if stamp_data is invalid
    :param stamp_data:
    :return:
    """
    # not a list
    if type(stamp_data) is not list:
        raise StampDataInvalidError("is not a list")
    # if empty
    if not stamp_data:
        raise StampDataInvalidError("is empty")
    for item in stamp_data:
        # if there are no dictionaries inside the list
        if type(item) is not dict:
            raise StampDataInvalidError("is not a dictionary", item)
        # path is always required
        if "path" not in item:
            raise StampDataMissingKeyError("path", item)
        # if missing a pdf-file
        if not path.exists(item["path"]):
            raise AttachmentNotFoundError(item["path"])
        # text or date, attachment & issue are alternatives
        if "text" not in item:
            if "date" not in item:
                raise StampDataMissingKeyError("date", item)
            if "attachment" not in item:
                raise StampDataMissingKeyError("attachment", item)
            if "issue" not in item:
                raise StampDataMissingKeyError("issue", item)


def stamp_merge_pdfs(
        stamp_data: List[dict], merged_file_path: str,
        dir_path: str = temp_folder_default_path,
        stamp_model_path: str = stamp_model_default_path) -> None:
    """
    Creates stamps, stamps pdf-files and merges them into a single file.
    :param stamp_data: dict-list containing pdf-names and stamp-contents
    :param merged_file_path: path the merged pdf-file shall have
    :param dir_path: folder for temp files
    :param stamp_model_path: tex-file to be used as model for stamps
    :return: merged_file_path
    """
    # uses 128-bit random string as temp name!
    temp_file_name = str(uuid4()) + "_"
    # a number counter to separate subsequent temp files
    counter = 0
    # string that will have all stamped pdf paths (for pdftk)
    stamped_pdf_paths = ""

    # creates a new stamp and stamps the corresponding pdfs based on
    # the data-item in dictionary
    try:
        # check if temp-folder exists
        if not (path.isdir(dir_path) and path.exists(dir_path)):
            # TODO: option to create a temp-dir if missing?
            raise TempFolderNotFoundError(dir_path)

        # check if model stamp exists
        if not path.exists(stamp_model_path):
            raise ModelStampMissingError(stamp_model_path)

        # checks multiple potential problems and raises error if invalid
        check_stamp_data_validity(stamp_data)

        for item in stamp_data:
            counter += 1
            c = str(counter)
            # the path for the current item's stamp
            stamp_i_path = path.join(dir_path, temp_file_name + c + "_stamped.pdf")
            create_stamp(stamp_model_path,
                         dir_path,
                         temp_file_name + c,
                         get_stamp_text(item))
            stamp_pdf(item['path'],
                      path.join(dir_path, temp_file_name + c + ".pdf"),
                      stamp_i_path)
            # adds the created stamp's path to be used by the merge command
            stamped_pdf_paths += stamp_i_path + " "

        merge_pdf(stamped_pdf_paths, merged_file_path)

    # in any case delete all potential temp-files
    finally:
        while counter > 0:
            c = str(counter)
            remove_temp_files(dir_path, temp_file_name + c)
            counter -= 1


##############################################################
# Testing/example:
"""
data = [
    # normal case
    {"path": "C:/Testi/testi1.pdf", "date": "20.12.2009", "attachment": 1, "issue": 2},
    # allowed case
    {"path": "C:/Testi/testi2.pdf", "text": "Sample text"},
    # text will go out of bounds a little, but will compile
    {"path": "C:/Testi/testi2.pdf", "text": "TOOOOOO LOOOOOONNNNGGGG TEEEEEEEXXXXTTTTTTTTTTTTT!"},
]
output = "C:/Testi/temp/" + str(uuid4()) + ".pdf"

# Error test cases:

stamp_merge_pdfs("banana", output)
stamp_merge_pdfs([], output)
stamp_merge_pdfs(["banana"], output)
stamp_merge_pdfs([{"path": "C:/Testi/testi2.pdf", "banana": "If this ends up\nin stamp, it's a mistake!"}], output)
stamp_merge_pdfs([{"path": "C:/Testi/broken.pdf", "text": "If this ends up\nin stamp, it's a mistake!"}], output)
stamp_merge_pdfs([{"path": "C:/Testi/i_don't_exist.pdf", "text": "If this ends up\nin stamp, it's a mistake!"}], output)

# Real case:
stamp_merge_pdfs(data, output)
"""
