import $ from "jquery";
import {timApp} from "tim/app";
import * as userService from "tim/services/userService";
import {markAsUsed} from "tim/utils";
import {Users} from "../services/userService";
import {$http, $log, $window} from "../ngimport";

markAsUsed(userService);

/**
 * FILL WITH SUITABLE TEXT
 * @module sidebarMenuCtrl
 * @author Matias Berg
 * @author Bek Eljurkaev
 * @author Minna Lehtomäki
 * @author Juhani Sihvonen
 * @author Hannu Viinikainen
 * @licence MIT
 * @copyright 2015 Timppa project authors
 */

timApp.controller("SidebarMenuCtrl", ['$scope', '$uibModal',

    function ($scope, $uibModal) {
        "use strict";
        $scope.currentLecturesList = [];
        $scope.futureLecturesList = [];
        $scope.pastLecturesList = [];
        $scope.lectureQuestions = [];
        $scope.materialQuestions = [];
        $scope.users = Users;
        $scope.bookmarks = $window.bookmarks; // from base.html
        $scope.leftSide = $(".left-fixed-side");

        $scope.active = -1;
        if ($window.showIndex) {
            $scope.active = 0;
        } else if (Users.isLoggedIn()) {
            // make bookmarks tab active
            $scope.active = 6;
        }
        $scope.lastTab = $scope.active;

        $scope.updateLeftSide = function() {
            if ($("#menuTabs").is(":visible")) {
                $scope.leftSide.css("min-width", "12em");
            } else {
                $scope.leftSide.css("min-width", "0");
            }
        };

        $scope.updateLeftSide();
        $($window).resize($scope.updateLeftSide);

        $scope.bookmarkTabSelected = function(isSelected) {
            const tabContent = $("#menuTabs").find(".tab-content");
            if (isSelected) {
                // The dropdown menu is clipped if it's near right side of the menu without applying this hack
                // Also the dropdown menu causes vertical scrollbar to appear without specifying height
                tabContent.css("height", "calc(100vh - 51.2833px)");
                tabContent.css("overflow-x", "visible");
                tabContent.css("overflow-y", "visible");
            } else {
                tabContent.css("height", "auto");
                tabContent.css("overflow-x", "hidden");
                tabContent.css("overflow-y", "auto");
            }
        };

        /**
         * FILL WITH SUITABLE TEXT
         * @memberof module:sidebarMenuCtrl
         */
        $scope.showSidebar = function() {
            const tabs = $("#menuTabs");
            if (tabs.is(":visible")) {
                if ($scope.active !== null) {
                    $scope.lastTab = $scope.active;
                    $scope.active = -1; // this will set the value to null and remove the "selected" state from tab
                    if ($(".device-xs").is(":visible") || $(".device-sm").is(":visible")) {
                        tabs.hide();
                        $scope.leftSide.css("min-width", "0");
                    }
                } else {
                    $scope.active = $scope.lastTab;
                }
            } else {
                tabs.show();
                $scope.leftSide.css("min-width", "12em");
                tabs.attr("class", "");
                if ($scope.active === null) {
                    $scope.active = $scope.lastTab || 0;
                }
            }
        };

        /**
         * FILL WITH SUITABLE TEXT
         * @memberof module:sidebarMenuCtrl
         */
        $scope.toggleLectures = function() {
            $http<{currentLectures, futureLectures, pastLectures}>({
                url: "/getAllLecturesFromDocument",
                method: "GET",
                params: {doc_id: $scope.docId},
            })
                .then(function(response) {
                    const lectures = response.data;
                    $scope.currentLecturesList = lectures.currentLectures;
                    $scope.futureLecturesList = lectures.futureLectures;
                    $scope.pastLecturesList = lectures.pastLectures;
                }, function() {
                    $log.error("Couldn't fetch the lectures");
                });
        };

        /**
         * FILL WITH SUITABLE TEXT
         * @memberof module:sidebarMenuCtrl
         */
        $scope.toggleQuestions = function() {
            // Does not work anymore after changing questions part of document
            $scope.lectureQuestions = [];
            $http<Array<{question_id, questionjson}>>({
                url: "/questions/" + $scope.docId,
                method: "GET",
            })
                .then(function(response) {
                    const questions = response.data;
                    for (let i = 0; i < questions.length; i++) {
                        const question = {
                            questionId: questions[i].question_id,
                            questionTitle: (JSON.parse(questions[i].questionjson)).questionTitle,
                        };
                        $scope.lectureQuestions.push(question);
                    }
                }, function() {
                    $log.error("Couldn't fetch the questions");
                });
        };


        /**
         *
         * @param settings_data : print settings
         */
        $scope.printDocument = function (settings_data) {
            var api_address_for_templates = '/print/templates/' + $window.item.path;
            $http.get(api_address_for_templates)
                .then(function success(templates) {
                    // console.log(JSON.stringify(templatesJSON.data));
                    $uibModal.open({
                        templateUrl: '/static/templates/printDialog.html',
                        controller: 'PrintCtrl',
                        size: 'md',
                        resolve: {
                            document: function () {
                                return $window.item;
                            },
                            templates: function () {
                                return templates.data;
                            }
                        }
                    })
                }, function error(response) {
                    console.log(response.toString());
                });
        };

        /**
         *  Gets print settings
         *
        $scope.printDocument = function () {
            var api_address_for_templates = '/print/getTemplatesJSON/' + $window.item.path;
            $http.get(api_address_for_templates)
                .then(function (data) {
                    console.log(data.data);
                    $scope.openPrintDialog(data.data);
                });
        };*/

        $scope.cssPrint = function () {
            // FOR DEBUGGING 
	    // AutoPageBreak();

            window.print();

	    // FOR DEBUGGING
            // UndoAutoPageBreak();
        };
    }
])
;
