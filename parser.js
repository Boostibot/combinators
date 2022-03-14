function import_combinators(lib) 
{
    const obj = lib.object;

    const updateParserState = (state, result = state.result, index = state.index, error = state.error) => {
        return {
            index: index,
            result: result,
            error: error,
            shared: state.shared,
            singular: obj.copy(state.singular),
        };
    };

    const updateParserResult = (state, result, index = state.index) => {
        return {
            index: index,
            result: result,
            error: state.error,
            shared: state.shared,
            singular: obj.copy(state.singular),
        };
    };

    const updateParserError = (state, error) => {
        return {
            index: state.index,
            result: state.result,
            error: error,
            shared: state.shared,
            singular: obj.copy(state.singular),
        };
    };

    const pushResult = (results, result) => {
        if(result !== undefined)
            results.push(result);
    };

    class Parser 
    {
        constructor(parse) {
            this.parse = parse;
        }

        run(input) {
            const initialState = {
                index: 0,
                result: null,
                error: 0,
                shared: {
                    input: input
                }
            };

            return this.parse(initialState);
        }

        map(fn) {
            return new Parser((prevState) => {
                const nextState = this.parse(prevState);
                return fn(nextState, prevState);
            });
        }
        
        mapResult(fn) {
            return this.map((state, prevState) => {
                if(state.error)
                    return state;

                //since any parser copies we dont have to
                state.result = fn(state.result, state, prevState);
                return state;
            });
        }
        
        mapError(fn) {
            return this.map((state, prevState) => {
                if(!state.error)
                    return state;

                state.error = fn(state.error, state, prevState);
                return state;
            });
        }

        chain(fn) {
            return new Parser(state => {
                const nextState = this.parse(state);

                if(nextState.error)
                    return nextState;

                const nextParser = fn(state.result, nextState, state);
                return nextParser.parse(nextState);
            });
        }

        discard() {
            return this.mapResult(_ => undefined);
        }

        maybe() {
            return this.map(state => {
                state.error = 0;
                return state;
            });
        }
        
        ignore() {
            return this.map(state => {
                state.result = undefined;
                state.error = 0;
                return state;
            });
        }
    }
 
    const ParserId = {
        PARSER_SEQUENCE: 1,
        MANY: 2,
        REPEAT: 3,
        LEAST: 4,
        CHOICE: 5,
        CATEGORY: 6,
        SLICE: 7,
        REGEX: 8,
        TOKEN_SEQUENCE: 9,
        SINGLE: 10,
        SEQUENCE: 11,
        BETWEEN: 12,
        SEPARATED: 13,
        EACH: 14,
        FURTHEST: 15,
        GREEDY: 16,
        LAZY: 17,
        STRING: 18,
        MANY1: 19,
        CATEGORY1: 20,
        SEPARATED1: 21,
        ANY: 22,
        SUCCEED: 23,
        FAIL: 24,
        SINGLE_CATEGORY: 25,
    };

    const shiftParserIds = parserIds => {
        for(const name in parserIds)
            parserIds[name] = parserIds[name] << 16;
    };

    shiftParserIds(ParserId);

    const parserSequnce = parsers => new Parser(state => {
        if(state.error)
            return state;

        const results = [];
        let nextState = state;

        for (let parser of parsers)
        {
            nextState = parser.parse(nextState);
            if(nextState.error)
                break;

            pushResult(results, nextState.result);
        }

        return updateParserResult(nextState, results);
    });

    const manyRegular = (parser) => new Parser(state => {
        if(state.error)
            return state;

        const results = [];
        let lastState = state;
        while(true)
        {
            const currState = parser.parse(lastState);
            if(currState.error)
                break;

            lastState = currState;
            pushResult(results, lastState.result);
        }

        return updateParserResult(lastState, results);
    });
    
    const manyChain = (parser, inspection) => new Parser(state => {
        if(state.error)
            return state;

        const results = [];
        let curr_parser = parser;
        let lastState = state;
        while(true)
        {
            const currState = curr_parser.parse(lastState);
            if(currState.error)
                break;

            curr_parser = inspection(currState, results, lastState);
            if(currState.error)
                break;

            lastState = currState;
            pushResult(results, lastState.result);
        }

        return updateParserResult(lastState, results);
    });

    const many = (parser, inspection = undefined) => {
        if(inspection === undefined)
            return manyRegular(parser);
        else
            return manyChain(parser, inspection);
    };

    const repeat = (times, parser) => new Parser(state => {
        if(state.error)
            return state;

        const results = [];
        let nextState = state;

        for (let i = 0; i < times; i++)
        {
            const currState = parser.parse(nextState);
            if(nextState.error)
                break;

            nextState = currState;
            pushResult(results, nextState.result);
        }

        return updateParserResult(nextState, results);
    });

    // state.error = `Unable to match with any inputs at index ${state.index}`;
    const least = parser => parser.map(state => {
        if(state.result.length === 0)
            state.error = ParserId.LEAST;
        
        return state;
    });

    const choice = parsers => new Parser(state => {
        if(state.error)
            return state;
        
        for (let parser of parsers)
        {
            const nextState = parser.parse(state);
            if(!nextState.error)
                return nextState;
        }
        
        // return updateParserError(state, `Unable to match with any parser at index ${state.index}`);
        return updateParserError(state, ParserId.CHOICE);
    });

    const category = cat => new Parser(state => {
        if(state.error)
            return state;

        let curr = state.index;
        const shared = state.shared;
        const len = shared.input.length;
        for(; curr < len; curr++)
        {
            if(!(shared.input[curr] in cat))
                break;
        }
        
        return updateParserResult(state, shared.input.slice(state.index, curr), curr);
    });
    
    const singleCategory = cat => new Parser(state => {
        if(state.error)
            return state;

        const shared = state.shared;
        const index = state.index;
        if(index >= shared.input.length)
            return updateParserError(state, ParserId.SINGLE_CATEGORY);
            // return updateParserError(state, `Could not match ${format(seq)}: Unexpected end of shared`);
        
        if(!(shared.input[index] in cat))
            return updateParserError(state, ParserId.SINSINGLE_CATEGORYGLE + 1);
            // return updateParserError(state, `Tried to match sequence ${format(token)} but got ${format(shared.slice(index, index + 5))}`);
        
        return updateParserResult(state, token, index + 1);
    });

    const slice = s => new Parser(state => {
        if(state.error)
            return state;

        const shared = state.shared;
        const index = state.index;
        const sliced = shared.input.slice(index, index + s.length);
        if(sliced === s)
            return updateParserResult(state, s, index + s.length);
        
        // return updateParserError(state, `Tried to match ${format(s)} but got ${format(sliced.slice(0, s.length + 5))}`);
        return updateParserError(state, ParserId.SLICE);
    });

    const regex = (reg, max_offset = undefined) => new Parser(state => {
        if(state.error)
            return state;

        const shared = state.shared;
        const index = state.index;
        const sliced = max_offset ? shared.input.slice(index, index + max_offset) : shared.input.slice(index);
        if(sliced.length === 0)
            return updateParserError(state, ParserId.REGEX);
        // return updateParserError(state, `Could not match ${format(reg)}: Unexpected end of shared`);

        const match = sliced.match(reg);
        if(!match)
        return updateParserError(state, ParserId.REGEX + 1);
        // return updateParserError(state, `Tried to match regex ${format(reg.toString())} but got ${format(sliced.slice(0, 10))}`);

        return updateParserResult(state, match[0], index + match[0].length);
    });

    const tokenSequence = seq => new Parser(state => {
        if(state.error)
            return state;

        const shared = state.shared;
        const index = state.index;
        const end = index + seq.length;
        if(shared.input.length < end)
            return updateParserError(state, ParserId.TOKEN_SEQUENCE);
            // return updateParserError(state, `Could not match ${format(seq)}: Unexpected end of shared`);

        for(let i = 0; i < seq.length; i++)
        {
            if(seq[i] !== shared.input[index + i])
            return updateParserError(state, ParserId.TOKEN_SEQUENCE + 1);
            // return updateParserError(state, `Tried to match sequence ${format(seq)} but got ${format(shared.slice(index, end + 5))}`);
        }
        
        return updateParserResult(state, seq, end);
    });
    
    const single = token => new Parser(state => {
        if(state.error)
            return state;

        const shared = state.shared;
        const index = state.index;
        if(index >= shared.input.length)
            return updateParserError(state, ParserId.SINGLE);
            // return updateParserError(state, `Could not match ${format(seq)}: Unexpected end of shared`);
        
        if(shared.input[index] !== token)
            return updateParserError(state, ParserId.SINGLE + 1);
            // return updateParserError(state, `Tried to match sequence ${format(token)} but got ${format(shared.slice(index, index + 5))}`);
        
        return updateParserResult(state, token, index + 1);
    });

    const succeed = (result = undefined) => 
    {
        if(result === undefined)
            return new Parser(state => {
                return state;
            });
        else
            return new Parser(state => {
                return updateParserResult(state, result);
            });
    };
    
    const fail = (error = undefined) => 
    {
        if(error === undefined)
            error = ParserId.FAIL;
        return new Parser(state => {
            return updateParserError(state, error);
        });
    };

    const anySingle = () => new Parser(state => {
        if(state.error)
            return state;

        const shared = state.shared;
        const index = state.index;
        if(index >= shared.input.length)
            return updateParserError(state, ParserId.ANY);
            // return updateParserError(state, `Could not match ${format(seq)}: Unexpected end of shared`);
        
        return updateParserResult(state, shared.input[index], index + 1);
    });

    const sequence = seq => {
        if(seq.length > 0 && 
           typeof(seq[0]) == "object" && 
           seq[0].constructor.name == "Parser")
            return parserSequnce(seq);
        else
            return tokenSequence(seq);
    };

    const between = (left, right) => parser => parserSequnce([
        left,
        parser,
        right
    ]).mapResult(results => results[1]);
    
    const separated = separator => parser => new Parser(state => {
        if(state.error)
            return state;

        const results = [];
        let nextState = state;
        while(true)
        {
            nextState = parser.parse(nextState);
            if(nextState.error)
                break;
            pushResult(results, nextState.result);
                
            const separatorState = separator.parse(nextState);
            if(separatorState.error)
                break;
                
            nextState = separatorState;
        }

        return updateParserResult(nextState, results);
    });

    const separatedTrailing = separator => parser => new Parser(state => {
        if(state.error)
            return state;

        const results = [];
        let nextState = state;
        while(true)
        {
            const parsed = parser.parse(nextState);
            if(parsed.error)
                break;

            nextState = parsed;
            pushResult(results, parsed.result);

            const separatorState = separator.parse(nextState);
            if(separatorState.error)
                break;
                
            nextState = separatorState;
        }

        return updateParserResult(nextState, results);
    });

    const paralel = parsers => new Parser(state => {
        if(state.error)
            return state;

        const states = new Array(parsers.length);
        for(let i = 0; i < parsers.length; i++)
            states[i] = parsers[i].parse(state);

        return updateParserResult(nextState, results);
    });
    
    const furthest = parsers => new Parser(state => {
        if(state.error)
            return state;

        if(parsers.length == 0)
            return state;

        let furthestState = parsers[0].parse(state);
        for(let i = 1; i < parsers.length; i++)
        {
            const last = parsers[i].parse(state);
            if(!last.error && last.index > furthestState.index)
                furthestState = last;
        }

        return updateParserState(furthestState);
    });
    
    const greedy = parsers => new Parser(state => {
        if(state.error)
            return state;

        if(parsers.length == 0)
            return state;

        let next_state = state;
        let results = [];
        while(true)
        {
            let furthestState = parsers[0].parse(next_state);
            for(let i = 1; i < parsers.length; i++)
            {
                const last = parsers[i].parse(next_state);
                if(!last.error && last.index > furthestState.index)
                    furthestState = last;
            }
            
            //If havent moved => break
            if(furthestState.index == next_state.index)
                break;

            next_state = furthestState;
            pushResult(results, next_state.result);
        }
        
        return updateParserState(next_state, results);
    });

    const lazy = parserThunk => new Parser(state => {
        const parser = parserThunk();
        return parser.parse(state);
    });

    const string = slice;
    const many1 = (parser, inspection = undefined) => least(many(parser, inspection));
    const category1 = parser => least(category(parser));
    const separated1 = separator => parser => least(separated(separator)(parser));
    
    const lettersReg = /^[A-Za-z_]+/;
    const identifiersReg = /^[a-zA-Z_]+[a-zA-Z0-9_]*/;
    const digitsReg = /^[0-9]+/;
    const whitespacesReg = /^\s+/;

    const letters = (max_offset = undefined) => regex(lettersReg, max_offset);
    const identifiers = (max_offset = undefined) => regex(identifiersReg, max_offset);
    const digits = (max_offset = undefined) => regex(digitsReg, max_offset);
    const whitespace = (max_offset = undefined) => regex(whitespacesReg, max_offset);

    return {
        Parser,
        parserSequnce,
        many,
        least,
        choice,
        repeat,
        category,
        regex,
        tokenSequence,
        slice,
        sequence,
        between,
        lazy,
        string,
        category1,
        many1,
        letters,
        identifiers,
        digits,
        whitespace,
        separated,
        separatedTrailing,
        separated1,
        single,
        singleCategory,
        paralel,
        furthest,
        greedy,
        anySingle,
        updateParserState,
        updateParserResult,
        updateParserError,
        pushResult,
        ParserId,
        succeed,
        fail,
    };
}

