var angular;
var timApp = angular.module('timApp');

timApp.directive('timDraggableFixed', ['$document', '$window', function ($document, $window) {
    return function (scope, element, attr) {

        handle = $("<div>", {class: "draghandle"});
        handle.height(13);
        element.prepend(handle);
        updateHandle(element, handle);

        function updateHandle(e, h) {
            // TODO: find an efficient way to call this whenever
            // position is changed between static and absolute
            position = e.css("position");
            movable = position != 'static' && position != 'fixed';
            h.css("visibility", movable ? "visible" : "hidden");
        }


        function getPageXY(e) {
            if ( !('pageX' in e) || (e.pageX == 0 && e.pageY == 0) ) {
                return {
                    X: e.originalEvent.touches[0].pageX,
                    Y: e.originalEvent.touches[0].pageY
                };
            }

            return {X: e.pageX, Y: e.pageY};
        }

        function getPixels(s) {
            s2 = s.replace(/px$/, '');
            return Number(s2) || 0;
        }

        handle.on('mousedown touchstart', function(e) {
            lastPos = getPageXY(e);

            // Rules for what we should set in CSS
            // to keep the element dimensions (X).
            // Prefer left over right.
            var leftSet  = element.css('left') != 'auto';
            var rightSet = element.css('right') != 'auto';
            setLeft      = (!leftSet & !rightSet) | leftSet;
            setRight     = rightSet;

            // Rules for what we should set in CSS
            // to keep the element dimensions (Y).
            // Prefer top over bottom.
            var topSet = element.css('top') != 'auto';
            var botSet = element.css('bottom') != 'auto';
            setTop     = (!topSet & !botSet) | topSet;
            setBottom  = botSet;

            console.log(element.css('top'));

            prevTop    = getPixels(element.css('top'));
            prevLeft   = getPixels(element.css('left'));
            prevBottom = getPixels(element.css('bottom'));
            prevRight  = getPixels(element.css('right'));

            $document.on('mouseup touchend', release);
            $document.on('mousemove touchmove', move);
        });

        function release(e) {
            $document.off('mouseup touchend', release);
            $document.off('mousemove touchmove', move);
        }

        function move(e) {
            pos = getPageXY(e);
            delta = {X: pos.X - lastPos.X, Y: pos.Y - lastPos.Y};
            console.log(prevTop);

            if ( setTop )
                element.css( 'top', prevTop + delta.Y );
            if ( setLeft )
                element.css( 'left', prevLeft + delta.X );
            if ( setBottom )
                element.css( 'bottom', prevBottom - delta.Y );
            if ( setRight )
                element.css( 'right', prevRight - delta.X );            

            e.preventDefault();
            e.stopPropagation();
        }

        element.context.style.msTouchAction = 'none';
    };
}]);
