"""
csPlugin attributes:
command: a single command that will be run. More about these commands below.
commands: a dictionary of commands that can be run. The keys are identifiers used by commandKey.
commandKey: a string telling which command to use if 'command' is none or not specified, default 'run'
jsFiles: list of paths to javascript files to be included. Paths can be absolute (e.g. /cs/masters/... or https://...)
    or relative (doesn't start with / or http) in which case the path is assumed to be relative to masterPath.
cssFiles: same as jsFiles but for css files

About commands:
Any "points_rule" string will be replaced by points_rule as json.
The command should print a json string to standard output with the following structure:
{
    points: number,
    max_points: number,
    penalties: a dictionary with <penalty identifier in PointsRule> as key and <true/false/descriptor string> as value. 
        // string means true. Each entry is optional, in which case it is assumed false, i.e. no penalty
    output_boxes: list of {
        hide: <boolean: whether to hide the element by default>,
        title: {
            classes: <classes to add to title element>,
            content: <actual title>,
            isHTML: <if the title is html>,
            isAngular: <if the title is angular html>
        },
        content: {
            classes: <classes to add to content element>,
            content: <actual content>,
            isHTML: <if the content is html>,
            isAngular: <if the content is angular html>
        }
    }
}
"""

import shutil
import distutils.dir_util
from copy import deepcopy
from pathlib import Path
import json
import time
import html
from typing import List, Dict, Union

from fileParams import *
from run import *
from points import *
from languages import Language
from loadable import Loadable

# TODO: replace Loadable with dataclass and marshmallow.
# Requires python 3.7+ and marshmallow module.

class DivContent(Loadable):
    classes: str = ""
    content: str = None
    isHTML: bool = False
    isAngular: bool = False

class OutputContainer(Loadable):
    title: DivContent = None
    content: DivContent = None
    hide: bool = False # whether to hide by default

class RunResult(Loadable):
    output_boxes: List[OutputContainer] = []
    penalties: Dict[str, Union[bool, str]] = {}
    points: float = 0
    max_points: float = None
    
    def penalize(self, key: str) -> bool:
        return self.penalties and self.penalties.get(key, False)

class ExtCheck(Language):
    ttype="extcheck"
    def __init__(self, query, sourcecode):
        super().__init__(query, sourcecode)
        
        self.penalties = []
        self.result = None
        self.just_compile = False
        
        self.command = get_param(query, "command", None)
        if self.command is None:
            command_key = get_param(self.query, "commandKey", None)
            if command_key is None:
                command_key = "run"
            
            commands = get_param(self.query, "commands", None)
            if not commands:
                raise Exception("commandKey is used (command is None/not specified) but no commands are specified")
            
            if command_key in commands:
                self.command = commands[command_key]
            else:
                raise Exception(f"Command key {command_key} not found in commands")
    
    def run(self, result, sourcelines, points_rule):
        if isinstance(self.command, list):
            self.command = [c.replace("points_rule", json.dumps(points_rule)) for c in self.command]
        else:
            self.command = self.command.replace("points_rule", json.dumps(points_rule))
        
        code, out, err, pwddir = self.runself(self.command)
        if code != 0:
            err = "Failed to run the test:\n" + err
            return code, "", err, pwddir
        
        self.result = RunResult()
        try:
            self.result = RunResult(json.loads(out))
        except json.JSONDecodeError as e:
            print("ExtCheck: Failed to load output json: ", e)
            if not err:
                err = "Failed to load output json"
            return -3, "", err, ""
        
        max_points = get_points_rule(points_rule, "maxPoints", 0)
        try:
            max_points = float(max_points)
        except:
            max_points = None
        
        if self.result.max_points:
            if max_points is not None:
                self.result.points = self.result.points*max_points/self.result.max_points
            else:
                print("ExtCheck: maxPoints cannot be converted to float.")
                raise TypeError("ExtCheck: maxPoints cannot be converted to float.")
        elif max_points is not None and self.result.points > max_points:
            print("ExtCheck: points greater than maxPoints.")
            raise TypeError("ExtCheck: points greater than maxPoints.")
        
        penalties = get_points_rule(points_rule, "penalties", {})
        if penalties and self.result.penalties:
            for key, value in penalties.items():
                if self.result.penalize(key):
                    self.result.points = self.result.points*(1.0 - value)
                    if isinstance(self.result.penalties[key], str):
                        self.penalties.append(f"{self.result.penalties[key]} Penalty -{value*100}%.")
                    else:
                        self.penalties.append(f"{key} penalty: -{value*100}%.")
        
        try:
            give_points(points_rule, "output", self.result.points)
        except Exception as e:
            print("ExtCheck: could not set points: ", e)
            err += "Could not set points:\n" + str(e)
            return code, out, err, pwddir
        else:
            self.run_points_given = True
        
        return code, "", "", pwddir
    
    @staticmethod
    def get_files(attr):
        files = []
        
        path = Path("/cs/masters")
        if not path.is_dir:
            return files
        
        for dir in os.listdir("/cs/masters"):
            file = path / dir / "csmarkup.json"
            if not file.is_file():
                continue
            
            data = {}
            with open(str(file), 'r') as f:
                data = json.load(f)
            
            tmp = data.get(attr, [])
            tmp = [f if f.startswith('http') or f.startswith('/') else str(path / dir / f) for f in tmp]
            
            files.extend(tmp)
        
        return files
    
    @staticmethod
    def js_files():
        return ["/cs/js/build/extcheck.js"] + ExtCheck.get_files("jsFiles")
    
    @staticmethod
    def css_files():
        return ["/cs/css/extcheck.css"] + ExtCheck.get_files("cssFiles")
    
    def runner_name(self):
        return "cs-extcheck-runner"
    
    def web_data(self):
        if self.result is None:
            return None
        
        out = self.result.to_dict()
        out["penalties"] = self.penalties
        return out