{
    const IDS = {};
    const PROPERTIES = {};

    const getId = (fn, ids = IDS) => ids[fn.name];
    const getPropeties = (id, properties = PROPERTIES) => properties[id];

    const errorInfo = (parser, properties = PROPERTIES) => parser.mapError((error, state) => {
        const retrieved = getPropeties(error, properties);
        if(retrieved === undefined)
            state.singular.errorInfo = undefined;
        else
            state.singular.errorInfo = retrieved.handler(state);

        return error;
    });

    const registerParser = (parser, handler, info = {}, name = parser.name, collection = {ids: IDS, properties: PROPERTIES}) => 
    {
        if(collection.ids.length > (1 << 16))
            throw new Error("Max of 65536 parsers allowed");

        const addedId = collection.ids.length << 16;
        collection.ids[parser.name] = addedId;
        collection.properties[addedId] = {name: name, parser: parser, handler: handler, info: info};
    };
}

function import_parsers(lib)
{
    const c = import_combinators(lib);

    const stringToCategory = string => {
        let ret = {};
        for(let i = 0; i < string.length; i++)
            ret[string[i]] = null;

        return ret;
    };

    const cat = {
        DECIMAL: stringToCategory(".0123456789"),
    };

    const paired = 'paired';
    const unary = 'unary';
    const mixed = 'mixed';
    const implicit = 'implicit';

    const opRow = (pairity, typeSimetric, types) => {

        const addKeyPair = (obj, from, to) => {
            if(!(from in obj))
                row.types[from] = {};

            row.types[from][to] = null;
        };

        const row = {pairity: pairity, types: {}};
        for(const from of Object.keys(types))
        {
            const to = types[from];
            
            if(Array.isArray(to))
            {
                for(const toSingle of to)
                {
                    addKeyPair(row.types, from, toSingle);
                    if(typeSimetric)
                        addKeyPair(row.types, toSingle, from);
                }
            }
            else if(to && typeof(to) === 'object')
                continue;
            else
            {
                addKeyPair(row.types, from, to);
                if(typeSimetric)
                    addKeyPair(row.types, to, from);
            }
        }

        return row;
    };

    const operators = {
        '+': opRow(mixed, true, {'num': 'num', 'matrix': 'matrix'}),
        '-': opRow(mixed, true, {'num': 'num', 'matrix': 'matrix'}),
        '*': opRow(mixed, true, {'num': ['num', 'matrix'], 'matrix': ['num', 'matrix']}),
        '/': opRow(paired, true, {'num': 'num', 'matrix': ['num', 'matrix']}),
        '^': opRow(paired, true, {'num': 'num', 'matrix': 'num'}),
        '%': opRow(paired, true, {'num': 'num', 'matrix': 'matrix'}),
        '!': opRow(unary, true, {'num': 'num'}),
        '~': opRow(unary, true, {'num': 'num'}),
        '^|': opRow(paired, true, {'num': 'num'}),
        '<<': opRow(paired, true, {'num': 'num'}),
        '>>': opRow(paired, true, {'num': 'num'}),
        
        '&&': opRow(paired, true, {'num': 'num'}),
        '||': opRow(paired, true, {'num': 'num'}),
        
        '++': opRow(paired, true, {'num': 'num'}),
        '--': opRow(paired, true, {'num': 'num'}),
        
        ':=': opRow(paired, false, {'unset': ['num', 'array', 'matrix']}),
        '=': opRow(paired, false, {'num': 'num', 'array': 'array', 'matrix': 'matrix'}),
        '+=': opRow(paired, true, {'num': 'num', 'matrix': 'matrix'}),
        '-=': opRow(paired, true, {'num': 'num', 'matrix': 'matrix'}),
        '*=': opRow(paired, false, {'num': 'num', 'matrix': ['num', 'matrix']}),
        '/=': opRow(paired, false, {'num': 'num', 'matrix': 'num'}),
        '^=': opRow(paired, true, {'num': 'num', 'matrix': 'num'}),
        '%=': opRow(paired, true, {'num': 'num'}),
        '&=': opRow(paired, true, {'num': 'num'}),
        '|=': opRow(paired, true, {'num': 'num'}),
        '^|=': opRow(paired, true, {'num': 'num'}),
        '<<=': opRow(paired, true, {'num': 'num'}),
        '>>=': opRow(paired, true, {'num': 'num'}),

        '==': opRow(paired, true, {'num': 'num', 'array': 'array', 'matrix': 'matrix'}),
        '!=': opRow(paired, true, {'num': 'num', 'array': 'array', 'matrix': 'matrix'}),
        '>': opRow(paired, true, {'num': 'num'}),
        '<': opRow(paired, true, {'num': 'num'}),
        '>=': opRow(paired, true, {'num': 'num'}),
        '<=': opRow(paired, true, {'num': 'num'}),

        //TODO
        '?': opRow(paired, true, {'unset': 'unset'}),
        ':': opRow(paired, true, {'unset': 'unset'}),
    };

    const isOperatorDefined = (op, left, right) => 
    {
        const properties = operators[op];

        const fromType = properties.types[left];
        if(fromType === undefined)
            return false;

        return fromType[right] !== undefined;
    };

    c.ParserId.TOKEN = 500;
    c.ParserId.EXPR_SEQUENCE = 501;
    c.ParserId.MATCH_OPERATORS = 502;
    c.ParserId.EXPR_PARSER = 503;

    const makeToken = (type, value = null, ib = 0, ie = 0) => ({type: type, value: value, ib: ib, ie: ie});



    const isToken = (token) => {
        return (typeof(token) === 'object') && (token !== null) && ('ib' in token) && ('type' in token) && ('value' in token);
    };

    const formatToken = (token, newline = '\n', offsetWith = '   ', padTypeTo = 0, padSizeTo = 0, offsetLevel = 0) =>
    {
        if(!token)
            return '';

        const type = `'${token.type}'`.padEnd(padTypeTo);
        const size = `(${token.ib}, ${token.ie})`.padEnd(padSizeTo);

        const isT = isToken(token.value);
        const isA = Array.isArray(token.value);

        if(!isT && !isA)
            return `{${type} ${size} : ${lib.debug.format(token.value)}}`;
            
        const offset = offsetWith.repeat(offsetLevel);
        const formatSingle = (token) => offset + offsetWith + formatToken(token, newline, offsetWith, 0, 0, offsetLevel + 1);

        if(isT)
            return `{${type} ${size} : {..}}${newline + formatSingle(token.value)}`;

        if(isA)
        {
            if(token.value.length === 0)
                return `{${type} ${size} : []}`;

            if(token.value.length === 1)
                return `{${type} ${size} : [..]}${newline + formatSingle(token.value[0])}`;

            let maxTypeLen = 0;
            let maxSizeLen = 0;
            for(const value of token.value)
            {
                if(value.type.length > maxTypeLen)
                    maxTypeLen = value.type.length;

                const combined = value.ib.toString().length + value.ie.toString().length;
                if(combined > maxSizeLen)
                    maxSizeLen = combined;
            }

            //Because of formating
            maxTypeLen += 2;
            maxSizeLen += 4;

            let accumulated = `{${type} ${size}} : [` + newline;
            const ender = ',' + newline;
            const greaterOffset = offset + offsetWith;
            for(const value of token.value)
                accumulated += greaterOffset + formatToken(value, newline, offsetWith, maxTypeLen, maxSizeLen, offsetLevel + 1) + ender;

            accumulated += offset + ']';
            return accumulated;    
        }    

    };

    const toToken = (type, parser) => parser.map((state, lastState) => {
        if(!state.error)
        {
            const result = state.result;
            const lasti = lastState.index;
            state.result = makeToken(type, result, lasti, lasti + result.length);
        }

        return state;
    });

    const reportState = (name, parser) => parser.map(state => {
        // if(state.error)
            // console.log(`${name}: FAIL`);

        // console.log(`${name}: SUCCESS`);
        return state;
    });

    const last = array => array[array.length - 1];

    const makeOperatorValue = (category, result) => ({category: category, value: result});
    const makeOperator = (category, result, ib, ie) => makeToken("operator", makeOperatorValue(category, result), ib, ie);

    const generateOperatorParsers = (operators) => {
        const parsers = [];
        for(const [op, row] of Object.entries(operators))
        {
            const parser = c.slice(op).mapResult(result => makeOperatorValue(row.pairity, result));
            parsers.push(parser);
        }

        return parsers;
    };

    const operatorParsers = () => c.furthest(generateOperatorParsers(operators));

    const tokenizer = c.greedy([
        toToken("space", c.whitespace()),
        toToken("id", c.identifiers()),
        toToken("operator", operatorParsers()),
        toToken("roundB", c.single('(')),
        toToken("roundB", c.single(')')),
        toToken("squareB", c.single('[')),
        toToken("squareB", c.single(']')),
        toToken("curlyB", c.single('{')),
        toToken("curlyB", c.single('}')),
        toToken("comma", c.single(',')),
        toToken("semicol", c.single(';')),
        toToken("decimal", c.category1(cat.DECIMAL)),
        // c.anySingle().mapResult((result, state) => {
        //     const tokenizeErrors = state.shared.tokenizeErrors;
        //     if(tokenizeErrors === undefined)
        //         state.shared.tokenizeErrors = {last: }
        // })
    ]);

    const token = (type, value = undefined) => {
        if(value !== undefined)
            return new c.Parser(state => 
            {
                const index = state.index;
                const token = state.shared.input[index];
                if(token != undefined && (token.type === type && token.value === value))
                    return c.updateParserResult(state, token, index + 1);

                return c.updateParserError(state, c.ParserId.TOKEN);
            });
        
        return new c.Parser(state => 
        {
            const index = state.index;
            const token = state.shared.input[index];

            if(token != undefined && (token.type === type))
                return c.updateParserResult(state, token, index + 1);

            return c.updateParserError(state, c.ParserId.TOKEN);
        });
    };

    const filterWhitespace = () => toToken("filtered", c.many(c.anySingle().mapResult((result, state, lastState) => {
        if(result.type === "space")
            return undefined;
        
        return makeToken(result.type, result.value, lastState.index, state.index);
    })));

    const classify = (type, parser) => parser.map((state, lastState) => {
        if(state.error)
        {
            // console.log(`${type}: FAIL`);
            return state;
        }
        // console.log(`${type}: SUCCESS`);
    
        const result = state.result;
        const lasti = lastState.index;
        const nexti = state.index;
        const inputLen = state.shared.input.length;

        if(lasti >= inputLen)
        {
            state.result = makeToken(type, result, inputLen, inputLen);
            return state;
        }

        const bToken = state.shared.input[lasti];
        if(nexti >= inputLen)
            state.result = makeToken(type, result, bToken.ib, inputLen);
        else if(nexti === lasti)
            state.result = makeToken(type, result, bToken.ib, bToken.ie);
        else
        {
            const eToken = state.shared.input[nexti - 1];
            state.result = makeToken(type, result, bToken.ib, eToken.ie);
        }

        return state;
    });

    const separated = (type, value = undefined) => c.separated(token(type, value));
    const separatedTrailing = (type, value = undefined) => c.separatedTrailing(token(type, value));
    const betweenBrackets = (type, begin, end) => c.between(token(type, begin), token(type, end));
    const commaSeparated = separatedTrailing('comma');
    const semicolSeparated = separatedTrailing('semicol');
    const betweenSquareBrackets = betweenBrackets('squareB', '[', ']');
    const betweenCurlyBrackets = betweenBrackets('curlyB', '{', '}');
    const betweenRoundBrackets = betweenBrackets('roundB', '(', ')');

    const valueParser = reportState("value", c.choice([
        token("decimal"),
        token("id"),
    ]));

    const listValue = reportState("listVal", c.lazy(() => c.furthest([
        valueParser,
        matrixParser,
        arrayParser,
        parensParser,
        scopeParser,
        exprParser,
    ])));
    
    const matrixRowParser = classify("matrixRow", c.lazy(() => c.many1(
        listValue
    )));

    const operatorOrListValue = reportState("opOrlistVal", c.lazy(() => c.choice([
        token("operator"),
        valueParser,
        matrixParser,
        arrayParser,
        parensParser,
        scopeParser,
    ])));

    const areAdjecent = (token1, token2) => token1.ie === token2.ib;

    const exprParser = classify("expression", c.lazy(() => c.many1(
        operatorOrListValue,
        (state, results) => {
            const lastToken = last(results);
            const result = state.result;
            if(lastToken != undefined && lastToken.type !== "operator" && result.type !== "operator")
            {
                //Array front inplicit multiplication is dissallowed (needed to distinguish between
                // element access and array multiplication)
                if(areAdjecent(lastToken, result) && result.type != "array")
                {
                    const implicitMultiply = makeOperator("implicit", "*", result.ib, result.ib);
                    results.push(implicitMultiply);
                }
                else
                    state.error = c.ParserId.EXPR_PARSER;
            }
            
            return operatorOrListValue;
        }
    )));

    //this choice will never fail but if it ends with semicol
    // adds a void value in the end ie: 
    // {0; 0; 0;} -> {0; 0; 0; void}
    // {0; 0; 0} -> {0; 0; 0}
    const sequenceValue = c.lazy(() => c.choice([
        listValue,
        c.succeed(makeToken("void"))
    ]));

    const scopeValue = c.lazy(() => c.choice([
        scopeParser,
        sequenceParser,
    ]));

    const sequenceParser = classify("sequence", semicolSeparated(sequenceValue).map(state => {
        if(state.result[0].type === "void")
            state.error = c.ParserId.EXPR_SEQUENCE;

        return state;
    }));

    const parensParser = classify("parens", betweenRoundBrackets(listValue).mapResult(result => [result]));
    const arrayParser =  classify("array", betweenSquareBrackets(commaSeparated(listValue)));
    const matrixParser =  classify("matrix", betweenSquareBrackets(betweenSquareBrackets(commaSeparated(matrixRowParser))));
    const scopeParser =  classify("scope", betweenCurlyBrackets(c.many(scopeValue)));

    
    const parse = (input) =>
    {
        const tokens = tokenizer.run(input);
        const noWhitespace = filterWhitespace().run(tokens.result);
        const filtered = scopeValue.run(noWhitespace.result.value);
        return filtered;
    };

    const makeValue = (type, value = null) => ({type: type, value: value});
    const makeVoidValue = () => makeToken("void");
    const makeUnsetValue = () => makeValue("unset", null);

    const makeScopeContext = (outer = {local: {}, outer: {}}) => {
        const outerCombined = Object.assign({}, outer.outer);
        Object.assign(outerCombined, outer.local);

        return {local: {}, outer: outerCombined};
    }; 

    const scopeGet = (scope, what) => {
        const local = scope.local[what];
        if(local !== undefined)
            return local;
        
        return scope.outer[what];
    };
    
    const scopeSet = (scope, what, value) => {
        scope.local[what] = value;
    };

    const copy = object => lib.object.copy(object);

    const add = (left, right) => {
        if(left.type == 'matrix')
            return matrixAddMatrix(left, right);
        
        return makeValue("num", left.value + right.value);
    };

    const sub = (left, right) => {
        if(left.type == 'matrix')
        {
            const negative = matrixMulVal(right, -1);
            return matrixAddMatrix(left, negative);
        }
        
        return makeValue("num", left.value - right.value);
    };

    const mul = (left, right) => {
        const lt = left.type;
        const rt = right.type;

        if(lt == 'matrix' && rt == 'matrix')
            return matrixMulMatrix(left, right);

        if(lt == 'num' && rt == 'matrix')
            return matrixMulVal(right, left.value);
        
        if(lt == 'matrix' && rt == 'num')
            return matrixMulVal(left, right.value);
        
        return makeValue("num", left.value * right.value);
    };
    
    const div = (left, right) => {
        const lt = left.type;
        const rt = right.type;

        if(lt == 'matrix' && rt == 'num')
            return matrixMulVal(left, 1 / right.value);
        
        return makeValue("num", left.value / right.value);
    };

    const arrayToPlain = array => {
        const arrayRes = [];

        for(const val of array.value)
            arrayRes.push(toPlain(val));

        return arrayRes;
    }; 

    const matrixToPlain = matrix => {
        const matrixRes = [];

        for(const rows of matrix.value)
        {
            const rowRes = [];
            for(const col of rows)
                rowRes.push(col.value);

            matrixRes.push(rowRes);
        }

        return matrixRes;
    };

    
    const toPlain = (token) => {
        if(token.type === 'matrix')
            return matrixToPlain(token);
        if(token.type === 'array')
            return arrayToPlain(token);
        else
            return token.value;
    };

    const getTableFormat = (table, formatter = val => val.toString()) => {
        if(table.length === 0)
            return {rows: [], offsets: []};

        const valueTable = [];
        const maxOffsets = Array(table[0].length).fill(0);

        for(const row of table)
        {
            const valueRow = Array(row.length);
            for(let i = 0; i < row.length; i++)
            {
                valueRow[i] = formatter(row[i]);
                const len = valueRow[i].length;
                if(len > maxOffsets[i])
                    maxOffsets[i] = len;
            }

            valueTable.push(valueRow);
        }

        return {rows: valueTable, offsets: maxOffsets};
    };

    const formatMatrix = (matrix, newline = '\n', separate = ' ', offsetWith = '   ', offsetLevel = 0) =>
    {
        const tableFormat = getTableFormat(matrix.value, val => val.value.toString());

        const contextOffset = offsetWith.repeat(offsetLevel);
        let accumulated = contextOffset + '[[' + newline;

        for(const row of tableFormat.rows)
        {
            const len = row.length;
            if(len == 0)
                continue;

            accumulated += offsetWith + contextOffset + row[0].padStart(tableFormat.offsets[0]);
            for(let i = 1; i < len; i++)
                accumulated += separate + row[i].padStart(tableFormat.offsets[i]);
            
            accumulated += ',' + newline;
        }

        return accumulated + ']]';
    };
    
    const formatArray = (token, separate = ', ', offsetWith = '   ', offsetLevel = 0) =>
    {
        const contextOffset = offsetWith.repeat(offsetLevel);
        let accumulated = contextOffset + '[';

        const array = token.value;
        const len = array.length;
        if(len != 0)
        {
            accumulated += formatValue(array[0]);
            for(let i = 1; i < len; i++)
                accumulated += separate + formatValue(array[i]);
        }

        return accumulated + ']';
    };
    const formatValue = (token) => {
        switch(token.type)
        {
            case 'matrix': return formatMatrix(token);
            case 'array': return formatArray(token);
            case 'num': return token.value.toString();
            case 'unset': return 'unset';
            case 'void': return 'void';
            default: return '<error>';
        }
    };
    
    const plainToMatrix = plain => {
        return makeValue("matrix", plain.map((row) => 
            row.map(val => makeValue("num", val))));
    };

    const pow = (left, right) => {
        if(left.type == 'num')
            return makeValue("num", Math.pow(left.value, right.value));
        
        if(right.value !== -1)
            throw new Error("Currently only inverse matrix supported");

        const plain = matrixToPlain(left);
        const changed = gauss(plain);
        return plainToMatrix(changed);
    };


    const matrixMulVal = (matrix, val) => {
        const mcopy = copy(matrix);
        for(const row of mcopy.value)
            for(const col of row)
                col.value *= val;
        
        return mcopy;
    };

    
    const twoDArray = (n, m, filler = () => 0) =>
    {
        const resultValue = [];
        for(let i = 0; i < n; i++)
        {
            const row = new Array(m);
            for(let i = 0; i < m; i++)
                row[i] = filler();

            resultValue.push(row);
        }

        return resultValue;
    };

    const matrixMulMatrix = (matrix1, matrix2) => {
        const rows1 = matrix1.value;
        const rows2 = matrix2.value;

        if(rows1[0].length !== rows2.length)
            throw new Error(`Operator * cannot be applied on matrices of size ${rows1.length}x${rows1[0].length} * ${rows2.length}x${rows2[0].length}`);

        const resRows = rows1.length;
        const resCols = rows2[0].length;
        const sumOver = rows2.length;
        
        const resultValue = twoDArray(resRows, resCols, () => makeValue("num", 0));

        for(let i = 0; i < resRows; i++)
            for(let j = 0; j < resCols; j++)
            {
                let sum = 0;
                for(let k = 0; k < sumOver; k++)
                    sum += rows1[i][k].value *  rows2[k][j].value;

                resultValue[i][j].value = sum;
            }

        return makeValue("matrix", resultValue);
    };

    const matrixAddMatrix = (matrix1, matrix2) => {
        const mcopy = copy(matrix1);
        const rows1 = mcopy.value;
        const rows2 = matrix2.value;
        
        if(rows1.length !== rows2.length ||
            rows1[0].length !== rows2[0].length)
            throw new Error(`Operator +/- cannot be applied on matrices of size ${rows1.length}x${rows1[0].length} +/- ${rows2.length}x${rows2[0].length}`);

        const colCount = rows1[0].length;
        for(let i = 0; i < rows1.length; i++)
            for(let j = 0; j < colCount; j++)
                rows1[i][j].value += rows2[i][j].value;

        return mcopy;
    };

    const assign = (left, right) => {
        left.value = right.value;
        return copy(left);
    };
    
    const define = (left, right, scope) => {
        if(left.type !== "unset")
            throw new Error("Only previously undeclared ids can be declared");

        const rightCopy = copy(right);
        scopeSet(scope, left.value, rightCopy);
        return copy(right);


        
    };

    const performExpression = (left, op, right, scope) =>
    {
        const opText = op.value.value;

        if(!isOperatorDefined(opText, left.type, right.type))
            throw new Error(`Operator ${opText} cannot be applied on types <${left.type}> ${opText} <${right.type}>`);

        switch(opText)
        {
            case "+": return add(left, right);
            case "-": return sub(left, right);
            case "*": return mul(left, right);
            case "/": return div(left, right);
            case "^": return pow(left, right);

            case "+=": return assign(left, add(left, right));
            case "-=": return assign(left, sub(left, right));
            case "*=": return assign(left, mul(left, right));
            case "/=": return assign(left, div(left, right));
            case "^=": return assign(left, pow(left, right));

            case "=": return assign(left, right);

            case ":=": return define(left, right, scope);
        }

        throw new Error(`Operator ${opText} not yet supported`);
    };

    const evaluateExpression = (token, scope) => 
    {
        if(token.value.length === 0)
            return makeToken("void");
        
        let res = evaluateAny(token.value[0], scope);
        let lastOp;
        
        for(let i = 1; i < token.value.length; i++)
        {
            const curr = evaluateAny(token.value[i], scope);    
            if(curr.type == "operator")
            {
                if(lastOp !== undefined)
                    throw new Error("Only simple operator evaluation supported");
                
                lastOp = curr;
            }       
            else 
            {
                if(lastOp === undefined)
                    throw new Error("Only simple operator evaluation supported");

                res = performExpression(res, lastOp, curr, scope);
                lastOp = undefined;
            }
        }

        return res;
    };

    const evaluateId = (token, scope) =>
    {
        const found = scopeGet(scope, token.value);
        if(found === undefined)
            return makeValue("unset", token.value);

        return found;
    };
    
    const evaluateDecimal = token => makeValue("num", Number(token.value));
    const evaluateOperator = token => copy(token);
    
    const evaluateArray = (token, scope) =>
    {
        const ret = [];

        for(const elem of token.value)
            ret.push(evaluateAny(elem, scope));

        return makeValue("array", ret);
    };
    
    const evaluateMatrix = (token, scope) =>
    {
        const matrixRes = [];

        let lastSize = 0;
        for(const rows of token.value)
        {
            if(lastSize == 0)
                lastSize = rows.value.length;
            else if(lastSize !== rows.value.length)
                throw new Error("All matrix rows need to have the same number of elements");

            const rowRes = [];
            for(const col of rows.value)
            {
                const colValue = evaluateAny(col, scope);
                if(colValue.type !== "num")
                    throw new Error("All matrix elements need to evaluate to a number");

                rowRes.push(colValue);
            }

            matrixRes.push(rowRes);
        }

        return makeValue("matrix", matrixRes);
    };
    
    const evaluateSequence = (token, scope) =>
    {
        const noLast = token.value.length - 1;
        if(noLast < 0)
            return makeValue("void");

        for(let i = 0; i < noLast; i++)
            evaluateAny(token.value[i], scope);
        
        return evaluateAny(token.value[noLast], scope);
    };

    const evaluateScope = (token, scope) =>
    {
        const len = token.value.length;
        if(len == 0)
            return makeValue("void");

        if(len > 1)
            throw new Error("Should not happen");
        
        const newScope = makeScopeContext(scope);
        return evaluateAny(token.value[0], newScope);
    };
    
    const evaluateParens = (token, scope) =>
    {
        return evaluateAny(token.value[0], scope);
    };

    const evaluateAny = (token, scope = makeScopeContext()) =>
    {
        if(!token)
            return makeValue("void");

        switch(token.type)
        {
            case "id": return evaluateId(token, scope);
            case "decimal": return evaluateDecimal(token, scope);
            case "operator": return evaluateOperator(token, scope);
            case "scope": return evaluateScope(token, scope);
            case "parens": return evaluateParens(token, scope);
            case "sequence": return evaluateSequence(token, scope);
            case "expression": return evaluateExpression(token, scope);
            case "array": return evaluateArray(token, scope);
            case "matrix": return evaluateMatrix(token, scope);
            default: return makeValue("void");
        }
    };


    return {
        formatValue,
        formatToken,
        toPlain,
        parse,
        evaluate: evaluateAny,
    };
}
