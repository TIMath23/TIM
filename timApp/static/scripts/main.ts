requirejs.config({
    baseUrl: '/static/scripts/build',
    paths: {
        // TIM modules
        'tim': '.',

        // 3rd party modules
        'ace': '../node_modules/ace/lib/ace',
        'angular': '../node_modules/angular/angular',
        'angular-eonasdan-datetimepicker': '../node_modules/angular-eonasdan-datetimepicker/dist/angular-eonasdan-datetimepicker',
        'angular-messages': '../node_modules/angular-messages/angular-messages',
        'angular-sanitize': '../node_modules/angular-sanitize/angular-sanitize',
        'angular-timer': '../node_modules/angular-timer/dist/angular-timer',
        'angular-ui-bootstrap': '../node_modules/angular-ui-bootstrap/dist/ui-bootstrap-tpls',
        'eonasdan-bootstrap-datetimepicker': '../node_modules/eonasdan-bootstrap-datetimepicker/build/js/bootstrap-datetimepicker.min',
        'head': 'reveal/lib/js/head.min',
        'humanize-duration': '../node_modules/humanize-duration/humanize-duration',
        'jquery': '../node_modules/jquery/dist/jquery',
        'jqueryui': '../node_modules/jquery-ui-dist/jquery-ui',
        'jqueryui-touch-punch': '../node_modules/jquery-ui-touch-punch-c/jquery.ui.touch-punch',
        'katex': '../node_modules/katex/dist/katex.min',
        'katex-auto-render': '../node_modules/katex/dist/contrib/auto-render.min',
        'ng-file-upload': '../node_modules/ng-file-upload/dist/ng-file-upload',
        'ngstorage': '../node_modules/ngstorage/ngstorage',
        'oclazyload': '../node_modules/oclazyload/dist/oclazyload',
        'reveal': 'reveal/js/reveal',
        'ui-grid': '../node_modules/angular-ui-grid/ui-grid',

        // plugin modules
        'cs': '/cs',
        'mcq': '/mcq',
        'mmcq': '/mmcq',
        'static/scripts/imagex': 'imagex',
        'static/scripts/timHelper': 'timHelper',
        'svn': '/svn',
    },
    packages: [{
        name: 'moment',
        location: '../node_modules/moment',
        main: 'moment'
    }],
    shim: {
        // 3rd party modules
        'angular': {exports: 'angular'},
        'angular-eonasdan-datetimepicker': {deps: ['angular', 'eonasdan-bootstrap-datetimepicker']},
        'angular-messages': {deps: ['angular']},
        'angular-sanitize': {deps: ['angular']},
        'angular-timer': {deps: ['angular']},
        'angular-ui-bootstrap': {deps: ['angular']},
        'head': {exports: 'head'},
        'jqueryui': {deps: ['jquery']},
        'katex-auto-render': {deps: ['katex']},
        'ng-file-upload': {deps: ['angular']},
        'oclazyload': {deps: ['angular']},
        'ui-grid': {deps: ['angular']},

        // TIM modules
        'tim/answerbrowser3': {deps: ['tim/app', 'tim/timTiming']},
        'tim/breadcrumbs': {deps: ['tim/app']},
        'tim/controllers/answerToQuestionController': {deps: ['tim/app', 'jquery', 'tim/directives/dynamicAnswerSheet']},
        'tim/createLectureCtrl': {deps: ['tim/app', 'jquery']},
        'tim/controllers/lectureInfoController': {deps: ['tim/app', 'tim/directives/showChartDirective']},
        'tim/controllers/questionController': {deps: ['tim/app', 'jqueryui', 'tim/directives/dynamicAnswerSheet']},
        'tim/controllers/questionPreviewController': {deps: ['tim/app', 'tim/directives/dynamicAnswerSheet']},
        'tim/controllers/reviewController': {deps: ['tim/app', 'jquery']},
        'tim/controllers/showStatisticsToQuestionController': {deps: ['tim/app', 'tim/directives/showChartDirective']},
        'tim/controllers/startController': {deps: ['tim/app']},
        'tim/controllers/view/viewctrl': {
            deps: [
                'ngstorage',
                'tim/app',
                'tim/controllers/view/areas',
                'tim/controllers/view/clipboard',
                'tim/controllers/view/editing',
                'tim/controllers/view/eventhandlers',
                'tim/controllers/view/index',
                'tim/controllers/view/interceptor',
                'tim/controllers/view/math',
                'tim/controllers/view/notes',
                'tim/controllers/view/parhelpers',
                'tim/controllers/view/parmenu',
                'tim/controllers/view/questions',
                'tim/controllers/view/readings',
                'tim/controllers/view/refpopup',
                'tim/directives/popupMenu',
                'tim/services/parCompiler',
            ]
        },
        'tim/controllers/view/areas': {deps: ['jquery', 'tim/app', 'tim/directives/nameArea']},
        'tim/controllers/view/clipboard': {deps: ['tim/app']},
        'tim/controllers/view/editing': {deps: ['tim/app']},
        'tim/controllers/view/eventhandlers': {deps: ['tim/app']},
        'tim/controllers/view/index': {deps: ['tim/app', 'tim/marktree']},
        'tim/controllers/view/interceptor': {deps: ['tim/app', 'tim/timTiming']},
        'tim/controllers/view/math': {deps: ['tim/app']},
        'tim/controllers/view/notes': {deps: ['tim/app']},
        'tim/controllers/view/parhelpers': {deps: ['tim/app']},
        'tim/controllers/view/parmenu': {deps: ['tim/app']},
        'tim/controllers/view/questions': {deps: ['tim/app']},
        'tim/controllers/view/readings': {deps: ['tim/app']},
        'tim/controllers/view/refpopup': {deps: ['tim/app', 'tim/directives/refpopup']},
        'tim/directives/annotation': {deps: ['tim/app']},
        'tim/directives/bookmarks': {deps: ['tim/app', 'tim/directives/focusMe']},
        'tim/directives/bootstrapPanel': {deps: ['tim/app']},
        'tim/directives/createItem': {
            deps: ['tim/app',
                'tim/directives/formErrorMessage',
                'tim/directives/shortNameValidator',
                'tim/services/slugify'
            ]
        },
        'tim/directives/dynamicAnswerSheet': {deps: ['tim/app']},
        'tim/directives/formErrorMessage': {deps: ['tim/app']},
        'tim/directives/focusMe': {deps: ['tim/app']},
        'tim/directives/loginMenu': {deps: ['tim/app']},
        'tim/directives/nameArea': {deps: ['tim/app']},
        'tim/directives/popUpDialog': {deps: ['tim/app']},
        'tim/directives/popupMenu': {deps: ['tim/app']},
        'tim/directives/refpopup': {deps: ['tim/app']},
        'tim/directives/rightsEditor': {deps: ['tim/app']},
        'tim/directives/shortNameValidator': {deps: ['tim/app']},
        'tim/directives/showChartDirective': {deps: ['tim/app']},
        'tim/directives/velpSelection': {
            deps: [
                'jquery',
                'tim/app',
                'tim/directives/velpSummary',
                'tim/directives/velpWindow',
            ]
        },
        'tim/directives/velpSummary': {deps: ['tim/app', 'tim/controllers/reviewController']},
        'tim/directives/velpWindow': {deps: ['tim/app']},
        'tim/draggable': {deps: ['tim/app']},
        'tim/manageView/manageCtrl': {deps: ['tim/app']},
        'tim/marktree': {exports: 'globals'},
        'tim/services/slugify': {deps: ['tim/app']},
        'tim/services/userService': {deps: ['tim/app']},
        'tim/settingsView/settingsCtrl': {deps: ['tim/app']},
        'tim/sidebarMenuCtrl': {deps: ['tim/app', 'tim/services/userService', 'jquery']},
        'tim/smallMenuCtrl': {deps: ['tim/app', 'jquery']},
        'tim/timApp': {deps: ['tim/app']},
        'tim/timTiming': {deps: []},
        'tim/userlistController': {deps: ['tim/app']},

        // plugin modules
        'cs/js/dir': {deps: ['angular']},
        'mcq/script2': {deps: ['angular', 'mcq/SimpleDirective']},
        'mcq/SimpleDirective': {exports: 'globals'},
        'mmcq/script2': {deps: ['angular', 'mmcq/SimpleDirective']},
        'mmcq/SimpleDirective': {exports: 'globals'},
        'svn/video/js/video': {deps: ['angular']},
        'static/scripts/imagex': {deps: ['angular', 'angular-sanitize']},
    }
});

requirejs([
    'angular',
    'tim/answerbrowser3',
    'tim/breadcrumbs',
    'tim/controllers/answerToQuestionController',
    'tim/createLectureCtrl',
    'tim/controllers/lectureInfoController',
    'tim/controllers/questionController',
    'tim/controllers/questionPreviewController',
    'tim/controllers/reviewController',
    'tim/controllers/showStatisticsToQuestionController',
    'tim/controllers/startController',
    'tim/controllers/view/viewctrl',
    'tim/directives/annotation',
    'tim/directives/bookmarks',
    'tim/directives/bootstrapPanel',
    'tim/directives/createItem',
    'tim/directives/loginMenu',
    'tim/directives/popUpDialog',
    'tim/directives/rightsEditor',
    'tim/directives/velpSelection',
    'tim/extramodules',
    'tim/lectureController',
    'tim/loadMap',
    'tim/manageView/manageCtrl',
    'tim/parEditor',
    'tim/settingsView/settingsCtrl',
    'tim/sidebarMenuCtrl',
    'tim/smallMenuCtrl',
    'tim/timApp',
    'tim/userlistController',
], (angular) => {
    angular.bootstrap(document, ['timApp']);
});
