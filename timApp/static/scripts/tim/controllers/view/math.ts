
export function defineMath(sc, http, q, $injector, $compile, $window, $document, $rootScope, $localStorage, $filter, $timeout, $log, Users, ParCompiler) {
    "use strict";

    // for compatibility, we make the math processing functions available from scope too
    sc.processAllMathDelayed = ParCompiler.processAllMathDelayed;
    sc.processAllMath = ParCompiler.processAllMath;
    sc.processMath = ParCompiler.processMath;
}
