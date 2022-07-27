function importParsers(lib)
{
    const c = importCombinators(lib);
    const assert = lib.dbg.assert;
    const arr = lib.arr;
    const seq = lib.seq;
    const obj = lib.obj;
    const fmt = lib.fmt;
    const copy = obj.copy;

    c.registerHandler({TOKEN: 500});
    c.registerHandler({EXPR: 501});
    c.registerHandler({PARENS: 502});
    c.registerHandler({ARRAY: 503});
    c.registerHandler({MATRIX: 504});
    c.registerHandler({SCOPE: 505});
    c.registerHandler({SCRIPT: 506});

    const last = array => array[array.length - 1];
    const Token = (type, val = null, ib = 0, ie = 0) => ({type, val, ib, ie});
    const copyToken = (token, val = token.val) => ({type: token.type, val: val, ib: token.ib, ie: token.ie});
    const tokenIs = (token, type) => token.type === type;
    const tokenHas = (token, type, val) => token.type === type && token.val === val;
    const areAdjecent = (token1, token2) => token1.ie === token2.ib;


    const ASSOC = {
        LEFT: true,
        RIGHT: false,
    };

    const PAIR = {
        BIN: 0,
        PRE: 1,
        POST: 2,
        BIN_PRE: 3,
        BIN_POST: 5,
        PRE_POST: 4,
    };

    const OpProperties = (bin = false, pre = false, post = false, assoc = ASSOC.LEFT, prio = 0) => ({pre, post, bin, assoc, prio});
    const enforceOpProperies = (obj) => obj ? obj : OpProperties();

    const preOpTransf = op => op + "$$";
    const postOpTransf = op => "$$" + op;
    const implicitOpTransf = op => "$$" + op;

    const OpDecl = (pairity, assoc, prio, opLookups) => 
    {
        const properties = OpProperties();
        properties.assoc = assoc;
        properties.prio = prio;

        assert(pairity <= 2);
        switch(pairity)
        {
            case PAIR.BIN: properties.bin = true; break;
            case PAIR.PRE: properties.pre = true; break;
            case PAIR.POST: properties.post = true; break;
        }

        return {vals: opLookups, prop: properties};
    };

    const createOperators = () => {
        const BIN = PAIR.BIN;
        const PRE = PAIR.PRE;
        const POST = PAIR.POST;
        const LEFT = ASSOC.LEFT;
        const RIGHT = ASSOC.RIGHT;

        const VISIBLE = {
            ACESS:  OpDecl(BIN,  LEFT,  190, ['.']),
            POST:   OpDecl(POST, LEFT,  180, ['++', '--', '...']),
            PRE:    OpDecl(PRE,  RIGHT, 170, ['++', '--', '~', '+', '-', '!']),
            POW:    OpDecl(BIN,  RIGHT, 160, ['^']),
            MUL:    OpDecl(BIN,  LEFT,  150, ['*', '/', '%']),
            ADD:    OpDecl(BIN,  LEFT,  140, ['+', '-']),
            SHIFT:  OpDecl(BIN,  LEFT,  130, ['<<', '>>']),
            COMP:   OpDecl(BIN,  LEFT,  120, ['<', '>', '<=', '>=']),
            EQUAL:  OpDecl(BIN,  LEFT,  110, ['==', '!=']),
            BAND:   OpDecl(BIN,  LEFT,  100, ['&']),
            BXOR:   OpDecl(BIN,  LEFT,  90,  ['^|']),
            BOR:    OpDecl(BIN,  LEFT,  80,  ['|']),
            AND:    OpDecl(BIN,  LEFT,  70,  ['&&']),
            OR:     OpDecl(BIN,  LEFT,  60,  ['||']),
            SLICE:  OpDecl(BIN,  LEFT,  50,  ['..']),
            TERN:   OpDecl(BIN,  RIGHT, 40,  ['?', ':']),
            COMMA:  OpDecl(BIN,  LEFT,  30,  [',']),
            ASGN:   OpDecl(BIN,  RIGHT, 20,  [':=', '=', '+=', '-=', '*=', '/=', '^=', '%=', '&=', '|=', '^|=', '<<=', '>>=']),
            SEP:    OpDecl(BIN,  LEFT,  10,  [';']),
        };

        const INTERNAL = {
            IMPLICIT: OpDecl(BIN,  LEFT,  200, ['$$*', '$$()', '$$[]']),
            POST:     copy(VISIBLE.POST),
            PRE:      copy(VISIBLE.PRE),
        };

        arr.mapInplace(INTERNAL.POST.vals, postOpTransf);
        arr.mapInplace(INTERNAL.PRE.vals,  preOpTransf);

        const OPERATORS = copy(VISIBLE);
        arr.append(OPERATORS.POST.vals, INTERNAL.POST.vals);
        arr.append(OPERATORS.PRE.vals,  INTERNAL.PRE.vals);
        OPERATORS.IMPLICIT = copy(INTERNAL.IMPLICIT);

        Object.freeze(OPERATORS);
        Object.freeze(VISIBLE);
        Object.freeze(INTERNAL);
        return [OPERATORS, VISIBLE, INTERNAL];
    };

    const createOpPropLookup = (categories, to = {}) =>
    {
        for(const cat in categories) 
        {
            const decl = categories[cat];
            for(const op of decl.vals)
            {
                to[op] = enforceOpProperies(to[op]);
                const prop = to[op];

                prop.assoc = decl.prop.assoc;
                prop.prio = decl.prop.prio;

                if(decl.prop.bin)   prop.bin = true;
                if(decl.prop.post)  prop.post = true;
                if(decl.prop.pre)   prop.pre = true;
            }
        }
        return to;
    };

    const unpackOperators = (categories, to = []) => {
        for(const cat in categories) 
        {
            const decl = categories[cat];
            for(const op of decl.vals)
                if(!(op in to))
                    to.push(op);
        }
        return to;
    };

    const [OPERATORS, VISIBLE_OPERATORS, INTERNAL_OPERATORS] = createOperators();
    const OPERATOR_PROPERTIES = createOpPropLookup(OPERATORS);
    const UNPACKED_VISIBLE = unpackOperators(VISIBLE_OPERATORS);

    const generateOperatorParsers = (operators = UNPACKED_VISIBLE) => 
        operators.map(op => c.slice(op));

    const toTokenParser = (type, parser) => parser.mapResult((result, state, lastState) => {
        return Token(type, result, lastState.index, state.index);
    });

    const operatorParsers = () => c.furthest(generateOperatorParsers());

    //@TOLIB

    const reserve = (arr, toFit = arr.length + 1) => {
        if(arr.length > toFit)
            return
        else if(arr.length !== 0)
        {
            let to = arr.length;
            while(to < toFit)
                to *= 2;
            arr.length = to;
        }
        else
            arr.length = 8;
    };

    const push = (val, arr, filledTo) => {
        reserve(arr, filledTo.val);
        arr[filledTo.val ++] = val;
    };

    const CHAR_INFO = {
        ID: 0,
        NUM: 1,
        OP: 2,
        SPACE: 3,
        NEWLINE: 4,
        COMMENT: 5,
        RBRA: 6,
        SBRA: 7,
        CBRA: 8,
        PREPROC: 9,
        STR: 10,
        CHAR: 11,
        EOF: 12,
        ERROR: 13,
        AMBI: 1 << 10,
    };

    const CHAR_MASK = 0xFF;
    const CHAR_TABLE = Array(256).fill(CHAR_INFO.ERROR);

    const toChar = (str, i = 0) => str.charCodeAt(i) & CHAR_MASK;

    const CHAR_CODE = {
        A: toChar("A"),
        Z: toChar("Z"),
        a: toChar("a"),
        z: toChar("z"),
        _: toChar("_"),
        _0: toChar("0"),
        _9: toChar("9"),
    };
    
    let iter = 1000;
    const createSortedOpTables = (unpacked) => {
        const sorted = unpacked.slice();
        sorted.sort();
        arr.filterInplace(sorted, (elem, i) => {
            if(i + 1 == sorted.length)
                return true;
            else
                return elem !== sorted[i + 1];
        });

        sorted.sort((a, b) => {
            if(a[0] !== b[0])
                return a[0] - b[0];

            return a.length - b.length;
        });

        const MAX_LEN = 3;

        for(let i = 0; i < sorted.length; i++)
            assert(sorted[i].length <= MAX_LEN);

        const Link = (letter = '', offset = 0, sizes = 0) => ({letter, offset, sizes});
        const linker = new Array(256);
        for(let i = 0; i < linker.length; i++)
            linker[i] = Link(String.fromCharCode(i), 255);

        for(let i = 0; i < sorted.length;)
        {
            const currLetter = sorted[i][0]; 

            const link = Link(currLetter, i);
            i ++;
            let start = i;

            while(i < sorted.length && sorted[i].length == 2 && currLetter == sorted[i][0]) i++;
            link.sizes += i - start;
            assert(link.sizes < 16);
            
            start = i;
            while(i < sorted.length && sorted[i].length == 3 && currLetter == sorted[i][0]) i++;
            link.sizes += (i - start) << 4;
            assert(link.sizes < 256);

            linker[toChar(currLetter)] = link;    
        }

        return [linker, sorted, MAX_LEN];
    };

    const [OP_LINKER, SORTED_OPS, MAX_OP_LEN] = createSortedOpTables(UNPACKED_VISIBLE);


    const addIdChars = (table) => {
        assert(table.length >= 256);

        for(let i = CHAR_CODE.A; i <= CHAR_CODE.Z; i++)
            table[i] = CHAR_INFO.ID;
            
        for(let i = CHAR_CODE.a; i <= CHAR_CODE.z; i++)
            table[i] = CHAR_INFO.ID;

        table[CHAR_CODE._] = CHAR_INFO.ID;
    };

    const addNumChars = (table) => {
        assert(table.length >= 256);

        for(let i = CHAR_CODE._0; i <= CHAR_CODE._9; i++)
            table[i] = CHAR_INFO.NUM;
    };

    const addStringChars = (table, toCat, str) => {
        assert(table.length >= 256);

        for(let i = 0; i < str.length; i++)
        {
            const char = toChar(str, i);
            switch(table[char])
            {
                case CHAR_INFO.ERROR:
                case toCat: table[char] = toCat; break;
                default: table[char] += toCat + CHAR_INFO.AMBI; break;
            }
        }
    };

    const addCatChars = (table, toCat, strings) => {
        assert(table.length >= 256);
        if(typeof(strings) === "string")
            return addStringChars(table, toCat, strings);
        
        for(const str of strings)
            addStringChars(table, toCat, str);
    };

    addIdChars(CHAR_TABLE);
    addNumChars(CHAR_TABLE);
    addCatChars(CHAR_TABLE, CHAR_INFO.NEWLINE, "\n");
    addCatChars(CHAR_TABLE, CHAR_INFO.SPACE, " \t\r\v\f");
    addCatChars(CHAR_TABLE, CHAR_INFO.COMMENT, "/");
    addCatChars(CHAR_TABLE, CHAR_INFO.PREPROC, "#@");
    addCatChars(CHAR_TABLE, CHAR_INFO.OP, UNPACKED_VISIBLE);
    addCatChars(CHAR_TABLE, CHAR_INFO.RBRA, "()");
    addCatChars(CHAR_TABLE, CHAR_INFO.SBRA, "[]");
    addCatChars(CHAR_TABLE, CHAR_INFO.CBRA, "{}");
    addCatChars(CHAR_TABLE, CHAR_INFO.STR, "\"");
    addCatChars(CHAR_TABLE, CHAR_INFO.CHAR, "\'");
    
    //not ambi even thought ambi ... (lexer cannot determine)
    CHAR_TABLE[toChar('[')] = CHAR_INFO.SBRA;
    CHAR_TABLE[toChar(']')] = CHAR_INFO.SBRA;
    CHAR_TABLE[toChar('/')] = CHAR_INFO.COMMENT;
    CHAR_TABLE[0] = CHAR_INFO.EOF;

    const getCharInfo = (str, i) => CHAR_TABLE[str.charCodeAt(i) & CHAR_MASK];

    const NUM_FORMAT = {
        DEC: 0,
        BIN: 1,
        HEX: 2,
        OCT: 3,
    };

    const tokenizeId = (stream, i, out, filled) => {
        for(let to = i + 1; ; to++)
        {
            const info = getCharInfo(stream, to);
            if(info !== CHAR_INFO.ID && info !== CHAR_INFO.NUM)
            {
                push(Token("id", stream.slice(i, to), i, to), out, filled);
                return [to, info];
            }
        }
    };

    const getDigits = (stream, from, skip = 0) => {
        let to = from + skip;
        let accumulated = '';
        while(true)
        {
            while(CHAR_CODE._0 <= stream.charCodeAt(to) && stream.charCodeAt(to) <= CHAR_CODE._9)
                to++;

            accumulated += stream.slice(from, to);
            if(stream.charCodeAt(to) !== CHAR_CODE._)
                break;
            
            to ++;
            from = to;
        }

        return [to, accumulated];
    };

    assert(getDigits("123", 0)[1] == "123");
    assert(getDigits("123a", 0)[1] == "123");
    assert(getDigits("12a3a", 0)[1] == "12");
    assert(getDigits("123", 1)[1] == "23");
    assert(getDigits("12_3", 0)[1] == "123");
    assert(getDigits("12_3__", 2)[1] == "3");
    assert(getDigits("__1_2_3__", 2)[1] == "123");
    assert(getDigits("__1_2_x3__", 2)[1] == "12");

    const pushError = (i, to, reason, out, filled) => push(Token("error", reason, i, to), out, filled);

    const tokenizeNum = (stream, i, out, filled) => {
        let [to, prefix] = getDigits(stream, i, 1);
        let base = 10;
        switch(stream[to])
        {
            default:
                push(Token("num", parseInt(prefix, base), i, to), out, filled);
                return [to, getCharInfo(stream, to)];

            case 'X':
            case 'x': 
                if(i + 1 != to || stream[i] !== "0")
                {
                    push(Token("num", parseInt(prefix, base), i, to), out, filled);
                    return [to, getCharInfo(stream, to)];
                }
                base = 16; break;

            case 'B':
            case 'b': 
                if(i + 1 !== to || stream[i] !== "0")
                {
                    push(Token("num", parseInt(prefix, base), i, to), out, filled);
                    return [to, getCharInfo(stream, to)];
                }
                base = 2; break;

            case '.': 
                const [after, postfix] = getDigits(stream, to + 1);
                if(after === to)
                    pushError("Decimal number must not end with .", i, to, out, filled);
                else
                    push(Token("num", parseFloat(prefix + '.' + postfix, 10), i, after), out, filled);
                
                return [after, getCharInfo(stream, after)];
        }
        
        const [after, postfix] = getDigits(stream, to + 1);
        if(after === to)
            pushError("numeric literal must not end with literal prefix", i, to, out, filled);
        else
            push(Token("num", parseInt(prefix + postfix, base), i, after), out, filled);

        return [after, getCharInfo(stream, after)];
    };
    
    const tokenizeOp = (stream, i, out, filled) => {
        const possibilities = [];
        const OP_SIZES = MAX_OP_LEN - 1;
        for(let curr = i;; curr++)
        {
            const link = OP_LINKER[toChar(stream, curr)];
            if(link.offset == 255)
                break;

            possibilities.push(SORTED_OPS[link.offset]);
            
            for(let currSize = 0; currSize < OP_SIZES; currSize ++)
            {
                const sub = OP_LINKER[toChar(stream, curr + currSize + 1)];
                if(sub.offset == 255)
                    break;

                let end = currSize == 0 ? link.sizes & 0xF : link.sizes >> 4;
                end += link.offset + 1;
                const slice = stream.slice(curr, curr + currSize + 2);

                for(let j = link.offset + 1; j < end; j++)
                {
                    if(slice === SORTED_OPS[j])
                        possibilities.push(SORTED_OPS[j]);
                }
            }
        }

        let x = 5;
    };
    
    const tokenizeStr = (stream, i, out, filled, lookFor = '\"', classify = "str") => {
        let to = i + 1;
        let accumulated = '';
        let lastAdded = to;
        for(; ; to++)
        {
            switch(stream[to])
            {
                case '\\':    
                    accumulated += stream.slice(lastAdded, to);
                    to ++;
                    switch(stream[to])
                    {
                        case 'n': accumulated += '\n'; break;
                        case 't': accumulated += '\t'; break;
                        case 'f': accumulated += '\f'; break;
                        case 'v': accumulated += '\v'; break;
                        case 'r': accumulated += '\r'; break;
                        default: accumulated += stream[to]; break;
                        case String.fromCharCode(0): 
                            pushError(`Unended string starting with ${stream.slice(i, i + 10)}`, i, to, out, filled);
                            // throw new Error(`Unended string starting with ${stream.slice(i, i + 10)}`);
                    }

                    lastAdded = to + 1;
                    break;

                case lookFor: 
                    if(lastAdded !== to)
                        accumulated += stream.slice(lastAdded, to);
                    
                    push(Token(classify, accumulated, i, to), out, filled);
                    return [to + 1, getCharInfo(stream, to + 1)];

                case String.fromCharCode(0): 
                    pushError(`Unended string starting with ${stream.slice(i, i + 10)}`, i, to, out, filled);
                    // throw new Error(`Unended string starting with ${stream.slice(i, i + 10)}`);
            }
        }
    };

    const tokenizeChar = (stream, i, out, filled) => tokenizeStr(stream, i, out, filled, "'", "char");

    const tokenizePreproc = (stream, i, out, filled) => {
        for(let to = i + 1; ; to++)
        {
            const info = getCharInfo(stream, to);
            if(info !== CHAR_INFO.ID && info !== CHAR_INFO.NUM)
            {
                push(Token("preproc", stream.slice(i + 1, to), i, to), out, filled);
                return [to, info];
            }
        }
    };

    const tokenizeComment = (stream, i, out, filled) => {
        let to = i + 1;
        let valFrom = i + 2;
        let valTo = to;
        switch(stream[to])
        {
            case '/': 
                to = stream.indexOf('\n', to + 1) + 1; 
                valTo = to - 2;
            break;
            case '*': 
                to = stream.indexOf('*/', to + 1) + 2; 
                valTo = to - 2;
                break;

            default: return tokenizeOp(stream, i, out, filled);
        }

        if(to === -1)
        {
            to = stream.length;
            valTo = to;
        }
            // throw new Error(`Unended comment starting with ${stream.slice(i, i + 10)}`);

        push(Token("comment", stream.slice(valFrom, valTo), valFrom, valTo), out, filled);
        return [to, getCharInfo(stream, to)];
    };

    const skipCategory = (stream, i, infoType) => {
        for(let to = i; ; to++)
        {
            const info = getCharInfo(stream, to);
            if(info !== infoType)
            {
                return [to, info];
            }
        }
    };

    const tokenizeInCategory = (stream, i, out, filled, infoType, type) => {
        const adresses = skipCategory(stream, i + 1, infoType);
        push(Token(type, stream.slice(i, adresses[0]), i, adresses[0]), out, filled);
        return adresses;
    };
    const tokenizeSpace = (stream, i, out, filled) => tokenizeInCategory(stream, i, out, filled, CHAR_INFO.SPACE, "space");
    const tokenizeError = (stream, i, out, filled) => tokenizeInCategory(stream, i, out, filled, CHAR_INFO.ERROR, "error");

    const tokenizeSingleChar = (stream, i, out, filled, type) => {
        push(Token(type, stream[i], i, i + 1), out, filled);
        return [i + 1, getCharInfo(stream, i)];
    };

    const tokenizeNewline = (stream, i, out, filled) => tokenizeSingleChar(stream, i, out, filled, "newline");
    const tokenizeRbracket = (stream, i, out, filled) => tokenizeSingleChar(stream, i, out, filled, "roundB");
    const tokenizeSbracket = (stream, i, out, filled) => tokenizeSingleChar(stream, i, out, filled, "squareB");
    const tokenizeCbracket = (stream, i, out, filled) => tokenizeSingleChar(stream, i, out, filled, "curlyB");

    const BASE_TOKEN_COUNT = 2048;
    const tokenize = (stream, out = []) => {
        let filled = lib.Ref(0);

        //+= EOF 
        stream += String.fromCharCode(0);
        
        if(out.length === 0)
            out.length = BASE_TOKEN_COUNT;

        let info = getCharInfo(stream, 0);
        for(let i = 0; i < stream.length;)
        {
            switch(info)
            {
                case CHAR_INFO.ID:      [i, info] = tokenizeId(stream, i, out, filled); break;
                case CHAR_INFO.NUM:     [i, info] = tokenizeNum(stream, i, out, filled); break;
                case CHAR_INFO.OP:      [i, info] = tokenizeOp(stream, i, out, filled); break;
                case CHAR_INFO.SPACE:   [i, info] = tokenizeSpace(stream, i, out, filled); break;
                case CHAR_INFO.COMMENT: [i, info] = tokenizeComment(stream, i, out, filled); break;
                case CHAR_INFO.STR:     [i, info] = tokenizeStr(stream, i, out, filled); break;
                case CHAR_INFO.CHAR:    [i, info] = tokenizeChar(stream, i, out, filled); break;
                case CHAR_INFO.ERROR:   [i, info] = tokenizeError(stream, i, out, filled); break;
                case CHAR_INFO.NEWLINE: [i, info] = tokenizeNewline(stream, i, out, filled); break;
                case CHAR_INFO.RBRA:    [i, info] = tokenizeRbracket(stream, i, out, filled); break;
                case CHAR_INFO.SBRA:    [i, info] = tokenizeSbracket(stream, i, out, filled); break;
                case CHAR_INFO.CBRA:    [i, info] = tokenizeCbracket(stream, i, out, filled); break;
                case CHAR_INFO.PREPROC: [i, info] = tokenizePreproc(stream, i, out, filled); break;
                case CHAR_INFO.EOF:                 
                    out.length = filled.val;
                    return out;
                default:                [i, info] = tokenizeError(stream, i, out, filled); break;
            }
        }

        assert(false);
        return out;
    };

    const formatTokens = (tokens) => 
    {
        let accumulated = '';
        for(const token of tokens)
            accumulated += `<${token.type}:${token.val}>\n`;

        return accumulated;
    };

    console.log(formatTokens(tokenize(" /*vkaofk \\\ // ** */ //aifjaif\\ \\\n")));
    console.log(formatTokens(tokenize(" 123 12__3 0x123 1x123 0b010__10 1__23.1_7")));
    console.log(formatTokens(tokenize(` " fakjfiajf gas \\n " "hello\\" hehe" 'a'`)));
    console.log(formatTokens(tokenize(`@hello hello #hello`)));
    console.log(formatTokens(tokenize(`+=+`)));

    const tokenizer = c.greedy([
        toTokenParser("space", c.whitespace()),
        toTokenParser("id", c.identifiers()),
        toTokenParser("op", operatorParsers()),
        toTokenParser("roundB", c.single('(')),
        toTokenParser("roundB", c.single(')')),
        toTokenParser("squareB", c.single('[')),
        toTokenParser("squareB", c.single(']')),
        toTokenParser("curlyB", c.single('{')),
        toTokenParser("curlyB", c.single('}')),
        toTokenParser("num", c.decimal()),
        toTokenParser("error", c.anySingle())
    ]).mapResult((results, state) => {
        results.push(Token("eof", null, state.index - 1, state.index));
        return results;
    });

    const terminal = (type, val = undefined) => {
        if(val !== undefined)
            return new c.Parser(state => 
            {
                const index = state.index;
                const token = state.shared.input[index];
                if(token != undefined && tokenHas(token, type, val))
                    return c.updateParserResult(state, copyToken(token), index + 1);

                return c.updateParserError(state, c.PARSER_ID.TOKEN);
            }, {name: 'terminal: ' + type + ': ' + val});
        
        return new c.Parser(state => 
        {
            const index = state.index;
            const token = state.shared.input[index];

            if(token != undefined && tokenIs(token, type))
                return c.updateParserResult(state, copyToken(token), index + 1);

            return c.updateParserError(state, c.PARSER_ID.TOKEN);
        }, {name: 'terminal: ' + type});
    };

    const fromRawTokens = () => toTokenParser("filtered", c.many(
        c.choice([
            c.skip1(terminal("error")).mapResult((_, state, lastState) => {
                const stream = state.shared.input;
                const text = state.shared.text;
                
                assert(lastState.index < stream.length && lastState.index >= 0);
                assert(state.index - 1 < stream.length && state.index - 1 >= 0);

                const begin = stream[lastState.index].ib;
                const end = stream[state.index - 1].ie;
                
                return Token("error", text.slice(begin, end), lastState.index, state.index - 1);
            }),
            
            c.anySingle().mapResult((result, state, lastState) => {
                if(result.type === "space")
                    return undefined;
                
                return Token(result.type, result.val, lastState.index, state.index);
            })
        ])
    ));

    const classifyToken = (type, state, lastState) => {
        const result = state.result;
        const lasti = lastState.index;
        const nexti = state.index;
        const inputLen = state.shared.input.length;

        if(lasti >= inputLen)
        {
            state.result = Token(type, result, inputLen, inputLen);
            return state;
        }

        const stream = state.shared.input;
        const bToken = stream[lasti];
        if(nexti >= inputLen)
            state.result = Token(type, result, bToken.ib, last(stream).ie);
        else if(nexti === lasti)
            state.result = Token(type, result, bToken.ib, bToken.ie);
        else
        {
            const eToken = state.shared.input[nexti - 1];
            state.result = Token(type, result, bToken.ib, eToken.ie);
        }

        return state;
    };

    const name = (composition, parser) => new c.Parser(state => {
        state.name = composition;
        return parser.parse(state);
    }, {name: composition});

    const classify = (composition, parser) => new c.Parser(state => {
        state.name = composition;
        const nextState = parser.parse(state);
        if(nextState.error)
            return nextState;

        return classifyToken(composition, nextState, state);
    }, {name: composition});


    // const separated = (type, val = undefined) => c.separated(terminal(type, val));
    // const separatedTrailing = (type, val = undefined) => c.separatedTrailing(terminal(type, val));
    // const commaSeparated = separatedTrailing("op", ',');
    // const semicolSeparated = separatedTrailing('semicol');

    const betweenBrackets = (type, begin, end) => c.between(terminal(type, begin), terminal(type, end));
    const betweenSquareBrackets = betweenBrackets('squareB', '[', ']');
    const betweenCurlyBrackets = betweenBrackets('curlyB', '{', '}');
    const betweenRoundBrackets = betweenBrackets('roundB', '(', ')');

    const exprValue = name("exprValue", c.lazy(() => c.choice([
        terminal("op"),
        terminal("num"),
        terminal("id"),
        parensParser,
        matrixParser,
        arrayParser,
        scopeParser,
    ])));

    const addImplicitOperators = (state, results) => {
        const currToken = state.result;
        const lastToken = results[results.length - 1];

        if(!lastToken || !areAdjecent(lastToken, currToken) || tokenIs(currToken, "op"))
             return;

        if(tokenIs(lastToken, "num"))
        {
            results.push(Token("op", "$$*", currToken.ib, currToken.ib));
            return;
        }

        switch(currToken.type)
        {
            // case "id":
            //     if(tokenHas(lastToken, "op", '.'))
            //         lastToken.val = "$$.";
            //     return;

            case "parens":
                if(!tokenIs(lastToken, "op"))
                    results.push(Token("op", "$$()", currToken.ib, currToken.ib));
                return;

            case "array":
                if(!tokenIs(lastToken, "op"))
                    results.push(Token("op", "$$[]", currToken.ib, currToken.ib));
        }
    };

    const formPost = token => token.val = postOpTransf(token.val);
    const formPre = token => token.val = preOpTransf(token.val);

    const classifyOperators = (exprMembers) => {
        for(let i = 0; i < exprMembers.length; i++)
        {
            const curr = exprMembers[i];
            if(curr.type !== "op")
                continue;

            const category = OPERATOR_PROPERTIES[curr.val];
            assert(category);

            const last = exprMembers[i - 1];
            const next = exprMembers[i + 1];

            const isPost = last && areAdjecent(last, curr);
            const isPre = next && areAdjecent(curr, next);

            if(category.bin)
            {
                if(isPost && isPre)
                {}
                else if(category.post && isPost)
                    formPost(curr);
                else if(category.pre && isPre)
                    formPre(curr);
            }
            else
            {
                if(category.post && isPost)
                    formPost(curr);
                else if(category.pre && isPre)
                    formPre(curr);
                else if(isPre)
                    formPre(curr);
                else
                    formPost(curr);
            }

            curr.prop = OPERATOR_PROPERTIES[curr.val];
        }
    };

    const exprParser = classify("expr", new c.Parser(state => {
        const results = [];
        let lastState = state;
        while(true)
        {
            const currState = exprValue.parse(lastState);
            if(currState.error)
                break;

            addImplicitOperators(currState, results);
            lastState = currState;
            results.push(lastState.result);
        }

        classifyOperators(results);
        return c.updateParserResult(lastState, results);
    }));

    const scopeValue = name("scopeValue", c.many(
        exprParser.judge(res => res.val.length > 0 ? 0 : 1))
    );

    const parensParser = classify("parens", betweenRoundBrackets(exprParser));
    const arrayParser =  classify("array", betweenSquareBrackets(exprParser));
    const matrixParser = classify("matrix", betweenSquareBrackets(betweenSquareBrackets(exprParser)));
    const scopeParser =  classify("scope", betweenCurlyBrackets(scopeValue));
    const scriptParser = classify("scope", c.errorInfo(scopeValue.append(terminal("eof").discard())));

    const preParse = (input) =>
    {
        const tokens = tokenizer.run(input);
        const filtered = fromRawTokens().run(tokens.result, {text: input});
        const parsed = scriptParser.run(filtered.result.val);
        console.log(parsed);
        // console.log(tokens);
        // console.log(filtered);
        return parsed;
    };

    const Context = (name = '', last = {}, env = {}) => ({name, last, env});
    const pushContext = (context, name = context.name) => Context(name, context, context.env);
    const pushTokenContext = (context, token) => pushContext(context, token.type);

    function tidy(token, context = Context()) 
    {
        if(token.tidy)
            return token;

        let ret;
        switch(token.type)
        {
            case "expr": ret = tidyExpr(token, context); break;
            case "array": ret = tidyArray(token, context); break; 
            case "matrix": ret = tidyMatrix(token, context); break; 
            case "parens": ret = tidyParens(token, context); break;
            case "op": 
            case "digit": 
            case "id": ret = token; break;
            default: ret = tidyRecursive(token, context); break;
        }
        ret.tidy = true;
        return ret;
    }

    function tidyRecursive(token, context)
    {
        const val = token.val;
        if(!Array.isArray(val))
            return token;
    
        const ret = new Array(val.length);
        const newC = pushTokenContext(context, token);
        for(let i = 0; i < val.length; i++)
            ret[i] = tidy(val[i], newC);

        return copyToken(token, ret);
    }

    const formExprVals = (operator, args, val = operator.val) => {
        const lookup = copyToken(operator, val);
        lookup.type = "lookup";
        if(args.length === 0)   
            return [lookup, Token("args", [])];
        
        const first = args[0];
        const last = args[args.length - 1];
        return [lookup, Token("args", args, first.ib, last.ie)];
    };


    function popExpr(operator, values, context)
    {
        const op = tidy(operator);
        if(operator.prop.bin)
        {   
            if(values.length < 2) //@temp
                throw new Error(`Operator ${operator.val} requires two values to be aplied to`);

            let cont = context;
            if(operator.val === "$$()")
                cont = pushContext(context, "$$()");

            const right = tidy(values.pop(), cont);
            const left = tidy(values.pop(), context);
            const exprVal = formExprVals(op, [left, right]);
            const exprf = Token("exprf", exprVal, left.ib, right.ie);
            exprf.tidy = true;
            return exprf;
        }

        if(values.length == 0) //@temp
            throw new Error(`Operator ${operator.val} requires a value to be aplied to`);

        const val = tidy(values.pop(), context);

        if(val.type == "op") //@temp
            throw new Error(`Operator ${operator.val} cannot be applied to operator ${val.val}`);

        const exprVal = formExprVals(op, [val]);

        if(operator.prop.pre)
        {
            const exprf = Token("exprf", exprVal, op.ib, val.ie);
            exprf.tidy = true;
            return exprf;
        }
        else
        {
            const exprf = Token("exprf", exprVal, val.ib, op.ie);
            exprf.tidy = true;
            return exprf;
        }
    }

    function popSuffixes(tokens, context)
    {
        const out = [];
        for(let i = 0; i < tokens.length; i++)
        {
            const token = tokens[i];
            if(tokenIs(token, "op"))
            {
                assert(token.prop.post);
                if(out.length == 0) //@temp
                    throw new Error(`Operator ${token.val} requires a value to be aplied to`);

                const op = tidy(token, context);
                const to = tidy(out.pop(), context);
                const exprVal = formExprVals(op, [to]);
                const exprf = Token("exprf", exprVal, op.ib, to.ie);
                exprf.tidy = true;
                out.push(exprf);
            }
            else
            {
                out.push(token);
            }
        }

        return out;
    }

    function formExpr(tokens, context)
    {
        const vals = [];
        const ops = [];
        for(const token of tokens)
        {
            if(tokenIs(token, "op"))
            {
                if(context.last.name !== "scope" && token.val === ";")
                    throw new Error("Operator ; can only appear in scope contexts");

                const prop = token.prop;
                if(prop.bin)
                {
                    const prio = prop.prio;
                    if(prop.assoc === ASSOC.LEFT)
                    {
                        for(let top = last(ops); top && top.prop.prio >= prio; top = last(ops))
                        {
                            vals.push(popExpr(top, vals, context));
                            ops.pop();
                        }
                    }
                    else
                    {
                        for(let top = last(ops); top && top.prop.prio > prio; top = last(ops))
                        {
                            vals.push(popExpr(top, vals, context));
                            ops.pop();
                        }
                    }
                    ops.push(token);
                }
                else if(prop.post)
                    vals.push(token);
                else
                    ops.push(token);
            }
            else
            {
                vals.push(token);
            }
        }
        
        for(let top = ops.pop(); top; top = ops.pop())
            vals.push(popExpr(top, vals, context));
    
        const popped = popSuffixes(vals, context);
        return popped.map(x => tidy(x, context));
    }

    function tidyExpr(token, context)
    {
        const newC = pushTokenContext(context, token);
        const formed = formExpr(token.val, newC);
        assert(formed.length > 0);
        if(formed.length === 1)
            return formed[0];

        return copyToken(token, formed);
    }
    
    function tidyArray(token, context)
    {
        const items = splitExpr(token.val);
        const newC = pushTokenContext(context, token);

        const ret = new Array(items.length);
        for(let i = 0; i < items.length; i++)
            ret[i] = tidy(items[i], newC);

        return copyToken(token, ret);
    }
    
    function tidyMatrix(token, context)
    {
        const items = splitExpr(token.val);
        const rowsRet = new Array(items.length);
        const mtrxC = pushContext(context, token);
        mtrxC.env = mtrxC;
        
        assert(items.length > 0);

        for(let i = 0; i < items.length; i++)
        {
            const expr = items[i];
            assert(tokenIs(expr, "expr"));

            const row = Token("mtrxrow", [], expr.ib, expr.ie);
            const newC = pushContext(context, mtrxC);
            const exprs = tidyExpr(expr, newC);
            row.val = exprs.val;

            // if(newC.index < expr.val.length)
            // {
            //     const sub = expr.val;
            //     const rest = exprChildren.slice(newC.index);
            //     assert(sub.length > 0);

            //     const error = Token("error", rest, sub[newC.index].ib, sub[sub.length - 1].ie);
            //     row.val.push(tidy(error)); 
            // }

            rowsRet[i] = row;
        }

        return copyToken(token, rowsRet);
    }
    
    function tidyParens(token, context)
    {
        if(context.name !== "$$()")
            return tidyRecursive(token, context);

        const items = splitExpr(token.val, "op", ',', true);
        const newC = pushTokenContext(context, token);

        const ret = new Array(items.length);
        for(let i = 0; i < items.length; i++)
            ret[i] = tidy(items[i], newC);

        return copyToken(token, ret);
    }
  
    const splitExpr = (expr, type = "op", val = ',', keepTrailing = false) => {
        if(!tokenIs(expr, "expr"))
            return [expr];

        const members = expr.val;
        assert(Array.isArray(members));

        if(members.length === 0)
            return [expr];

        const res = fmt.split(members, member => tokenHas(member, type, val), 
            (out, from, to) => {
                out.push(Token("expr", members.slice(from, to), members[from].ib, members[to].ie));
            },
            (out, from, to) => {
                const last = members[members.length - 1];
                if(from !== to)
                    return out.push(Token("expr", members.slice(from, to), members[from].ib, last.ie));
                
                if(keepTrailing) 
                    out.push(Token("expr", [], last.ie, last.ie));
            }
        );

        return res;
    };

    const getErrorInfo = (parsed) => {
        const stream = parsed.shared.input;
        const text = parsed.shared.text;
        const distance = 5;
        if(stream.length <= parsed.index)
            return '';
            
        const errToken = stream[parsed.index];
        let ret = `{${errToken.type}: ${errToken.val}}\n`;

        const from = Math.max(errToken.ib - distance, 0);
        const to = Math.min(errToken.ie + distance, text.length);
        const locationMsg = 'in text: ';
        ret += locationMsg + text.slice(from, to) + '\n';
        ret += ' '.repeat(locationMsg.length + errToken.ib - from);
        ret += '^'.repeat(errToken.ie - errToken.ib) + '\n';
        
        return ret;
    };

    const parse = (input) =>
    {
        const tokens = tokenizer.run(input);
        const text = {text: input};
        const filtered = fromRawTokens().run(tokens.result, text);
        const parsed = scriptParser.run(filtered.result.val, text);
        console.log(parsed);
        if(parsed.error)
        {
            const err = parsed.singular.errorInfo + '\n' + fmt.offset(getErrorInfo(parsed));
            throw new Error(err);
        }

        const tidied = tidy(parsed.result);
        console.log(tidied);
        // console.log(tokens);
        // console.log(filtered);
        return tidied;
    };

    return {
        preParse,
        parse,
    };
}
