var angular, $;
var PermApp = angular.module('timApp');

PermApp.controller("PermCtrl", [
    '$scope',
    '$http',
    'Upload',
    '$window',
    '$timeout',
    '$compile',
    '$log',
    function (sc, $http, Upload, $window, $timeout, $compile, $log) {
        "use strict";
        sc.wikiRoot = "https://trac.cc.jyu.fi/projects/ohj2/wiki/"; // Todo: replace something remembers users last choice


        sc.showMoreChangelog = function () {
            var newLength = sc.item.versions.length + 100;
            sc.changelogLoading = true;
            $http.get('/changelog/' + sc.item.id + '/' + (newLength)).then(function (response) {
                sc.item.versions = response.data.versions;
                sc.hasMoreChangelog = sc.item.versions.length === newLength;
            }, function (response) {
                $log.error('Failed to get more changelog.');
            }).finally(function () {
                sc.changelogLoading = false;
            });
        };

        sc.getJustDocName = function(path) {
            var i = path.lastIndexOf('/');
            return i < 0 ? path : path.substr(i + 1);
        };

        sc.getFolderName = function(path) {
            var i = path.lastIndexOf('/');
            return i < 0 ? '' : path.substring(0, path.lastIndexOf('/'));
        };

        sc.getAliases = function() {
            $http.get('/alias/' + sc.item.id, {
            }).success(function (data, status, headers, config) {
                if (sc.aliases.length > 0 &&
                    (data.length === 0 || data[0].path !== sc.aliases[0].path))
                        // The first name has changed, reload to update the links
                        location.reload();
                else
                    sc.aliases = data;

            }).error(function (data, status, headers, config) {
                $window.alert("Error loading aliases: " + data.error);
            });

            return [];
        };

        sc.getTranslations = function() {
            if (sc.isFolder)
                return [];

            $http.get('/translations/' + sc.item.id, {
            }).success(function (data, status, headers, config) {
                sc.lang_id = "";
                sc.translations = [];

                for (var i = 0; i < data.length; i++) {
                    var tr = data[i];

                    if (tr.id === sc.item.id) {
                        sc.lang_id = tr.lang_id;
                    }
                    else {
                        var trnew = JSON.parse(JSON.stringify(tr));
                        trnew.old_langid = tr.lang_id;
                        trnew.old_title = tr.title;
                        sc.translations.push(trnew);
                    }
                }

                sc.old_title = sc.item.title;
                sc.old_langid = sc.lang_id;

            }).error(function (data, status, headers, config) {
                $window.alert("Error loading translations: " + data.error);
            });

            return [];
        };

        sc.metaChanged = function() {
            return sc.item.title !== sc.old_title || sc.lang_id !== sc.old_langid;
        };

        sc.updateMetadata = function() {
            $http.post('/translation/' + sc.item.id, {
                'new_langid': sc.lang_id,
                'new_title': sc.item.title,
                'old_title': sc.old_title
            }).success(function (data, status, headers, config) {
                if (sc.item.title === sc.old_title)
                    sc.getTranslations();
                else
                    location.replace('/manage/' + sc.item.title);

            }).error(function (data, status, headers, config) {
                $window.alert(data.error);
            });
        };

        sc.trChanged = function(tr) {
            return tr.title !== tr.old_title || tr.lang_id !== tr.old_langid;
        };

        sc.updateTranslation = function(tr) {
            $http.post('/translation/' + tr.id, {
                'new_langid': tr.lang_id,
                'new_title': tr.title,
                'old_title': tr.old_title
            }).success(function (data, status, headers, config) {
                sc.getTranslations();
            }).error(function (data, status, headers, config) {
                $window.alert(data.error);
            });
        };

        sc.changeOwner = function() {
            sc.ownerUpdating = true;
            $http.put('/changeOwner/' + sc.item.id + '/' + sc.newOwner).success(
                function (data, status, headers, config) {
                     sc.item.owner.name = sc.newOwner;
                }).error(function (data, status, headers, config) {
                    $window.alert(data.error);
                }).finally(function () {
                    sc.ownerUpdating = false;
                });
        };

        sc.renameFolder = function (newName) {
            $http.put('/rename/' + sc.item.id, {
                'new_name': sc.oldFolderName + '/' + newName
            }).success(function (data, status, headers, config) {
                // This is needed to update the breadcrumbs
                location.reload();
                //sc.item.path = sc.oldFolderName + '/' + newName;
                //sc.item.name = newName;
                //sc.oldName = newName;
            }).error(function (data, status, headers, config) {
                $window.alert(data.error);
            });
        };

        sc.moveFolder = function (newLocation) {
            $http.put('/rename/' + sc.item.id, {
                'new_name': newLocation + '/' + sc.oldName
            }).success(function (data, status, headers, config) {
                // This is needed to update the breadcrumbs
                location.reload();
                //sc.item.path = newLocation + '/' + sc.oldName;
                //sc.item.location = newLocation;
                //sc.oldFolderName = newLocation;
            }).error(function (data, status, headers, config) {
                $window.alert(data.error);
            });
        };

        sc.combine = function(folder, name) {
            return (folder + '/' + name).replace(/(^\/+)|(\/+$)/, '');
        };

        sc.aliasPublicClicked = function(alias) {
            alias.public = !alias.public;
            alias.publicChanged = !alias.publicChanged;
        };

        sc.aliasChanged = function(alias) {
            return alias.publicChanged || alias.path !== sc.combine(alias.location, alias.name);
        };

        sc.addAlias = function(newAlias) {
            $http.put('/alias/' + sc.item.id + '/' + $window.encodeURIComponent(sc.combine(newAlias.location, newAlias.name)), {
                'public': Boolean(newAlias.public)
            }).success(function (data, status, headers, config) {
                sc.getAliases();
            }).error(function (data, status, headers, config) {
                $window.alert(data.error);
            });

            sc.newAlias = {location: sc.oldFolderName};
        };

        sc.removeAlias = function(alias) {
            $http.delete('/alias/' + sc.item.id + '/' + $window.encodeURIComponent(alias.path), {
            }).success(function (data, status, headers, config) {
                sc.getAliases();
            }).error(function (data, status, headers, config) {
                $window.alert(data.error);
            });
        };

        sc.updateAlias = function(alias, first) {
            var new_alias = sc.combine(alias.location, alias.name);
            $http.post('/alias/' + sc.item.id + '/' + $window.encodeURIComponent(alias.path), {
                'public': Boolean(alias.public),
                'new_name': new_alias
            }).success(function (data, status, headers, config) {

                if (!first || new_alias === alias.path)
                    sc.getAliases();
                else
                    location.replace('/manage/' + new_alias);

            }).error(function (data, status, headers, config) {
                $window.alert(data.error);
            });
        };

        sc.deleteDocument = function (docId) {
            if ($window.confirm('Are you sure you want to delete this document?')) {
                $http.delete('/documents/' + docId)
                    .success(function (data, status, headers, config) {
                        location.replace('/view/');
                    }).error(function (data, status, headers, config) {
                        $window.alert(data.error);
                    });
            }
        };

        sc.deleteFolder = function (folderId) {
            if ($window.confirm('Are you sure you want to delete this folder?')) {
                $http.delete('/folders/' + folderId)
                    .success(function (data, status, headers, config) {
                        location.replace('/view/');
                    }).error(function (data, status, headers, config) {
                        $window.alert(data.error);
                    });
            }
        };

        sc.updateDocument = function (file) {
            sc.file = file;
            sc.fileUploadError = null;
            if (file) {
                sc.file.progress = 0;
                file.upload = Upload.upload({
                    url: '/update/' + sc.item.id,
                    data: {
                        file: file,
                        original: sc.item.fulltext,
                        version: sc.item.versions[0]
                    }
                });

                file.upload.then(function (response) {
                    $timeout(function () {
                        sc.file.result = response.data;
                        sc.item.versions = response.data.versions;
                        sc.item.fulltext = response.data.fulltext;
                        sc.fulltext = response.data.fulltext;
                    });
                }, function (response) {
                    if (response.status > 0)
                        sc.fileUploadError = 'Error: ' + response.data.error;
                }, function (evt) {
                    sc.file.progress = Math.min(100, parseInt(100.0 *
                        evt.loaded / evt.total));
                });

                file.upload.finally(function () {
                });
            }
        };

        sc.convertDocument = function (doc) {
            var text = sc.tracWikiText;
            var wikiSource = sc.wikiRoot.replace("wiki","browser");
            //var text = sc.fulltext;
            text = text.replace(/\[\[PageOutline\]\].*\n/g,"");  // remove contents
            text = text.replace(/ !([a-zA-Z])/g," $1");                   // remove cat !IsBig
            text = text.replace(/\r\n/g,"\n");                   // change windows nl's
            text = text.replace(/{{{(.*?)}}}/g, "`$1`");         // change verbatim 
            // text = text.replace(/{{{\n(.*?)\n}}}/, "```\n$1\n```"); // change code blocks
            text = text.replace(/\n{{{#!comment\n((.|\s|\S)*?)\n}}}\n/g, "\n#- {.comment}\n$1\n#-\n"); // comments
            text = text.replace(/\n{{{\n/g, "\n#-\n```\n"); // change code blocks
            text = text.replace(/\n}}}\n/g, "\n```\n"); // change code blocks
            text = text.replace(/\n====\s+(.*?)\s+====.*\n/g, '\n#-\n#### $1\n'); // headings
            text = text.replace(/\n===\s+(.*?)\s+===.*\n/g, '\n#-\n### $1\n');
            text = text.replace(/\n==\s+(.*?)\s+==.*\n/g, '\n#-\n## $1\n');
            text = text.replace(/\n=\s+(.*?)\s+=.*\n/g, '\n#-\n# $1\n');
            // text = text.replace(/^ \d+. ', r'1.'); 
            var lines = text.split("\n");
            for (var i=0; i<lines.length; i++) {
                var line = lines[i];
                if ( true || line.lastIndexOf('    ',0) !== 0 ) {
                    line = line.replace(/\[((https?|mms):\/\/[^\s\[\]]+)\s+([^\[\]]+)\]/g, '[$3]($1)'); // ordinary links
                    line = line.replace(/\[((https?|mms):\/\/[^\s\[\]]+)\s+(\[.*?\])\]/g, '[$3]($1)');   // links like [url [text]]
                    line = line.replace(/\[wiki:([^\s\[\]]+)\]/g, '[$1]('+(sc.wikiRoot || "")+'$1)'); // [wiki:local] -> [local](URL)
                    line = line.replace(/\[wiki:([^\s\[\]]+)\s+([^\[\]]+)\]/g, '[$2]('+(sc.wikiRoot || "")+'$1)'); // [wiki:local text] -> [text](URL)
                    line = line.replace(/\[source:([^\s\[\]]+)\s+([^\[\]]+)\]/g, '[$2]('+(wikiSource || "")+'$1)');
                    line = line.replace(/\!(([A-Z][a-z0-9]+){2,})/, '$1');
                    line = line.replace(/\'\'\'(.*?)\'\'\'/, '**$1**');  // bold
                    line = line.replace(/\'\'(.*?)\'\'/, '*$1*');   // italics
                }
                lines[i] = line;
            }
            text = lines.join("\n");

/*            

text = re.sub(r'(?m)^====\s+(.*?)\s+====.*$', r'#-\n#### \1', text)
text = re.sub(r'(?m)^===\s+(.*?)\s+===.*$', r'#-\n### \1', text)
text = re.sub(r'(?m)^==\s+(.*?)\s+==.*$', r'#-\n## \1', text)
text = re.sub(r'(?m)^=\s+(.*?)\s+=.*$', r'#-\n# \1', text)
#text = re.sub(r'^       * ', r'****', text)
#text = re.sub(r'^     * ', r'***', text)
#text = re.sub(r'^   * ', r'**', text)
#text = re.sub(r'^ * ', r'*', text)
text = re.sub(r'^ \d+. ', r'1.', text)

a = []
for line in text.split('\n'):
    if True or not line.startswith('    '):
        line = re.sub(r'\[(https?://[^\s\[\]]+)\s([^\[\]]+)\]', r'[\2](\1)', line)
        line = re.sub(r'\[(wiki:[^\s\[\]]+)\s([^\[\]]+)\]', r'[\2](/\1/)', line)
        line = re.sub(r'\!(([A-Z][a-z0-9]+){2,})', r'\1', line)
        line = re.sub(r'\'\'\'(.*?)\'\'\'', r'*\1*', line)
        line = re.sub(r'\'\'(.*?)\'\'', r'_\1_', line)
        line = re.sub(r'\(/wiki:', r'(https://trac.cc.jyu.fi/projects/ohj2/wiki/', line)
    a.append(line)
text = '\n'.join(a)
*/
            //sc.tracWikiText = text;
            sc.fulltext = text;
        };

        sc.cancelPluginRenameClicked = function () {
            $('#pluginRenameForm').remove();
            sc.renameFormShowing = false;
        };

        sc.renameTaskNamesClicked = function (duplicates, renameDuplicates) {
            // A list of duplicate task names and possible new names
            if (typeof renameDuplicates === 'undefined' || renameDuplicates === false) {
                $('#pluginRenameForm').remove();
                sc.renameFormShowing = false;
                //$element.find("#pluginRenameForm").get(0).remove();
                return;
            }
            var duplicateData = [];
            var duplicate;
            // use given names from the input fields
            for(var i = 0; i < duplicates.length; i++) {
                duplicate = [];
                duplicate.push(duplicates[i][0]);
                duplicate.push($('#'+duplicates[i][1]).prop('value'));
                duplicate.push(duplicates[i][1]);
                duplicateData.push(duplicate);
            }
            $http.post('/postNewTaskNames/', angular.extend({
                duplicates: duplicateData,
                renameDuplicates: renameDuplicates,
                manageView: true,
                docId: sc.item.id
            })).success(function (data, status, headers, config) {
                sc.renameFormShowing = false;
                sc.fulltext = data.fulltext;
                sc.item.fulltext = sc.fulltext;
                sc.item.versions = data.versions;
                $("#pluginRenameForm").remove();
                if(data.duplicates.length > 0) {
                    sc.createPluginRenameForm(data);
                }
            }).error(function (data, status, headers, config) {
                $window.alert("Failed to save: " + data.error);
            });
        };


        sc.createPluginRenameForm = function (data) {
            sc.renameFormShowing = true;
            sc.duplicates = data.duplicates;
            sc.data = data;
            var $editorTop = $('#documentEditorDiv');
            //var coords = {left: $editorTop.position().left, top: $editorTop.position().top};
            var $actionDiv = $("<div>", {class: "pluginRenameForm", id: "pluginRenameForm"});
            $actionDiv.css("position", "relative");
            var $innerTextDiv = $("<div>", {class: "pluginRenameInner"});
            $innerTextDiv.append($("<strong>", {
                text: 'Warning!'
            }));
            $innerTextDiv.append($("<p>", {
                text: 'There are multiple objects with the same task name in this document.'
            }));
            $innerTextDiv.append($("<p>", {
                text: 'Plugins with duplicate task names might not work properly.'
            }));
            $innerTextDiv.append($("<p>", {
                text: 'Rename the duplicates by writing new names in the field(s) below and click "Save",'
            }));
            $innerTextDiv.append($("<p>", {
                text: 'choose "Rename automatically" or "Ignore" to proceed without renaming.'
            }));
            $innerTextDiv.append($("<strong>", {
                text: 'Rename duplicates:'
            }));
            $actionDiv.append($innerTextDiv);
            var $form = $("<form>", {class: "pluginRenameInner"});
            sc.inputs = [];
            var input;
            var span;
            for(var i = 0; i < data.duplicates.length; i++) {
                span = $("<span>");
                span.css('display', 'block');
                var $warningSpan = $("<span>", {
                    class: "pluginRenameExclamation",
                    text: "!",
                    title: "There are answers related to this task. Those answers might be lost upon renaming this task."
                });
                if (data.duplicates[i][2] !== 'hasAnswers') {
                    $warningSpan.css('visibility', 'hidden');
                }
                span.append($warningSpan);
                span.append($("<label>", {
                    class: "pluginRenameObject",
                    text: data.duplicates[i][0],
                    for: "newName" + i
                }));
                input = $("<input>", {
                    class: "pluginRenameObject",
                    type: "text",
                    id: data.duplicates[i][1]
                });
                sc.inputs.push(input);
                span.append(input);
                $form.append(span);
            }
            var $buttonDiv = $("<div>", {class: "pluginRenameInner"});
            $buttonDiv.append($("<button>", {
                class: 'timButton, pluginRenameObject',
                text: "Save",
                title: "Rename task names with given names",
                'ng-click': "renameTaskNamesClicked(duplicates, true)"
            }));
            $buttonDiv.append($("<button>", {
                class: 'timButton, pluginRenameObject',
                text: "Rename Automatically",
                title: "Rename duplicate task names automatically",
                'ng-click': "renameTaskNamesClicked(duplicates, true)"
            }));
            $buttonDiv.append($("<button>", {
                class: 'timButton, pluginRenameObject',
                text: "Ignore",
                title: "Proceed without renaming",
                'ng-click': "renameTaskNamesClicked(undefined, false)"
            }));
            $buttonDiv.append($("<button>", {
                class: 'timButton, pluginRenameObject',
                text: "Cancel",
                title: "Return to editing document",
                'ng-click': "cancelPluginRenameClicked()"
            }));
            $actionDiv.append($form);
            $actionDiv.append($buttonDiv);
            $actionDiv = $compile($actionDiv)(sc);
            $editorTop.parent().prepend($actionDiv);
        };

        
        sc.saveDocument = function () {
            sc.saving = true;
            $http.post('/update/' + sc.item.id,
                {
                    'fulltext': sc.fulltext,
                    'original': sc.item.fulltext,
                    'version': sc.item.versions[0]
                }).success(
                function (data, status, headers, config) {
                    if(data.duplicates.length > 0) {
                        sc.createPluginRenameForm(data);
                    }
                    sc.fulltext = data.fulltext;
                    sc.item.fulltext = sc.fulltext;
                    sc.item.versions = data.versions;
                    sc.saving = false;
                }).error(function (data, status, headers, config) {
                    sc.saving = false;
                    if ('is_warning' in data && data.is_warning) {
                        if ( $window.confirm(data.error + "\n\nDo you still wish to save the document?") ) {
                            sc.saveDocumentWithWarnings();
                        }
                    }
                    else {
                        $window.alert(data.error);
                    }
                });
        };

        sc.saveDocumentWithWarnings = function () {
            sc.saving = true;
            $http.post('/update/' + sc.item.id,
                {
                    'fulltext': sc.fulltext,
                    'original': sc.item.fulltext,
                    'ignore_warnings': true,
                    'version': sc.item.versions[0]
                }).success(
                function (data, status, headers, config) {
                    sc.fulltext = data.fulltext;
                    sc.item.fulltext = sc.fulltext;
                    sc.item.versions = data.versions;
                }).error(function (data, status, headers, config) {
                    $window.alert(data.error);
                }).finally(function () {
                    sc.saving = false;
                });
        };

        sc.markAllAsRead = function() {
            sc.readUpdating = true;
            $http.put('/read/' + sc.item.id, {})
                .success(function (data, status, headers, config) {

                }).error(function (data, status, headers, config) {
                    $window.alert('Could not mark the document as read.');
                }).finally(function (data, status, headers, config) {
                    sc.readUpdating = false;
                });
        };

        sc.toggleDiv = function(divName) {
            if (sc.showCreateDiv === divName)
                sc.showCreateDiv = "";
            else
                sc.showCreateDiv = divName;
        };

        sc.createTranslation = function() {
            $http.post('/translate/' + sc.item.id + "/" + sc.translationName, {
                'doc_title': sc.translationTitle
            }).success(function (data, status, headers, config) {
                location.href = "/view/" + data.name;
            }).error(function (data, status, headers, config) {
                $window.alert('Could not create a translation. Error message is: ' + data.error);
            });
        };

        sc.createCitation = function() {
            $http.get('/cite/' + sc.item.id + "/" + sc.citationName)
                .success(function (data, status, headers, config) {
                    location.assign("/view/" + data.name);
                }).error(function (data, status, headers, config) {
                    $window.alert('Could not create a translation. Error message is: ' + data.error);
                }).finally(function (data, status, headers, config) {
                });
        };

        sc.createCopy = function() {
            var docPath = "";
            if (sc.documentPath === "")
            {
                docPath = sc.documentName;
            }
            else
            {
                docPath = sc.documentPath + "/" + sc.documentName;
            }
            $http.post('/createItem', {
                'item_path': docPath,
                'item_type': 'document'
            }).success(function (data, status, headers, config) {
                var forwardName = data.name;
                $http.post('/update/' + data.id, {
                    'template_name': $window.item.path
                }).success(function (data, status, headers, config) {
                    location.href = "/view/" + forwardName;
                }).error(function (data, status, headers, config) {
                    $window.alert(data);
                });
            }).error(function (data, status, headers, config) {
                $window.alert('Could not create a copy. Error message is: ' + data);
            });
        };

        sc.getNotifySettings = function() {
            sc.emailDocModify = false;
            sc.emailCommentAdd = false;
            sc.emailCommentModify = false;

            $http.get('/notify/' + sc.item.id)
                .success(function (data, status, headers, config) {
                    sc.emailDocModify = data.email_doc_modify;
                    sc.emailCommentAdd = data.email_comment_add;
                    sc.emailCommentModify = data.email_comment_modify;
                }).error(function (data, status, headers, config) {
                    $window.alert('Could not get notification settings. Error message is: ' + data.error);
                }).finally(function (data, status, headers, config) {
                });
        };

        sc.notifyChanged = function() {
            $http.post('/notify/' + sc.item.id, {
                'email_doc_modify': sc.emailDocModify,
                'email_comment_add': sc.emailCommentAdd,
                'email_comment_modify': sc.emailCommentModify
            }).success(function (data, status, headers, config) {
            }).error(function (data, status, headers, config) {
                $window.alert('Could not change notification settings. Error message is: ' + data.error);
            });
        };

        sc.accessTypes = $window.accessTypes;
        sc.item = $window.item;
        sc.hasMoreChangelog = true;

        var docPath = sc.item.path.split("/");
        docPath.pop();
        sc.documentPath = docPath.join("/");
        sc.documentName = sc.item.name;

        //sc.newName = sc.getJustDocName(doc.name);
        sc.newFolderName = sc.getFolderName(sc.item.path);
        //sc.oldName = sc.newName;
        //sc.oldFolderName = sc.newFolderName;
        sc.newAlias = {location: sc.newFolderName};
        sc.newOwner = sc.item.owner.name;
        sc.showCreateDiv = "";
        sc.getNotifySettings();

        if (sc.item.isFolder) {
            sc.newName = sc.item.name;
            sc.newFolderName = sc.item.location;
            sc.oldName = sc.newName;
            sc.oldFolderName = sc.newFolderName;
        } else {
            sc.item.fulltext = sc.item.fulltext.trim();
            sc.fulltext = sc.item.fulltext;
            sc.aliases = sc.getAliases();
            sc.translations = sc.getTranslations();
        }
    }]);
