import {timApp} from "tim/app";
import * as answerSheet from "tim/directives/dynamicAnswerSheet";
import {markAsUsed} from "tim/angular-utils";

markAsUsed(answerSheet);

/**
 * FILL WITH SUITABLE TEXT
 * @module questionPreviewController
 * @author Matias Berg
 * @author Bek Eljurkaev
 * @author Minna Lehtomäki
 * @author Juhani Sihvonen
 * @author Hannu Viinikainen
 * @licence MIT
 * @copyright 2015 Timppa project authors
 */

timApp.controller('QuestionPreviewController', ['$scope', '$window', '$http', '$rootScope', 'ParCompiler', '$log',
    function ($scope, $window, http, $rootScope, ParCompiler, $log) {
        //TODO parse json and set values from rows and columns to scope variables
        //TODO edit questionPreview.html to repeat rows and columns
        "use strict";

        $scope.questionHeaders = [];
        $scope.answerTypes = [];
        $scope.dynamicAnswerSheetControl = {};
        $scope.isLecturer = false;
        $scope.questionTitle = "";

        $scope.$on("setPreviewJson", function (event, args) {
            $scope.questionId = args.questionId;
            $scope.questionParId = args.questionParId;
            $scope.questionParIdNext = args.questionParIdNext;
            $scope.isLecturer = args.isLecturer;
            $scope.markup = args.markup;
            $scope.questionTitle = args.markup.json.questionTitle;
            $scope.dynamicAnswerSheetControl.createAnswer($scope);
            // Tähän Texittää scope
            // ParCompiler.processAllMath($scope.htmlSheet);

        });

        /**
         * FILL WITH SUITABLE TEXT
         * @memberof module:questionPreviewController
         */
        /*
        $scope.editQuestion = function () {
            $scope.close();
            $rootScope.$broadcast("editQuestion", {
                "question_id": $scope.questionId,
                "par_id": $scope.questionParId,
                "par_id_next": $scope.questionParIdNext,
                "markup": $scope.markup,
            });
        };
        */

    $scope.editQuestion = function () {
        $scope.close();
        var parId = $scope.questionParId;
        var parNextId = $scope.questionParIdNext;
        var docId = $scope.docId;
        // $rootScope.$broadcast('toggleQuestion');
        http({
            url: '/getQuestionByParId',
            method: 'GET',
            params: {'par_id': parId, 'doc_id': docId, 'edit': true}
        })
            .success(function (data) {
                if ( !data.markup ) return; // not a question
                $scope.json = data.markup.json;  // TODO: näistä pitäisi päästä eroon, kaikki markupin kautta!
                $scope.markup = data.markup;
                // data.markup.qst = true;
                $rootScope.$broadcast('changeQuestionTitle', {'questionTitle': $scope.json.questionTitle});
                $rootScope.$broadcast('editQuestion', {
                    'par_id': parId,
                    'par_id_next': parNextId,
                    'markup': data.markup
                });

            })

            .error(function () {
                $log.error("Could not get question.");
            });

        // $scope.par = $par;
    };


        /**
         * FILL WITH SUITABLE TEXT
         * @memberof module:questionPreviewController
         */
        $scope.ask = function () {
            $scope.$emit('askQuestion', {
                "lecture_id": $scope.lectureId,
                "question_id": $scope.questionId,
                "par_id": $scope.questionParId,
                "doc_id": $scope.docId,
                "markup": $scope.markup
            });
            $scope.close();
        };

        /**
         * FILL WITH SUITABLE TEXT
         * @memberof module:questionPreviewController
         */
        $scope.close = function () {
            $scope.dynamicAnswerSheetControl.closePreview();
            $scope.$emit('closeQuestionPreview');
        };



        /**
         * FILL WITH SUITABLE TEXT
         * @memberof module:questionPreviewController
         */
        $scope.deleteQuestion = function () {
            var confirmDi = $window.confirm("Are you sure you want to delete this question?");
            if (confirmDi) {
                http.post('/deleteParagraph/' + $scope.docId, {par: $scope.questionParId})
                    .success(function (data) {
                        $scope.handleDelete(data, {par: $scope.questionParId, area_start: null, area_end: null});
                        $scope.$emit('closeQuestionPreview');
                        $window.console.log("Deleted question");
                    })
                    .error(function (error) {
                        $scope.$emit('closeQuestionPreview');
                        $window.console.log(error);
                    });

            }
        };
    }
]);