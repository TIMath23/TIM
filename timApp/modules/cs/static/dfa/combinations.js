/*!
 * Class for all combinations for selected chars
 */
class Combinations {

    /*!
     * Initilaize combinations
     * \fn constructor(chars, n, full)
     * \params string or array chars of elements to combinate
     * \params int n number of max items
     * \params boolean full if true make all lengths from 1 to
     *                      if false make jus all combinations
     *                      of n lenght array of chars
     */
    constructor(chars, n, full) {
        this.chars = chars;
        this.n = n;
        this.full = full;
        this.state = undefined;
        this.end = false;
    }

    /*
    setCharAt(str, index, chr) {
        if (index > str.length - 1) return str;
        return str.substring(0, index) + chr + str.substring(index + 1);
    }
    */

    /*!
     * return next combination array or "" if no next exists
     */
    next() {
        let chars = this.chars;
        let combi = this;

        function first(n) {
            let c = combi.chars[0];
            let s = [];
            for (let i = 0; i < n; i++) {
                s.push(c);
            }
            combi.state = s;
            combi.end = false;
            return s;
        }

        function nextN() {
            let s = combi.state;
            let si = s.length - 1;
            while (si >= 0) {
                let c = s[si];
                let ci = chars.indexOf(c);
                if (ci < 0) return ""; // something wrong
                if (ci < chars.length - 1) {
                    c = chars[ci + 1];
                    // s = setCharAt(s, si, c);
                    s[si] = c;
                    combi.state = s;
                    return s;
                }
                // s = setCharAt(s, si, chars[0]);
                s[si] = chars[0];
                si--;
            }
            combi.end = true;
            combi.state = undefined;
            return "";
        }

        function nextFull() {
            let s = combi.state;
            let len = s.length;
            s = nextN(s);
            if (s) return s;
            len++;
            if (len > combi.n) return "";
            return first(len);
        }

        if ( this.end ) return "";

        if (!this.state) {
            if (this.full) return first(1);
            return first(this.n);
        }
        if (this.full) return nextFull();
        return nextN()
    }
}
