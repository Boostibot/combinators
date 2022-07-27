function importEvaluators(lib)
{
    requireLib(lib, '@base');

    const {
        seq,
        fmt,
        dbg,
        obj,
    } = lib;

    const {
        Sequence,
        SEQUENCE_INF,
        isSequenceFin,
        arraySequence,
        constSequence,
    } = seq;

    const assert = dbg.assert;

    const mtx = importMatrix();

    const FUNCTIONS = {};
    const {
        SEPARATOR,
        NEWLINE,
        OFFSET,
    } = fmt;

    const castLookup = (from, to) => `$$${from}->${to}`;

    const addFunctionPack = (lookup, pack, functions = FUNCTIONS) => {
        if(functions[lookup] === undefined)
            functions[lookup] = [pack];
        else
            functions[lookup].push(pack);
    };

    const addFunction = (lookup, executor, checker, informer, functions = FUNCTIONS) => {
        addFunctionPack(lookup, {executor, checker, informer}, functions);
    };

    const innertExecutor = _ => _;
    const innertChecker = _ => true;
    const innertInformer = _ => "";

    const addDummyCast = (from, to, functions = FUNCTIONS) => {
        addFunction(castLookup(from, to), innertExecutor, innertChecker, innertInformer, functions);
    };

    const lookupFunction = (lookup, args, context, functions = FUNCTIONS) => {
        const found = functions[lookup];
        if(found !== undefined)
        {
            for(const fn of found)
                if(fn.checker(lookup, args, context, functions))
                    return fn;
        }

        return undefined;
    };
    
    const executeCast = (from, to, val, args, context, state = {error: 0}, functions = FUNCTIONS) => {
        const found = lookupFunction(castLookup(from, to), args, context, functions);
        if(found === undefined)
        {
            state.error = 1;
            return undefined;
        }

        return fn.executor.apply(context, [val]);
    };
    
    const gatherInfo = (lookup, args, context, functions = FUNCTIONS) =>
    {
        const found = functions[lookup];
        if(found === undefined)
            return [];

        return found.map(fn => fn.informer(lookup, args, context, functions));
    };

    const castAll = (types, args, context, functions) => 
    {
        assert(args.length <= types.length);
        const state = {error: 0};

        return args.map((arg, i) => {
            const to = types.at(i);
            if(arg.type == to)
                return arg; //PROBLEMS WITH REFERENCE TYPES

            const val = executeCast(arg.type, to, arg.val, args, context, state, functions);
            assert(state.error == 0);
            return Value(to, val);
        });
    };

    const executeFunction = (lookup, args, context, state = {error: 0}, functions = FUNCTIONS) => {
        const pack = lookupFunction(lookup, args, context, functions);
        if(pack === undefined)
        {
            state.error = gatherInfo(lookup, args, context, functions);
            return undefined;
        }

        return pack.executor.apply(context, args);
    };

    const typeChecker = (types) => (lookup, args, context, functions) => {
        if(types.length !== args.length && isSequenceFin(types))
            return false;

        for(let i = 0; i < args.length; i++)
        {
            const from = args[i].type;
            const to = types.at(i);
            if(from !== to)
            {
                const found = lookupFunction(castLookup(from, to), args, context, functions);
                if(found === undefined)
                    return false;
            }
        }

        return true;
    };

    const typeExecutor = (fn, types, functions) => function(...args) {
        const converted = castAll(types, args, this, functions);
        return fn.apply(this, converted);
    };
    
    const formatFunctionTypes = (types) => {
        let accumulated = '';
        seq.foreach(types, type => {
            if(accumulated === '')
                accumulated += `<${type}>`;
            else    
                accumulated += SEPARATOR + `<${type}>`;
        }, (type, i) => {
            if(i > 0)
                accumulated += SEPARATOR;
            accumulated += `<${type}>...`;
        });

        return accumulated;
    };
    
    const formatFunctionArgs = (args) => {
        return fmt.separate(args, SEPARATOR, arg => `<${arg.type}>`);
    };

    const informAttempted = (types, lookup) => {
        return `${lookup} (${formatFunctionTypes(types)}) : `;
    };
    
    const informNumberOfArguments = (types, args) => {
        return `Number of arguments doesnt match: required ${types.length} got ${args.length}`;
    };
    
    const informTypeMissmatch = (types, args, context, functions) => {
        assert(args.length <= types.length);

        for(let i = 0; i < args.length; i++)
        {
            const from = args[i].type;
            const to = types.at(i);
            if(from !== to)
            {
                const found = lookupFunction(castLookup(from, to), args, context, functions);
                if(found === undefined)
                    return `Cannot convert argument ${i} from <${from}> to <${to}>`;
            }
        }

        return '';
    };

    const typeInformer = (types) => (lookup, args, context, functions) => {
        const baseInfo = informAttempted(types, lookup);
        if(types.length !== args.length && isSequenceFin(types))
            return baseInfo + informNumberOfArguments(types, args);

        return baseInfo + informTypeMissmatch(types, args, context, functions);
    };

    const typeCheckedFn = (fn, types, functions = FUNCTIONS) => {
        const indexableTypes = Array.isArray(types) ? arraySequence(types) : types;
        return {
            checker: typeChecker(indexableTypes),
            executor: typeExecutor(fn, indexableTypes, functions),
            informer: typeInformer(indexableTypes),
        };
    };


    const addTypedFn = (lookupFnPair, types, potentialFn = undefined, functions = FUNCTIONS) => {
        const pair = obj.firstPair(lookupFnPair);
        if(potentialFn !== undefined)
            pair.val = potentialFn;

        addFunctionPack(pair.key, typeCheckedFn(pair.val, types), functions);
    };


    //FORMATS
    const isToken = (token) => {
        return (lib.isObject(token) && ('ib' in token) && ('type' in token) && ('val' in token));
    };

    const formatToken = (token, newline = '\n', offsetWith = '   ', padTypeTo = 0, padSizeTo = 0) =>
    {
        if(!isToken(token))
            return fmt.stringify(token, '\n');

        const type = `'${token.type}'`.padEnd(padTypeTo);
        const size = `(${token.ib}, ${token.ie})`.padEnd(padSizeTo);

        const isT = isToken(token.val);
        const isA = Array.isArray(token.val);

        if(!isT && !isA)
            return `{${type} ${size} : ${fmt.stringify(token.val)}}`;
            
        const formatSingle = (token) => {
            const formated = formatToken(token, newline, offsetWith, 0, 0);
            return fmt.offset(formated, offsetWith, newline);
        };

        if(isT)
            return `{${type} ${size} : {..}}${newline + formatSingle(token.val)}`;

        //isA
        if(token.val.length === 0)
            return `{${type} ${size} : []}`;

        if(token.val.length === 1)
            return `{${type} ${size} : [..]}${newline + formatSingle(token.val[0])}`;

        const tableInfo = fmt.getTableInfo(token.val, val => [val.type, [val.ib, val.ie]]);
        const maxTypeLen = tableInfo[0] + 2;
        const maxSizeLen = tableInfo[1] + 3; //4 - 1

        let accumulated = `{${type} ${size}} : [` + newline;
        const ender = ',' + newline;
        for(const val of token.val)
        {
            const formated = formatToken(val, newline, offsetWith, maxTypeLen, maxSizeLen);
            accumulated += fmt.offset(formated, offsetWith, newline) + ender;
        }

        accumulated += ']';
        return accumulated;    
    };

    const formatMatrix = (matrix, newline = NEWLINE, separator = SEPARATOR, colSeparator = ' ', offsetWith = OFFSET, offsetLevel = 0) =>
    {
        assert(mWidth(matrix) !== 0);
        assert(mHeight(matrix) !== 0);
        const tableFormat = fmt.getTableFormat(matrix.val);

        const contextOffset = offsetWith.repeat(offsetLevel);
        let accumulated = contextOffset + '[[' + newline;

        for(const row of tableFormat.rows)
        {
            accumulated += offsetWith + contextOffset;
            accumulated += fmt.separate(row, colSeparator, (elem, i) => elem.padStart(tableFormat.offsets[i]));
            accumulated += separator + newline;
        }

        return accumulated + ']]';
    };
    
    const formatArray = (token, separator = SEPARATOR, offsetWith = OFFSET, offsetLevel = 0) =>
    {
        const contextOffset = offsetWith.repeat(offsetLevel);
        return contextOffset + '[' + fmt.separate(token.val, separator, formatValue) + ']';
    };
    
    const formatValue = (token) => {
        switch(token.type)
        {
            case 'matrix': return formatMatrix(token);
            case 'array': return formatArray(token);
            case "num": return String(token.val);
            case 'unset': return 'unset';
            case 'void': return 'void';
            default: return '<error>';
        }
    };
    
    const formatErrorGather = (lookup, args, gathered) => {
        let accumulated = `Could not match expression: ${lookup} (${formatFunctionArgs(args)})`;
        if(gathered.size === 0)
            return ` : No such expression defined (in this scope)`;
        
        accumulated += `\n${OFFSET}Tried:\n`;

        const offset = OFFSET + OFFSET;
        for(const info of gathered)
            accumulated += fmt.offset(info, offset) + NEWLINE;

        return accumulated;
    };

    //SCOPE
    const copy = object => obj.copy(object);
    const Value = (type, val = null) => ({type, val});
    const Scope = (outer = undefined) => ({local: {}, outer});
    const Context = (name = '', scope = Scope(), last = {}, env = {}) => ({name, scope, last, env});

    const pushContext = (context, name = context.name) => Context(context.scope, name, context, context.env);

    const scopeGet = (scope, what) => {
        const local = scope.local[what];
        if(local !== undefined)
            return local;
        
        if(scope.outer === undefined)
            return undefined;
        
        return scopeGet(scope.outer, what);
    };
    
    const scopeSet = (scope, what, val) => {
        scope.local[what] = val;
    };

    
    //EVALUATION
    const Decimal = val => Value("num", val);
    const Matrix = val => Value('matrix', val);
    const ArrayVal = val => Value('array', val);
    const Void = () => Value('void', null);
    const Unset = (name) => Value('unset', name);

    const performExpression = (lookup, args, context) =>
    {
        const state = {error: 0};
        const res = executeFunction(lookup, args, context, state);
        if(state.error)
            throw new Error(formatErrorGather(lookup, args, state.error));
            
        return res;
    };

    const evaluateExpression = (token, context) => 
    {
        assert(token.val.length !== 0);
        
        let res = evaluate(token.val[0], context);
        let lastOp;
        
        for(let i = 1; i < token.val.length; i++)
        {
            const curr = evaluate(token.val[i], context);    
            if(curr.type == "op")
            {
                if(lastOp !== undefined)
                    throw new Error("Only simple operator evaluation supported");
                
                lastOp = curr;
            }       
            else 
            {
                if(lastOp === undefined)
                    throw new Error("Only simple operator evaluation supported");

                assert(lastOp.type == "op");
                res = performExpression(lastOp.val, [res, curr], context);
                lastOp = undefined;
            }
        }

        return res;
    };
    
    const evaluateFunction = (token, context) => 
    {
        assert(token.val.length == 2);
        const [id, args] = token.val;

        assert(id.type == "id");
        assert(args.type == "args");

        const evaluatedArgs = [];
        for(const arg of args.val)
            evaluatedArgs.push(evaluate(arg, context));

        return performExpression(id.val, evaluatedArgs, context);
    };

    const evaluateId = (token, context) =>
    {
        const found = scopeGet(context, token.val);
        if(found === undefined)
            return Unset(token.val);

        return found;
    };
    
    const evaluateDecimal = token => Decimal(Number(token.val));
    const evaluateOperator = token => token;
    
    const evaluateArray = (token, context) =>
    {
        const items = splitExpr(token.val);
        const arrayContext = pushContext('array', context);

        const ret = [];
        for(const item of items)
            ret.push(evaluate(elem, context));

        return ArrayVal(ret);
    };
    
    const evaluateMatrix = (token, context) =>
    {
        const matrixRes = [];

        let firstSize = 0;
        for(const rows of token.val)
        {
            if(firstSize == 0)
            {
                firstSize = rows.val.length;
                if(firstSize == 0)
                    throw new Error("Empty matrix disallowed");
            }
            else if(firstSize !== rows.val.length)
                throw new Error("All matrix rows need to have the same number of elements");

            const rowRes = [];
            for(const elem of rows.val)
            {
                const elemValue = evaluate(elem, context);
                if(elemValue.type !== "num")
                    throw new Error("All matrix elements need to evaluate to a number");

                rowRes.push(elemValue.val);
            }

            matrixRes.push(rowRes);
        }

        return Matrix(matrixRes);
    };
    
    const evaluateLine = (token, context) =>
    {
        if(token.val.length !== 0)
            evaluate(token.val[0], context);

        return Void();
    };

    const evaluateScope = (token, context) =>
    {
        const len = token.val.length;
        if(len === 0)
            return Void();

        const newScope = makeScopeContext(context);
        const noLast = len - 1;
        for(let i = 0; i < noLast; i++)
            evaluate(token.val[i], newScope);
        
        return evaluate(token.val[noLast], newScope);
    };
    
    const evaluateParens = (token, context) =>
    {
        assert(token.val.length === 1);
        return evaluate(token.val[0], context);
    };

    const evaluate = (token, context = Context()) =>
    {
        assert(token && isToken(token));
        switch(token.type)
        {
            case "id": return evaluateId(token, context);
            case "num": return evaluateDecimal(token, context);
            case "op": return evaluateOperator(token, context);
            case "line": return evaluateLine(token, context);
            case "parens": return evaluateParens(token, context);
            case "scope": return evaluateScope(token, context);
            case "expression": return evaluateExpression(token, context);
            case "array": return evaluateArray(token, context);
            case "matrix": return evaluateMatrix(token, context);
            default: return Value("void");
        }
    };

    const arrayToPlain = array => {
        const len = array.val.length;
        const arrayRes = new Array(len);

        for(let i = 0; i < len; i++)
            arrayRes[i] = toPlain(val);

        return arrayRes;
    }; 

    const toPlain = (token) => {
        if(token.type === 'matrix')
            return mtx.copy(token.val);
        if(token.type === 'array')
            return arrayToPlain(token);
        else
            return token.val;
    };


    //EXPRESSIONS
    const variadicArgs = (flatTypes, variadicType) => {
        if(flatTypes.length == 0)
            return constSequence(variadicType);

        return Sequence(i => {
            if(i < flatTypes.length)
                return flatTypes[i];
            else
                return variadicType;
        }, SEQUENCE_INF + flatTypes.length);
    };

    function assign(l, r) {
        assert(l.type === r.type);
        l.val = r.val;
        return l;
    }
    
    function deepAssign(l, r) {
        assert(l.type === r.type);
        l.val = copy(r.val);
        return l;
    }

    function define(l, r) {
        assert(l.type === "unset");
        const rightCopy = copy(r);
        scopeSet(this.scope, l.val, rightCopy);
        return rightCopy;
    }

    addDummyCast("num", "num");
    addDummyCast('matrix', 'matrix');
    addDummyCast('array', 'array');

    addTypedFn({'=': assign},     ["num", "num"]);
    addTypedFn({'=': deepAssign}, ['matrix', 'matrix']);
    addTypedFn({'=': deepAssign}, ['array', 'array']);
    
    addTypedFn({':=': define}, ['unset', "num"]);
    addTypedFn({':=': define}, ['unset', 'matrix']);
    addTypedFn({':=': define}, ['unset', 'array']);

    addTypedFn({'+': (l, r) => Decimal(l.val + r.val)}, ["num", "num"]);
    addTypedFn({'-': (l, r) => Decimal(l.val - r.val)}, ["num", "num"]);
    addTypedFn({'*': (l, r) => Decimal(l.val * r.val)}, ["num", "num"]);
    addTypedFn({'$$*': (l, r) => Decimal(l.val * r.val)}, ["num", "num"]);
    addTypedFn({'/': (l, r) => Decimal(l.val / r.val)}, ["num", "num"]);
    addTypedFn({'^': (l, r) => Decimal(Math.pow(l.val, r.val))}, ["num", "num"]);
    addTypedFn({'%': (l, r) => Decimal(l.val % r.val)}, ["num", "num"]);
    addTypedFn({'&': (l, r) => Decimal(l.val & r.val)}, ["num", "num"]);
    addTypedFn({'|': (l, r) => Decimal(l.val | r.val)}, ["num", "num"]);
    addTypedFn({'^|': (l, r) => Decimal(l.val ^ r.val)}, ["num", "num"]);
    addTypedFn({'&&': (l, r) => Decimal(l.val && r.val)}, ["num", "num"]);
    addTypedFn({'||': (l, r) => Decimal(l.val || r.val)}, ["num", "num"]);
    addTypedFn({'>>': (l, r) => Decimal(l.val >> r.val)}, ["num", "num"]);
    addTypedFn({'<<': (l, r) => Decimal(l.val << r.val)}, ["num", "num"]);
    
    addTypedFn({'+=': (l, r) => {l.val += r.val; return l;}}, ["num", "num"]);
    addTypedFn({'-=': (l, r) => {l.val -= r.val; return l;}}, ["num", "num"]);
    addTypedFn({'*=': (l, r) => {l.val *= r.val; return l;}}, ["num", "num"]);
    addTypedFn({'/=': (l, r) => {l.val /= r.val; return l;}}, ["num", "num"]);
    addTypedFn({'^=': (l, r) => {l.val ^= Math.pow(l.val, r.val); return l;}}, ["num", "num"]);
    addTypedFn({'%=': (l, r) => {l.val %= r.val; return l;}}, ["num", "num"]);
    addTypedFn({'&=': (l, r) => {l.val &= r.val; return l;}}, ["num", "num"]);
    addTypedFn({'|=': (l, r) => {l.val |= r.val; return l;}}, ["num", "num"]);
    addTypedFn({'^|=': (l, r) => {l.val |= r.val; return l;}}, ["num", "num"]);
    addTypedFn({'>>=': (l, r) => {l.val >>= r.val; return l;}}, ["num", "num"]);
    addTypedFn({'<<=': (l, r) => {l.val <<= r.val; return l;}}, ["num", "num"]);

    addTypedFn({'abs':   dec => Decimal(Math.abs(dec.val))}, ["num"]);
    addTypedFn({'acos':  dec => Decimal(Math.acos(dec.val))}, ["num"]);
    addTypedFn({'acosh': dec => Decimal(Math.acosh(dec.val))}, ["num"]);
    addTypedFn({'asin':  dec => Decimal(Math.asin(dec.val))}, ["num"]);
    addTypedFn({'asinh': dec => Decimal(Math.asinh(dec.val))}, ["num"]);
    addTypedFn({'atan':  dec => Decimal(Math.atan(dec.val))}, ["num"]);
    addTypedFn({'atanh': dec => Decimal(Math.atanh(dec.val))}, ["num"]);
    addTypedFn({'cbrt': dec => Decimal(Math.cbrt(dec.val))}, ["num"]);
    addTypedFn({'ceil': dec => Decimal(Math.ceil(dec.val))}, ["num"]);
    addTypedFn({'clz32': dec => Decimal(Math.clz32(dec.val))}, ["num"]);
    addTypedFn({'cos': dec => Decimal(Math.cos(dec.val))}, ["num"]);
    addTypedFn({'cosh': dec => Decimal(Math.cosh(dec.val))}, ["num"]);
    addTypedFn({'exp': dec => Decimal(Math.exp(dec.val))}, ["num"]);
    addTypedFn({'expm1': dec => Decimal(Math.expm1(dec.val))}, ["num"]);
    addTypedFn({'floor': dec => Decimal(Math.floor(dec.val))}, ["num"]);
    addTypedFn({'fround': dec => Decimal(Math.fround(dec.val))}, ["num"]);
    addTypedFn({'log': dec => Decimal(Math.log(dec.val))}, ["num"]);
    addTypedFn({'log1p': dec => Decimal(Math.log1p(dec.val))}, ["num"]);
    addTypedFn({'log10': dec => Decimal(Math.log10(dec.val))}, ["num"]);
    addTypedFn({'log2': dec => Decimal(Math.log2(dec.val))}, ["num"]);
    addTypedFn({'random': () => Decimal(Math.random())}, []);
    addTypedFn({'round': dec => Decimal(Math.round(dec.val))}, ["num"]);
    addTypedFn({'sign': dec => Decimal(Math.sign(dec.val))}, ["num"]);
    addTypedFn({'sin': dec => Decimal(Math.sin(dec.val))}, ["num"]);
    addTypedFn({'sinh': dec => Decimal(Math.sinh(dec.val))}, ["num"]);
    addTypedFn({'sqrt': dec => Decimal(Math.sqrt(dec.val))}, ["num"]);
    addTypedFn({'tan': dec => Decimal(Math.tan(dec.val))}, ["num"]);
    addTypedFn({'tanh': dec => Decimal(Math.tanh(dec.val))}, ["num"]);
    addTypedFn({'trunc': dec => Decimal(Math.trunc(dec.val))}, ["num"]);
    
    addTypedFn({'atan2': (l, r) => Decimal(Math.atan2(l.val, r.val))}, ["num"]);
    addTypedFn({'imul': (l, r) => Decimal(Math.imul(l.val, r.val))}, ["num"]);
    
    const sumVariadicDecimal = (...args) => {
        return args.reduce((l, r) => Decimal(l.val + r.val), Decimal(0));
    };
    
    const productVariadicDecimal = (...args) => {
        return args.reduce((l, r) => Decimal(l.val * r.val), Decimal(1));
    };

    const minVariadicDecimal = (...args) => {
        assert(args.length > 0);
        let smallest = args[0];

        for(let i = 1; i < args.length; i++)
            if(args[i] < first)
                smallest = args[i];

        return smallest;
    };

    const maxVariadicDecimal = (...args) => {
        assert(args.length > 0);
        let smallest = args[0];

        for(let i = 1; i < args.length; i++)
            if(args[i] > first)
                smallest = args[i];

        return smallest;
    };

    const hypotVariadicDecimal = (...args) => {
        const sum = args.reduce((l, r) => Decimal(l.val + r.val*r.val), Decimal(0));
        sum.val = Math.sqrt(sum.val);
        return sum;
    };

    addTypedFn({'sum': sumVariadicDecimal},         variadicArgs(["num"], "num"));
    addTypedFn({'product': productVariadicDecimal}, variadicArgs(["num"], "num"));
    addTypedFn({'min': minVariadicDecimal},         variadicArgs(["num"], "num"));
    addTypedFn({'max': maxVariadicDecimal},         variadicArgs(["num"], "num"));
    addTypedFn({'hypot': hypotVariadicDecimal},     variadicArgs(["num"], "num"));

    const mWidth = (matrix) => mtx.width(matrix.val);
    const mHeight = (matrix) => mtx.height(matrix.val);

    const matrixSizeError = (what, left, right) => {
        const w1 = mWidth(left);
        const h1 = mHeight(left);
        const w2 = mWidth(right);
        const h2 = mHeight(right);

        return `${what} cannot be applied on matrices of incorrect size: ${w1}x${h1} and ${w2}x${h2}`;
    };
    
    const matrixOpSizeError = (op, left, right) => matrixSizeError('Operator ' + op, left, right);
    const matrixFnSizeError = (fn, left, right) => matrixSizeError('Function ' + fn, left, right);

    const equalMatrixSizeCheck = (op, left, right) => {
        if(mWidth(left) !== mWidth(right) ||
           mHeight(left) !== mHeight(right))
            throw new Error(matrixOpSizeError(op, left, right));
    };

    addTypedFn({'+': null}, ['matrix', 'matrix'], (l, r) => {
        equalMatrixSizeCheck('+', l, r);
        return Matrix(mtx.addMatrix(l.val, r.val));
    });

    addTypedFn({'-': null}, ['matrix', 'matrix'], (l, r) => {
        equalMatrixSizeCheck('-', l, r);
        return Matrix(mtx.subMatrix(l.val, r.val));
    });
    
    const mulMatrixt = (l, r) => {
        if(mWidth(l) !== mHeight(r))
            throw new Error(matrixOpSizeError('*', l, r));

        return Matrix(mtx.mulMatrix(l.val, r.val));
    };

    addTypedFn({'*': mulMatrixt}, ['matrix', 'matrix']);
    addTypedFn({'*': (l, r) => Matrix(mtx.mulNum(l.val, r.val))}, ['matrix', 'num']);
    addTypedFn({'*': (l, r) => Matrix(mtx.mulNum(r.val, l.val))}, ['num', 'matrix']);
    
    addTypedFn({'$$*': mulMatrixt}, ['matrix', 'matrix']);
    addTypedFn({'$$*': (l, r) => Matrix(mtx.mulNum(l.val, r.val))}, ['matrix', 'num']);
    addTypedFn({'$$*': (l, r) => Matrix(mtx.mulNum(r.val, l.val))}, ['num', 'matrix']);

    const sumVariadicMatrix = (...args) => {
        assert(args.length > 0);

        const accumulated = Matrix(mtx.copy(args[0].val));
        for(let i = 1; i < args.length; i++)
        {
            const other = args[i];
            if(mWidth(accumulated) !== mWidth(other) ||
               mHeight(accumulated) !== mHeight(other))
                throw new Error(matrixFnSizeError('product', accumulated, other));

            mtx.addMatrixAssign(accumulated.val, other.val);
        }
        return accumulated;
    };
    
    const productVariadicMatrix = (...args) => {
        assert(args.length > 0);

        let res = args[0];
        for(let i = 1; i < args.length; i++)
            res = mulMatrixt(res, args[i]);
        
        return res;
    };

    addTypedFn({'sum': sumVariadicMatrix}, variadicArgs(['matrix'], 'matrix'));
    addTypedFn({'product': productVariadicMatrix}, variadicArgs(['matrix'], 'matrix'));


    const subscriptArray = (left, right) => {
        const rvalue = right.val;
        
        if(rvalue.length == 0)
            throw new Error(`Operator [] cannot be used with empty 0 indecies while performing ${formatValue(left)}${formatArray(right)}`);

        for(const index of rvalue)
            if(index.type !== "num")
                throw new Error(`Operator [] cannot be used with index of type <${index.type}> while performing ${formatValue(left)}${formatArray(right)}`);

        let current = left;
        for(const index of rvalue)
        {
            const i = index.val;
            if(current.type !== "array")
                throw new Error(`Operator [] with multiple indicies ${formatArray(right)} cannot be used on array ${formatArray(left)} with subtype <${current.type}>`);

            if(i > current.val.length || i < 1)
                throw new Error(`Operator [] index ${i} out of range of array ${formatArray(current)} while performing ${formatArray(left)}${formatArray(right)}`);

            current = current.val[i - 1];
        }
        return current;
    };

    const subscriptMatrix = (left, right) => {
        const rvalue = right.val;
        
        if(rvalue.length == 0)
            throw new Error(`Operator [] cannot be used with empty 0 indecies while performing ${formatValue(left)}${formatArray(right)}`);

        for(const index of rvalue)
            if(index.type !== "num")
                throw new Error(`Operator [] cannot be used with index of type <${index.type}> while performing ${formatValue(left)}${formatArray(right)}`);
        
        const matrix = left.val;
        const width = mWidth(right);
        const height = mHeight(right);
        
        if(rvalue.length > 2)
            throw new Error(`Operator [] max two indecies to array subscript while performing ${formatMatrix(left)}${formatArray(right)}`);

        const i = rvalue[0].val;
        if(i > height || i < 1)
            throw new Error(`Operator [] index ${i} out of range of matrix ${formatMatrix(left)}`);

        if(rvalue.length == 1)
            return Value("array", matrix[i - 1].map(val => Value("num", val)));

        const j = rvalue[0].val;
        if(j > width || j < 1)
            throw new Error(`Operator [] index ${j} out of range of matrix ${formatMatrix(left)}`);
            
        return Value("num", matrix[i - 1][j - 1]); 
    };

    const powMatrix = (left, right) => {
        if(!Number.isInteger(right.val))
            throw new Error("Only whole matrix powers supported");
        
        const state = mtx.State();
        const product = mtx.safe.pow(left.val, right.val, state);
        switch(state.error)
        {
            case mtx.ERROR.SINGULAR: throw new Error(`Cannot find inverse of singular matrix ${formatMatrix(left)}`);
            case mtx.ERROR.DIMENSIONS: throw new Error(matrixSizeError('*', left, left));
        }

        return Value("matrix", product);
    };

    addTypedFn({'^': powMatrix}, ['matrix', "num"]);
    addTypedFn({'$$[]': subscriptMatrix}, ['matrix', 'array']);
    addTypedFn({'$$[]': subscriptArray}, variadicArgs(['array'], 'array'));

    return {
        evaluate,
        formatToken,
        formatValue,
    };
}