function import_combinators(lib) 
{
    const obj = lib.object;
    const assert = lib.debug.assert;

    const updateParserState = (state, result = state.result, index = state.index, error = state.error) => ({
        index: index,
        result: result,
        error: error,
        shared: state.shared,
        singular: obj.copy(state.singular),
    });

    const updateParserResult = (state, result, index = state.index) => ({
        index: index,
        result: result,
        error: state.error,
        shared: state.shared,
        singular: obj.copy(state.singular),
    });

    const updateParserError = (state, error) => ({
        index: state.index,
        result: state.result,
        error: error,
        shared: state.shared,
        singular: obj.copy(state.singular),
    });

    const makeParserState = (input, shared = {}, singular = {}) => {
        const state = {
            index: 0,
            result: null,
            error: 0,
            shared: shared,
            singular: singular,
        };

        state.shared.input = input;
        return state;
    };

    const pushDefaultResult = (results, result) => {
        if(result !== undefined)
            results.push(result);
    };
    
    const append = (to, appended) => {
        const from = to.length;
        to.length = from + addedResults.length;
        for(let i = 0; i < addedResults.length; i++)
            to[i + from] = addedResults[i];

        return to;
    };

    const join = (left, right) => append(least.slice(0), right);

    const pushFlatResult = (results, addedResults) => {
        if(Array.isArray(addedResults))
            append(results, addedResults);
        else if(addedResults !== undefined)
            results.push(addedResults);
    };

    const __appendParserResults = (state, parsers, results, pushResult) => {
        let nextState = state;

        for (let parser of parsers)
        {
            nextState = parser.parse(nextState);
            if(nextState.error)
                break;

            pushResult(results, nextState.result);
        }

        return updateParserResult(nextState, results);
    };
    
    class Parser 
    {
        constructor(parse, additional = {}) {
            this.parse = parse;

            for(const prop in additional)
                this[prop] = additional[prop];
        }

        run(input, shared = {}, singular = {}) {
            return this.parse(makeParserState(input, shared, singular));
        }

        copyProperties(parse) {
            const created = new Parser(parse);
            
            for(const prop in this)
                if (this.hasOwnProperty(prop) && prop != "parse") 
                    created[prop] = this[prop];
            
            return created;
        }

        map(fn) {
            return this.copyProperties(prevState => {
                const nextState = this.parse(prevState);
                return fn(nextState, prevState);
            });
        }
        
        mapResult(fn) {
            return this.copyProperties(prevState => {
                const nextState = this.parse(prevState);
                if(nextState.error)
                    return nextState;

                //since any parser copies we dont have to
                nextState.result = fn(nextState.result, nextState, prevState);
                return nextState;
            });
        }
        
        mapError(fn) {
            return this.copyProperties(prevState => {
                const nextState = this.parse(prevState);
                if(!nextState.error)
                    return nextState;

                nextState.error = fn(nextState.error, nextState, prevState);
                return nextState;
            });
        }

        chain(fn) {
            return this.copyProperties(state => {
                const nextState = this.parse(state);

                if(nextState.error)
                    return nextState;

                const nextParser = fn(state.result, nextState, state);
                return nextParser.parse(nextState);
            });
        }

        discard() {
            return this.map(state => {state.result = undefined; return state;});
        }

        keep() {
            return this.map(state => {state.error = 0; return state;});
        }

        maybe() {
            return this.map(state => {
                if(state.error)
                {
                    state.error = 0;
                    state.result = undefined;
                }
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

        append(parser, pushResult = pushDefaultResult) {
            if(Array.isArray(parser))
                return this.map(state => {
                    if(state.error)
                        return error;

                    return __appendParserResults(state, parser, state.result, pushResult);
                });

            return this.map(state => {
                if(state.error)
                    return error;

                const nextState = parser.parse(state);
                if(nextState.error)
                    return nextState;

                const nextResult = nextState.result;
                nextState.result = state.result;
                pushResult(nextState.result, nextResult);

                return nextState;
            });
        }
    }
 
    const PARSER_ID = {};
    const PROPERTIES = {};
    const ERROR_KIND = {
        EOF: 1 << 16 - 1
    };


    const format = lib.debug.format;

    const locationMsg = (state) => {
        // const range = 2;
        // const sliced = state.shared.input.slice(state.index - range, state.index + range);
        // return `(${state.index}: ${format(sliced)})`;
        return `(${state.index})`;
    };

    const errorKind = error => error & (0xFFFF);
    const errorCaller = error => error >> 16;

    const defaultHandler = (error, state, retrieved) => {
        let nameMsg = `${retrieved.name}(${errorCaller(error)})`;
        let errorMsg = `#${errorKind(error)}`;
        let locMsg = locationMsg(state);

        if(state.composition)
            nameMsg += ` |${format(state.composition)}|`;

        if(errorKind(error) == ERROR_KIND.EOF)
            errorMsg = 'EOF';

        if(Object.keys(state.singular).length)
            locMsg += ` (${format(state.singular)})`;

        return nameMsg + ': ' + errorMsg + ' ' + locMsg;
    };

    const registerParser = (nameIdPair, parser, handler = defaultHandler, ids = PARSER_ID, properties = PROPERTIES) => {
        let name;
        let id;
        if(typeof(nameIdPair) === "string")
            name = nameIdPair;
        else
        {
            const entries = Object.entries(nameIdPair);
            assert(entries.length > 0);
            [name, id] = entries[0];
        }

        assert(name !== undefined);
        if(id === undefined)
            id = Object.keys(properties).length + 1;

        id <<= 16;
        ids[name] = id;
        properties[id] = {parser, handler, name};
    };
    
    const registerHandler = (nameIdPair, handler = defaultHandler, ids = PARSER_ID, properties = PROPERTIES) => {
        return registerParser(nameIdPair, null, handler, ids, properties);
    };

    const errorInfo = (parser, properties = PROPERTIES) => parser.mapError((error, state) => {
        const retrieved = properties[error];
        if(retrieved !== undefined)
            state.singular.errorInfo = retrieved.handler(error, state, retrieved);

        return error;
    });
    

    const parserSequnce = (parsers, pushResult = pushDefaultResult) => new Parser(state => {
        if(state.error)
            return state;

        const results = [];
        return __appendParserResults(state, parsers, results, pushResult);
    });

    const skip = parser => new Parser(state => {
        if(state.error)
            return state;

        let lastState = state;
        while(true)
        {
            const currState = parser.parse(lastState);
            if(currState.error)
                break;

            lastState = currState;
        }

        return updateParserResult(lastState, undefined);
    });
    const skip1 = parser => skip(parser).map((state, lastState) => {
        if(state.index === lastState.index)
            state.error = PARSER_ID.SKIP;
        return state;
    });

    const manyRegular = (parser, pushResult = pushDefaultResult) => new Parser(state => {
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
    
    const manyChain = (parser, inspection, pushResult = pushDefaultResult) => new Parser(state => {
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

    const many = (parser, inspection = undefined, pushResult = pushDefaultResult) => {
        if(inspection === undefined)
            return manyRegular(parser, pushResult);
        else
            return manyChain(parser, inspection, pushResult);
    };

    const repeat = (times, parser, pushResult = pushDefaultResult) => new Parser(state => {
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

    const least = parser => parser.map(state => {
        if(state.result.length === 0)
            state.error = PARSER_ID.LEAST;
        
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

        return updateParserError(state, PARSER_ID.CHOICE);
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
            return updateParserError(state, PARSER_ID.SINGLE_CATEGORY + ERROR_KIND.EOF);
        
        if(!(shared.input[index] in cat))
            return updateParserError(state, PARSER_ID.SINSINGLE_CATEGORYGLE);
        
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
        
        return updateParserError(state, PARSER_ID.SLICE);
    });

    const regex = (reg, max_offset = undefined) => new Parser(state => {
        if(state.error)
            return state;

        const shared = state.shared;
        const index = state.index;
        const sliced = max_offset ? shared.input.slice(index, index + max_offset) : shared.input.slice(index);
        if(sliced.length === 0)
            return updateParserError(state, PARSER_ID.REGEX + ERROR_KIND.EOF);

        const match = sliced.match(reg);
        if(!match)
        return updateParserError(state, PARSER_ID.REGEX + 1);

        return updateParserResult(state, match[0], index + match[0].length);
    });

    const tokenSequence = seq => new Parser(state => {
        if(state.error)
            return state;

        const shared = state.shared;
        const index = state.index;
        const end = index + seq.length;
        if(shared.input.length < end)
            return updateParserError(state, PARSER_ID.TOKEN_SEQUENCE + ERROR_KIND.EOF);

        for(let i = 0; i < seq.length; i++)
        {
            if(seq[i] !== shared.input[index + i])
            return updateParserError(state, PARSER_ID.TOKEN_SEQUENCE);
        }
        
        return updateParserResult(state, seq, end);
    });
    
    const single = token => new Parser(state => {
        if(state.error)
            return state;

        const shared = state.shared;
        const index = state.index;
        if(index >= shared.input.length)
            return updateParserError(state, PARSER_ID.SINGLE + ERROR_KIND.EOF);
        
        if(shared.input[index] !== token)
            return updateParserError(state, PARSER_ID.SINGLE);
        
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
            error = PARSER_ID.FAIL;
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
            return updateParserError(state, PARSER_ID.ANY_SINGLE + ERROR_KIND.EOF);
        
        return updateParserResult(state, shared.input[index], index + 1);
    });

    const sequence = (seq, pushResult = pushDefaultResult) => {
        if(seq.length > 0 && 
           typeof(seq[0]) == "object" && 
           seq[0].constructor.name == "Parser")
            return parserSequnce(seq, pushResult);
        else
            return tokenSequence(seq, pushResult);
    };

    const between = (left, right) => parser => parserSequnce([
        left,
        parser,
        right
    ]).mapResult(results => results[1]);
    
    const separated = separator => (parser, pushResult = pushDefaultResult) => new Parser(state => {
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

    const separatedTrailing = separator => (parser, pushResult = pushDefaultResult) => new Parser(state => {
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
        let furthestIndex = furthestState.error ? state.index : furthestState.index;
        for(let i = 1; i < parsers.length; i++)
        {
            const last = parsers[i].parse(state);
            if(!last.error && last.index > furthestIndex)
            {
                furthestState = last;
                furthestIndex = last.index;
            }
        }

        return updateParserState(furthestState);
    });
    
    const greedy = (parsers, pushResult = pushDefaultResult) => new Parser(state => {
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
        
        return updateParserResult(next_state, results);
    });

    const lazy = parserThunk => new Parser(state => {
        const parser = parserThunk();
        return parser.parse(state);
    });

    const string = slice;
    const many1 = (parser, inspection = undefined, pushResult = pushDefaultResult) => least(many(parser, inspection));
    const category1 = (parser, pushResult = pushDefaultResult) => least(category(parser, pushResult));
    const separated1 = separator => (parser, pushResult = pushDefaultResult) => least(separated(separator)(parser, pushResult));
    
    const lettersReg = /^[A-Za-z_]+/;
    const identifiersReg = /^[a-zA-Z_]+[a-zA-Z0-9_]*/;
    const digitsReg = /^[0-9]+/;
    const decimalReg = /^\d*\.?\d+/;
    const whitespacesReg = /^\s+/;

    const letters = (max_offset = undefined) => regex(lettersReg, max_offset);
    const identifiers = (max_offset = undefined) => regex(identifiersReg, max_offset);
    const digits = (max_offset = undefined) => regex(digitsReg, max_offset);
    const decimal = (max_offset = undefined) => regex(decimalReg, max_offset);
    const whitespace = (max_offset = undefined) => regex(whitespacesReg, max_offset);
  
    registerParser("PARSER_SEQUENCE", errorInfo);
    registerParser("PARSER_SEQUENCE", parserSequnce);
    registerParser("SKIP", skip);
    registerParser("SKIP1", skip1);
    registerParser("MANY_REGULAR", manyRegular);
    registerParser("MANY_CHAIN", manyChain);
    registerParser("MANY", many);
    registerParser("REPEAT", repeat);
    registerParser("LEAST", least);
    registerParser("CHOICE", choice);
    registerParser("CATEGORY", category);
    registerParser("SINGLE_CATEGORY", singleCategory);
    registerParser("MANY_REGULAR", slice);
    registerParser("REGEX", regex);
    registerParser("TOKEN_SEQUENCE", tokenSequence);
    registerParser("SINGLE", single);
    registerParser("SUCCEED", succeed);
    registerParser("FAIL", fail);
    registerParser("ANY_SINGLE", anySingle);
    registerParser("SEQUENCE", sequence);
    registerParser("BETWEEN", between);
    registerParser("SEPARATED", separated);
    registerParser("SEPARATED_TRAILING", separatedTrailing);
    registerParser("PARALEL", paralel);
    registerParser("FURTHEST", furthest);
    registerParser("GREEDY", greedy);
    registerParser("LAZY", lazy);

    return {
        Parser,
        errorInfo,
        parserSequnce,
        append,
        skip,
        skip1,
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
        decimal,
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
        succeed,
        fail,
        updateParserState,
        updateParserResult,
        updateParserError,
        pushDefaultResult,
        pushFlatResult,
        defaultHandler,
        registerParser,
        registerHandler,
        PARSER_ID,
        PROPERTIES,
        ERROR_KIND,
    };
}

function import_parsers(lib)
{
    const c = import_combinators(lib);
    const mtx = importMatrix();
    const assert = lib.debug.assert;

    c.registerHandler({TOKEN: 500});
    c.registerHandler({EXPR_SEQUENCE: 501});
    c.registerHandler({MATCH_OPERATORS: 502});
    c.registerHandler({EXPR_PARSER: 503});
    c.registerHandler({FUNCTION_PARSER: 504});
    c.registerHandler({OPERATOR: 505});

    const last = array => array[array.length - 1];
    const makeToken = (type, val = null, ib = 0, ie = 0) => ({type: type, val: val, ib: ib, ie: ie});
    const makeOperatorValue = (category, result) => ({category: category, val: result});
    const makeOperator = (category, result, ib, ie) => makeToken("operator", makeOperatorValue(category, result), ib, ie);

    const OPERATORS = [
        '+', '-', '*', '/', '^', '%', '++', '--',
        '!', '&&', '||', 
        '~', '&', '|', '^|', '<<', '>>',
        ':=', '=', '+=', '-=', '*=', '/=', '^=', '%=', '&=', '|=', '^|=', '<<=', '>>=', 
        '?', ':', '..', '...', '[]'
    ];

    const generateOperatorParsers = (operators = OPERATORS) => {
        return operators.map(op => {
            return c.slice(op).mapResult(result => {
                return makeOperatorValue("explicit", result);
            });
        });
    };

    const toTokenParser = (type, parser) => parser.mapResult((result, state, lastState) => {
        return makeToken(type, result, lastState.index, state.index);
    });

    const operatorParsers = () => c.furthest(generateOperatorParsers());
    
    const tokenizer = c.greedy([
        toTokenParser("space", c.whitespace()),
        toTokenParser("id", c.identifiers()),
        toTokenParser("operator", operatorParsers()),
        toTokenParser("roundB", c.single('(')),
        toTokenParser("roundB", c.single(')')),
        toTokenParser("squareB", c.single('[')),
        toTokenParser("squareB", c.single(']')),
        toTokenParser("curlyB", c.single('{')),
        toTokenParser("curlyB", c.single('}')),
        toTokenParser("comma", c.single(',')),
        toTokenParser("semicol", c.single(';')),
        toTokenParser("decimal", c.decimal()),
        toTokenParser("error", c.anySingle())
    ]).mapResult((results, state) => {
        results.push(makeToken("eof", null, state.index - 1, state.index));
        return results;
    });

    const token = (type, val = undefined) => {
        if(val !== undefined)
            return new c.Parser(state => 
            {
                const index = state.index;
                const token = state.shared.input[index];
                if(token != undefined && (token.type === type && token.val === val))
                    return c.updateParserResult(state, token, index + 1);

                return c.updateParserError(state, c.PARSER_ID.TOKEN);
            });
        
        return new c.Parser(state => 
        {
            const index = state.index;
            const token = state.shared.input[index];

            if(token != undefined && (token.type === type))
                return c.updateParserResult(state, token, index + 1);

            return c.updateParserError(state, c.PARSER_ID.TOKEN);
        });
    };

    const fromRawTokens = () => toTokenParser("filtered", c.many(
        c.choice([
            c.skip1(token("error")).mapResult((_, state, lastState) => {
                const stream = state.shared.input;
                const text = state.shared.text;
                
                assert(lastState.index < stream.length && lastState.index > 0);
                assert(state.index - 1 < stream.length && state.index - 1 > 0);

                const begin = stream[lastState.index].ib;
                const end = stream[state.index - 1].ie;
                
                return makeToken("error", text.slice(begin, end), lastState.index, state.index);
            }),
            
            c.anySingle().mapResult((result, state, lastState) => {
                if(result.type === "space")
                    return undefined;
                
                return makeToken(result.type, result.val, lastState.index, state.index);
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
            state.result = makeToken(type, result, inputLen, inputLen);
            return state;
        }

        const stream = state.shared.input;
        const bToken = stream[lasti];
        if(nexti >= inputLen)
            state.result = makeToken(type, result, bToken.ib, last(stream).ie);
        else if(nexti === lasti)
            state.result = makeToken(type, result, bToken.ib, bToken.ie);
        else
        {
            const eToken = state.shared.input[nexti - 1];
            state.result = makeToken(type, result, bToken.ib, eToken.ie);
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

    const separated = (type, val = undefined) => c.separated(token(type, val));
    const separatedTrailing = (type, val = undefined) => c.separatedTrailing(token(type, val));
    const betweenBrackets = (type, begin, end) => c.between(token(type, begin), token(type, end));
    const commaSeparated = separatedTrailing('comma');
    const semicolSeparated = separatedTrailing('semicol');
    const betweenSquareBrackets = betweenBrackets('squareB', '[', ']');
    const betweenCurlyBrackets = betweenBrackets('curlyB', '{', '}');
    const betweenRoundBrackets = betweenBrackets('roundB', '(', ')');

    const valueParser = name("val", c.choice([
        token("decimal"),
        token("id"),
    ]));

    const listValue = name("listVal", c.lazy(() => c.choice([
        name("listValRace", c.furthest([
            functionParser,
            valueParser,
            exprParser,
        ])),

        matrixParser,
        arrayParser,
        parensParser,
        scopeParser,
    ])));
    
    const matrixRowParser = classify("matrixRow", c.lazy(() => c.many1(
        listValue
    )));

    const operatorOrListValue = name("opOrlistVal", c.lazy(() => c.choice([
        token("operator"),
        functionParser,
        valueParser,
        matrixParser,
        arrayParser,
        parensParser,
        scopeParser,
    ])));

    const areAdjecent = (token1, token2) => token1.ie === token2.ib;

    //REFACTOR
    const exprParser = classify("expression", c.lazy(() => c.many1(
        operatorOrListValue,
        (state, results) => {
            const lastToken = last(results);
            const currToken = state.result;
            if(lastToken == undefined || lastToken.type === "operator" || currToken.type === "operator")
                return operatorOrListValue;

            if(currToken.type === "array")
            {
                results.push(makeOperator("implicit", "[]", currToken.ib, currToken.ib));
                return operatorOrListValue;
            }

            if(!areAdjecent(lastToken, currToken))
            {
                state.error = c.PARSER_ID.EXPR_PARSER;
                return operatorOrListValue;
            }

            if(lastToken.type === "decimal" || currToken.type === "decimal" || //left right numbers allowed
               currToken.type !== "array" ||  //not array subscript
               (lastToken.type !== "id" && currToken.type !== "parens")) //not function call
                results.push(makeOperator("implicit", "*", currToken.ib, currToken.ib));
            else
                state.error = c.PARSER_ID.EXPR_PARSER;

            return operatorOrListValue;
        }
    )));
    
    const lineValue = name("lineValue", c.lazy(() => c.sequence([
        listValue.maybe(),
        token("semicol").discard()
    ])));

    const scopeValue = name("scopeValue", c.lazy(() => 
        name("scopeValueMany", c.many(c.choice([
            scopeParser,
            lineParser,
        ]))).append(listValue.maybe())
    ));

    const lineParser = classify("line", lineValue);
    const parensParser = classify("parens", betweenRoundBrackets(listValue).mapResult(result => [result]));
    const arrayParser =  classify("array", betweenSquareBrackets(commaSeparated(listValue)));
    const matrixParser =  classify("matrix", betweenSquareBrackets(betweenSquareBrackets(commaSeparated(matrixRowParser))));
    const scopeParser =  classify("scope", betweenCurlyBrackets(scopeValue));
    const functionParser = classify("function", c.sequence([
        token("id"),
        classify("args", betweenRoundBrackets(commaSeparated(listValue)))
    ]));

    const scriptParser = classify("script", c.errorInfo(scopeValue.append(token("eof").discard())));

    const parse = (input) =>
    {
        const tokens = tokenizer.run(input);
        console.log(tokens);
        const filtered = fromRawTokens().run(tokens.result, {text: input});
        console.log(filtered);
        // return filtered;
        const parsed = scriptParser.run(filtered.result.val);
        return parsed;
    };
  

    //FUNCTIONS
    const FUNCTIONS = {};
    const castLookup = (from, to) => `%cast(${from},${to})`;

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

    //Should be in lib
    const Sequence = (acessor, length) => ({at: acessor, length});
    const arraySequence = (array) => Sequence(i => array[i], array.length);
    const constantSequence = (val, length = Infinity) => Sequence(_ => val, length);

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
            return makeValue(to, val);
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
        if(types.length !== args.length && types.length !== Infinity)
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
        if(types.length === 0)
            return '';
        
        if(types.lenght === Infinity)
            return `<${types.at(0)}>...`;

        let accumulated = `<${types.at(0)}>`;
        for(let i = 1; i < types.length; i++)
            accumulated += `, <${types.at(i)}>`;
        
        return accumulated;
    };

    const informAttempted = (types, lookup) => {
        return `${lookup} (${formatFunctionTypes(types)}) : `;
    };
    
    const informNumberOfArguments = (types, args) => {
        return `Number of arguments doesnt match: required ${types.length} got ${args.length}`;
    };
    
    const informTypeMissmatch = (types, args, context, functions) => {
        assert(types.length <= args.length);

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
        if(types.length !== args.length && type.length !== Infinity)
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

    const extractPair = (pair) => {
        const entries = Object.entries(pair);
        assert(entries.length == 1);
        return entries[0];
    };

    const addTypedFn = (lookupFnPair, types, potentialFn = undefined, functions = FUNCTIONS) => {
        let [lookup, fn] = extractPair(lookupFnPair);
        if(potentialFn !== undefined)
            fn = potentialFn;

        addFunctionPack(lookup, typeCheckedFn(fn, types), functions);
    };


    //FORMATS
    const OFFSET = '   ';
    const NEWLINE = '\n';

    const offsetOnce = (text, offsetWith, newline = NEWLINE) =>
    {
        let accumulated = '';
        let i = 0;
        for(;;)
        {
            const newI = text.indexOf(newline, i + 1);
            if(newI === -1)
                break;

            accumulated += offsetWith + text.slice(i, newI);
            i = newI;
        }

        accumulated += offsetWith + text.slice(i, text.lenght);
        return accumulated;
    };

    const offset = (text, offsetWith, count, newline = NEWLINE) => 
        offsetOnce(text, offsetWith.repeat(count), newline);

    const getTableInfo = (table, extractCols = val => val, formatter = val => val.toString()) => {
        if(table.length === 0)
            return [];

        const maxOffsets = Array(extractCols(table[0]).length).fill(0);

        for(const row of table)
        {
            const cols = extractCols(row);
            for(let i = 0; i < cols.length; i++)
            {
                const formatted = formatter(cols[i], i);
                const len = formatted.length;
                if(len > maxOffsets[i])
                    maxOffsets[i] = len;
            }
        }

        return maxOffsets;
    };

    const getTableFormat = (table, extractCols = val => val, formatter = val => val.toString()) => {
        if(table.length === 0)
            return {rows: [], offsets: []};

        const valueTable = [];
        const maxOffsets = Array(extractCols(table[0]).length).fill(0);

        for(const row of table)
        {
            const cols = extractCols(row);
            const valueRow = Array(cols.length);
            for(let i = 0; i < cols.length; i++)
            {
                valueRow[i] = formatter(cols[i]);
                const len = valueRow[i].length;
                if(len > maxOffsets[i])
                    maxOffsets[i] = len;
            }

            valueTable.push(valueRow);
        }

        return {rows: valueTable, offsets: maxOffsets};
    };

    const isToken = (token) => {
        return (typeof(token) === 'object') && (token !== null) && ('ib' in token) && ('type' in token) && ('val' in token);
    };

    const formatToken = (token, newline = '\n', offsetWith = '   ', padTypeTo = 0, padSizeTo = 0, offsetLevel = 0) =>
    {
        assert(token && isToken(token));

        const type = `'${token.type}'`.padEnd(padTypeTo);
        const size = `(${token.ib}, ${token.ie})`.padEnd(padSizeTo);

        const isT = isToken(token.val);
        const isA = Array.isArray(token.val);

        if(!isT && !isA)
            return `{${type} ${size} : ${lib.debug.format(token.val)}}`;
            
        const offset = offsetWith.repeat(offsetLevel);
        const formatSingle = (token) => {
            const formated = formatToken(token, newline, offsetWith, 0, 0, offsetLevel + 1);
            return offsetOnce(formated, offset + offsetWith, newline);
        };

        if(isT)
            return `{${type} ${size} : {..}}${newline + formatSingle(token.val)}`;

        //isA
        if(token.val.length === 0)
            return `{${type} ${size} : []}`;

        if(token.val.length === 1)
            return `{${type} ${size} : [..]}${newline + formatSingle(token.val[0])}`;

        const tableInfo = getTableInfo(token.val, val => [val.type, [val.ib, val.ie]]);
        const maxTypeLen = tableInfo[0] + 2;
        const maxSizeLen = tableInfo[1] + 3; //4 - 1

        let accumulated = `{${type} ${size}} : [` + newline;
        const ender = ',' + newline;
        const greaterOffset = offset + offsetWith;
        for(const val of token.val)
        {
            const formated = formatToken(val, newline, offsetWith, maxTypeLen, maxSizeLen, offsetLevel + 1);
            accumulated += offsetOnce(formated, greaterOffset, newline) + ender;
        }

        accumulated += offset + ']';
        return accumulated;    
    };

    const formatMatrix = (matrix, newline = NEWLINE, separate = ' ', offsetWith = OFFSET, offsetLevel = 0) =>
    {
        const tableFormat = getTableFormat(matrix.val);

        const contextOffset = offsetWith.repeat(offsetLevel);
        let accumulated = contextOffset + '[[' + newline;

        for(const row of tableFormat.rows)
        {
            const width = row.length;
            if(width == 0)
                continue;

            accumulated += offsetWith + contextOffset + row[0].padStart(tableFormat.offsets[0]);
            for(let i = 1; i < width; i++)
                accumulated += separate + row[i].padStart(tableFormat.offsets[i]);
            
            accumulated += ',' + newline;
        }

        return accumulated + ']]';
    };
    
    const formatArray = (token, separate = ', ', offsetWith = OFFSET, offsetLevel = 0) =>
    {
        const contextOffset = offsetWith.repeat(offsetLevel);
        let accumulated = contextOffset + '[';

        const array = token.val;
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
            case 'decimal': return token.val.toString();
            case 'unset': return 'unset';
            case 'void': return 'void';
            default: return '<error>';
        }
    };
    
    const formatErrorGather = (lookup, gathered) => {
        let accumulated = `Could not match expression: ${lookup} (...)`;
        if(gathered.size === 0)
            return ` : No such expression defined (in this scope)`;
        
        accumulated += `\n${OFFSET}Tried:\n`;

        const offset = OFFSET + OFFSET;
        for(const info of gathered)
            accumulated += offsetOnce(info, offset) + NEWLINE;

        return accumulated;
    };

    //SCOPE
    const copy = object => lib.object.copy(object);
    const makeValue = (type, val = null) => ({type: type, val: val});
    const makeScopeContext = (outer = undefined) => ({local: {}, outer});

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
    const Decimal = val => makeValue('decimal', val);
    const Matrix = val => makeValue('matrix', val);
    const ArrayVal = val => makeValue('array', val);
    const Void = () => makeValue('void', null);
    const Unset = (name) => makeValue('unset', name);

    const variadicArgs = (flatTypes, variadicType) => {
        if(flatTypes.lenght == 0)
            return constantSequence(variadicType);

        return Sequence(i => {
            if(i < flatTypes.lenght)
                return flatTypes[i];
            else
                return variadicType;
        }, Infinity);
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

    addDummyCast('decimal', 'decimal');
    addDummyCast('matrix', 'matrix');
    addDummyCast('array', 'array');

    addTypedFn({'=': assign},     ['decimal', 'decimal']);
    addTypedFn({'=': deepAssign}, ['matrix', 'matrix']);
    addTypedFn({'=': deepAssign}, ['array', 'array']);
    
    addTypedFn({':=': define}, ['unset', 'decimal']);
    addTypedFn({':=': define}, ['unset', 'matrix']);
    addTypedFn({':=': define}, ['unset', 'array']);

    addTypedFn({'+': (l, r) => Decimal(l.val + r.val)}, ['decimal', 'decimal']);
    addTypedFn({'-': (l, r) => Decimal(l.val - r.val)}, ['decimal', 'decimal']);
    addTypedFn({'*': (l, r) => Decimal(l.val * r.val)}, ['decimal', 'decimal']);
    addTypedFn({'/': (l, r) => Decimal(l.val / r.val)}, ['decimal', 'decimal']);
    addTypedFn({'^': (l, r) => Decimal(Math.pow(l.val, r.val))}, ['decimal', 'decimal']);
    addTypedFn({'%': (l, r) => Decimal(l.val % r.val)}, ['decimal', 'decimal']);
    addTypedFn({'&': (l, r) => Decimal(l.val & r.val)}, ['decimal', 'decimal']);
    addTypedFn({'|': (l, r) => Decimal(l.val | r.val)}, ['decimal', 'decimal']);
    addTypedFn({'^|': (l, r) => Decimal(l.val ^ r.val)}, ['decimal', 'decimal']);
    addTypedFn({'&&': (l, r) => Decimal(l.val && r.val)}, ['decimal', 'decimal']);
    addTypedFn({'||': (l, r) => Decimal(l.val || r.val)}, ['decimal', 'decimal']);
    addTypedFn({'>>': (l, r) => Decimal(l.val >> r.val)}, ['decimal', 'decimal']);
    addTypedFn({'<<': (l, r) => Decimal(l.val << r.val)}, ['decimal', 'decimal']);
    
    addTypedFn({'+=': (l, r) => {l.val += r.val; return l;}}, ['decimal', 'decimal']);
    addTypedFn({'-=': (l, r) => {l.val -= r.val; return l;}}, ['decimal', 'decimal']);
    addTypedFn({'*=': (l, r) => {l.val *= r.val; return l;}}, ['decimal', 'decimal']);
    addTypedFn({'/=': (l, r) => {l.val /= r.val; return l;}}, ['decimal', 'decimal']);
    addTypedFn({'^=': (l, r) => {l.val ^= Math.pow(l.val, r.val); return l;}}, ['decimal', 'decimal']);
    addTypedFn({'%=': (l, r) => {l.val %= r.val; return l;}}, ['decimal', 'decimal']);
    addTypedFn({'&=': (l, r) => {l.val &= r.val; return l;}}, ['decimal', 'decimal']);
    addTypedFn({'|=': (l, r) => {l.val |= r.val; return l;}}, ['decimal', 'decimal']);
    addTypedFn({'^|=': (l, r) => {l.val |= r.val; return l;}}, ['decimal', 'decimal']);
    addTypedFn({'>>=': (l, r) => {l.val >>= r.val; return l;}}, ['decimal', 'decimal']);
    addTypedFn({'<<=': (l, r) => {l.val <<= r.val; return l;}}, ['decimal', 'decimal']);

    const mWidth = (matrix) => mtx.width(matrix.val);
    const mHeight = (matrix) => mtx.height(matrix.val);

    const matrixSizeError = (what, left, right) => {
        const w1 = mWidth(left);
        const h1 = mHeight(left);
        const w2 = mWidth(right);
        const h2 = mHeight(right);

        return `${what} cannot be applied on matrices of incorrect size: ${w1}x${h1} ${op} ${w2}x${h2}`;
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
        if(mHeight(l) !== mWidth(r))
            throw new Error(matrixOpSizeError('*', l, r));

        return Matrix(mtx.mulMatrix(l.val, r.val));
    };

    addTypedFn({'*': mulMatrixt}, ['matrix', 'matrix']);
    
    addTypedFn({'*': (l, r) => Matrix(mtx.mulNum(l.val, r.val))}, ['matrix', 'num']);
    addTypedFn({'*': (l, r) => Matrix(mtx.mulNum(r.val, l.val))}, ['num', 'matrix']);

    
    const sumVariadicDecimal = (...args) => {
        return args.reduce((l, r) => Decimal(l.val + r.val), Decimal(0));
    };
    
    const productVariadicDecimal = (...args) => {
        return args.reduce((l, r) => Decimal(l.val * r.val), Decimal(1));
    };

    addTypedFn({'sum': sumVariadicDecimal}, variadicArgs(['decimal'], 'decimal'));
    addTypedFn({'product': productVariadicDecimal}, variadicArgs(['decimal'], 'decimal'));
    
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

    const subscript = (left, right) => {

        const rvalue = right.val;
        
        if(rvalue.length == 0)
            throw new Error(`Operator [] cannot be used with empty 0 indecies while performing ${formatValue(left)}${formatArray(right)}`);

        for(const index of rvalue)
            if(index.type !== "num")
                throw new Error(`Operator [] cannot be used with index of type <${index.type}> while performing ${formatValue(left)}${formatArray(right)}`);


        if(left.type == "array")
        {
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
            return copy(current);
        }
        
        if(left.type == "matrix")
        {
            const matrix = left.val;
            const width = mWidth(right);
            const height = mHeight(right);
            
            if(rvalue.length > 2)
                throw new Error(`Operator [] max two indecies to array subscript while performing ${formatMatrix(left)}${formatArray(right)}`);

            const i = rvalue[0].val;
            if(i > height || i < 1)
                throw new Error(`Operator [] index ${i} out of range of matrix ${formatMatrix(left)}`);

            if(rvalue.length == 1)
                return makeValue("array", matrix[i - 1].map(val => makeValue("num", val)));

            const j = rvalue[0].val;
            if(j > width || j < 1)
                throw new Error(`Operator [] index ${j} out of range of matrix ${formatMatrix(left)}`);
                
            return makeValue("num", matrix[i - 1][j - 1]); 
        }
    };

    const pow = (left, right) => {
        const toPow = right.val;
        if(left.type == 'num')
            return makeValue("num", Math.pow(left.val, toPow));
        
        if(!Number.isInteger(toPow))
            throw new Error("Only whole matrix powers supported");
        
        const state = mtx.State();
        const product = mtx.safe.pow(left.val, right.val, state);
        switch(state.error)
        {
            case mtx.ERROR.SINGULAR: throw new Error(`Cannot find inverse of singular matrix ${formatMatrix(left)}`);
            case mtx.ERROR.DIMENSIONS: throw new Error(matrixSizeError('*', left, left));
        }
        return makeValue("matrix", product);
    };

    const performExpression = (lookup, args, scope, context = {}) =>
    {
        const state = {error: 0};
        const res = executeFunction(lookup, args, {scope, context}, state);
        if(state.error)
            throw new Error(formatErrorGather(lookup, state.error));
            
        return res;
    };

    const evaluateExpression = (token, scope) => 
    {
        assert(token.val.length !== 0);
        
        let res = evaluateAny(token.val[0], scope);
        let lastOp;
        
        for(let i = 1; i < token.val.length; i++)
        {
            const curr = evaluateAny(token.val[i], scope);    
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

                assert(lastOp.type == "operator");
                res = performExpression(lastOp.val.val, [res, curr], scope);
                lastOp = undefined;
            }
        }

        return res;
    };
    
    const evaluateFunction = (token, scope) => 
    {
        assert(token.val.length == 2);
        const [id, args] = token.val;

        assert(id.type == "id");
        assert(args.type == "args");

        const evaluatedArgs = [];
        for(const arg of args.val)
            evaluatedArgs.push(evaluateAny(arg, scope));

        return performExpression(id.val, evaluatedArgs, scope);
    };

    const evaluateId = (token, scope) =>
    {
        const found = scopeGet(scope, token.val);
        if(found === undefined)
            return Unset(token.val);

        return found;
    };
    
    const evaluateDecimal = token => Decimal(Number(token.val));
    const evaluateOperator = token => copy(token);
    
    const evaluateArray = (token, scope) =>
    {
        const ret = [];

        for(const elem of token.val)
            ret.push(evaluateAny(elem, scope));

        return ArrayVal(ret);
    };
    
    const evaluateMatrix = (token, scope) =>
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
                const elemValue = evaluateAny(elem, scope);
                if(elemValue.type !== "decimal")
                    throw new Error("All matrix elements need to evaluate to a number");

                rowRes.push(elemValue.val);
            }


            matrixRes.push(rowRes);
        }

        return Matrix(matrixRes);
    };
    
    const evaluateLine = (token, scope) =>
    {
        if(token.val.length !== 0)
            evaluateAny(token.val[0], scope);

        return Void();
    };

    const evaluateScope = (token, scope) =>
    {
        const len = token.val.length;
        if(len === 0)
            return Void();

        const newScope = makeScopeContext(scope);
        const noLast = len - 1;
        for(let i = 0; i < noLast; i++)
            evaluateAny(token.val[i], newScope);
        
        return evaluateAny(token.val[noLast], newScope);
    };
    
    const evaluateParens = (token, scope) =>
    {
        assert(token.val.lenght === 1);
        return evaluateAny(token.val[0], scope);
    };

    const evaluateAny = (token, scope = makeScopeContext()) =>
    {
        assert(token && isToken(token));
        switch(token.type)
        {
            case "id": return evaluateId(token, scope);
            case "decimal": return evaluateDecimal(token, scope);
            case "operator": return evaluateOperator(token, scope);
            case "line": return evaluateLine(token, scope);
            case "parens": return evaluateParens(token, scope);
            case "script":
            case "scope": return evaluateScope(token, scope);
            case "expression": return evaluateExpression(token, scope);
            case "function": return evaluateFunction(token, scope);
            case "array": return evaluateArray(token, scope);
            case "matrix": return evaluateMatrix(token, scope);
            default: return makeValue("void");
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
            return mtx.copy(matrix.val);
        if(token.type === 'array')
            return arrayToPlain(token);
        else
            return token.val;
    };

    return {
        formatValue,
        formatToken,
        toPlain,
        parse,
        evaluate: evaluateAny,
    };
}
