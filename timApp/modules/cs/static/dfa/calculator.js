function roundToNearest(num, decimals) {
  decimals = decimals || 0;
  var p = Math.pow(10, decimals);
  var n = (num * p) * (1 + Number.EPSILON);
  return Math.round(n) / p;
}

class CalculatorOp {
    constructor(calculator) {
        this.calculator = calculator;
    }

    op() {
        return "";
    }

    name() {
        return this.op(); // needed if name is different than op
    }

    doCalc() {
        return undefined;
    }

    r(v) {
        return roundToNearest(v, this.calculator.params.decimals);
    }

    getnum(s) {
        if (s === undefined) return this.calculator.lastResult;
        s = (""+s).trim();
        if (s === "") return this.calculator.lastResult;
        if (s.toUpperCase().startsWith("E")) s = "1"+s;
        if (s === "pi" || s === "π") return Math.PI;
        if (s.startsWith("r")) {
            if (s==="r") return this.calculator.lastResult;
            let idx = parseInt(s.substring(1));
            idx = Math.max(0, Math.min(idx, this.calculator.results.length-1));
            return this.calculator.results[idx];
        }
        if (s.startsWith("p")) {
            if (s==="p") return this.calculator.lastResult;
            let idx = this.calculator.results.length - parseInt(s.substring(1)) -1;
            idx = Math.max(0, Math.min(idx, this.calculator.results.length-1));
            return this.calculator.results[idx];
        }
        return parseFloat(s.replace(",", "."));
    }

}

// See https://regex101.com/r/e5iqja/latest
const num = "((?:(?:[-+][0-9]+)|(?:[0-9]*))(?:[.,][0-9]*)?(?:[eE]-?[0-9]+)?|-?pi|-?π|r[0-9]*|p[0-9]*)";

class Command extends  CalculatorOp {
    calc(s) {
        let re = new RegExp("^ *("+this.op()+")?$", "i")
        let r = re.exec(s);
        if (!r) return undefined;
        let o = r[1];
        let res = this.doCalc();
        return {res: res, calc: `${o}`};
    }
}

class FuncRROperation extends  CalculatorOp {
    doCalc(a) {
        return 0;
    }

    calc(s) {
        let re = new RegExp("^ *("+this.op()+") *\\(? *" + num + "?\\)?$", "i")
        let r = re.exec(s);
        if (!r) return undefined;
        let o = r[1];
        let a = this.getnum(r[2]);
        let res = this.r(this.doCalc(a));
        return {res: res, calc: `${o} ${a} = ${res}`};
    }
}

class BinOperation extends  CalculatorOp {
    doCalc(a,b) {

    }

    calc(s) {
        let re = new RegExp("^ *" + num + "? *("+this.op()+") *" + num + "$", "i")
        let r = re.exec(s);
        if (!r) return undefined;
        let a = this.getnum(r[1]);
        let o = r[2];
        let b = this.getnum(r[3]);
        if (a==="" || a === undefined) a = this.calculator.lastResult;
        let res = this.r(this.doCalc(a,b));
        return {res: res, calc: `${a} ${o} ${b} = ${res}`};
    }
}

class Deg extends Command {
    op() { return "deg"; }
    doCalc() {
        this.calculator.deg = true;
        return undefined;
    }
}


class Rad extends Command {
    op() { return "rad"; }
    doCalc() {
        this.calculator.deg = false;
        return undefined;
    }
}


class Plus extends BinOperation {
    op() { return "\\+"; }
    name() { return "+"; }
    doCalc(a, b) { return a + b; }
}

class Minus extends BinOperation {
    op() { return "-"; }
    doCalc(a, b) { return a - b; }
}

class Mul extends BinOperation {
    op() { return "\\*"; }
    name() { return "*"; }
    doCalc(a, b) { return a * b; }
}

class Div extends BinOperation {
    op() { return "/"; }
    doCalc(a, b) { return a / b; }
}

class Sin extends FuncRROperation {
    op() { return "sin"; }
    doCalc(a) { return Math.sin(this.calculator.toAngle(a)); }
}

class Cos extends FuncRROperation {
    op() { return "cos"; }
    doCalc(a) { return Math.cos(this.calculator.toAngle(a)); }
}

class Sqrt extends FuncRROperation {
    op() { return "sqrt"; }
    doCalc(a) { return Math.sqrt(a); }
}

const operations = [
  Plus,
  Minus,
  Mul,
  Div,
  Sin,
  Cos,
  Sqrt,
  Deg,
  Rad,
];


class Calculator {
    isIn(reglist, cmd, def, err) {
        let name = cmd.name();
        if (!reglist || reglist.length === 0) return def;
        for (let rs of reglist) {
            if (rs === "+" || rs === "*") rs = "\\" + rs;
            const re = new RegExp("^" + rs + "$");
            if (re.test(name)) {
                return true;
            }
        }
        return false;
    }

    constructor(params) {
        this.params = params || {};
        this.params.decimals = this.params.decimals || 13;
        this.deg = this.params.deg || true;
        this.lastResult = 0;
        this.results = [];
        this.operations = [];
        for (const op of operations) {
            const oper = new op(this);
            if (!this.isIn(this.params.allowed, oper, true, "not in allowed commands")) {
                continue;
            }
            if (this.isIn(this.params.illegals, oper, false, "in illegal commands")) {
                continue;
            }
            this.operations.push(oper);
        }
    }

    toAngle(a) {
        if (!this.deg) return a;
        return a*Math.PI/180;
    }

    calcOne(s) {
        for (const op of this.operations) {
            let r = op.calc(s);
            if (r) {
                if (r.res !== undefined) this.lastResult = r.res;
                return r;
            }
        }
        return {res: "Error!", calc: "Error: " + s};
    }

    calc(s) {
        let result = [];
        let lines = s.split("\n");
        this.results = [];
        let i = 0;
        for (const line of lines) {
            // remove comments # and trim
            i++;
            this.results[i] = this.lastResult;
            let tline = line.replace(/ *#.*/, "").trim();
            if (!tline) continue;
            let r = this.calcOne(tline);
            r.calc = `r${i}: ${r.calc}`;
            result.push(r);
            this.results[i] = r.res;
            this.results[0] = this.lastResult;
        }
        return result;
    }
}

