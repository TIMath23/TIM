/* globals angular, $, timLogTime */

var timApp = angular.module('timApp');

timApp.defineIndex = function (sc, http, q, $injector, $compile, $window, $document, $rootScope, $localStorage, $filter, $timeout, $log, Users) {
    "use strict";

    sc.showIndex = $window.showIndex;

    sc.totext = function (str) {
        if (str.indexOf('{') > 0) {
            return str.substring(0, str.indexOf('{')).trim();
        }
        return str;
    };

    sc.tolink = function (str) {
        if (str.indexOf('{') >= 0 && str.indexOf('}') > 0) {
            var ob = str.indexOf('{');
            var cb = str.indexOf('}');
            return str.substring(ob + 1, cb);
        }
        return "#" + str.replace(/^(\d)+(\.\d+)*\.? /, "").trim().replace(/ +/g, '-').toLowerCase();
    };

    sc.findIndexLevel = function (str) {
        for (var i = 0; i < str.length; i++) {
            if (str.charAt(i) !== '#') {
                return i;
            }
        }

        return 0;
    };

    sc.getIndex = function () {
        timLogTime("getindex", "view");
        http.get('/index/' + sc.docId)
            .success(function (data) {
                timLogTime("getindex succ", "view");
                if (data.empty) {
                    sc.showIndex = false;
                } else {
                    var indexElement = $(".index-sidebar .sideBarContainer");
                    $(indexElement).html(data);
                    sc.showIndex = true;
                }
                timLogTime("getindex done", "view");
            }).error(function () {
            $log.error("Could not get index");
        });
    };

    sc.invertState = function (state) {
        if (state === 'exp') {
            return 'col';
        }
        if (state === 'col') {
            return 'exp';
        }
        return state;
    };

    sc.clearSelection = function () {
        if ($document.selection) {
            $document.selection.empty();
        }
        else if ($window.getSelection) {
            $window.getSelection().removeAllRanges();
        }
    };

    sc.invertStateClearSelection = function (event, state) {
        if (event.which !== 1) {
            // Listen only to the left mouse button
            return state;
        }

        var newState = sc.invertState(state);
        if (newState !== state) {
            sc.clearSelection();
        }
        return newState;
    };

    // call marktree.js initialization function so that TOC clicking works
    $window.addEvents();
    $timeout(function () {
        var indexHeadings = $('#menuTabs').find('.subexp .exp');
        var subHeadings = indexHeadings.find('ul.sub li.basic');
        if (indexHeadings.length === 1 || indexHeadings.length + subHeadings.length < 40) {
            indexHeadings.attr('class', 'col');
            indexHeadings.children('.sub').attr('class', 'subexp');
        }
    });
};
