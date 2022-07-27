function importCombinators(lib) 
{
    
    const obj = lib.obj;
    const assert = lib.dbg.assert;
    const arr = lib.arr;

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

    const mutableUpdateError = (state, error) => {
        state.error = error;
        return state;
    };

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

    const pushFlatResult = (results, addedResults) => {
        if(Array.isArray(addedResults))
            arr.append(results, addedResults);
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

        judge(fn) {
            return this.copyProperties(prevState => {
                const nextState = this.parse(prevState);
                if(nextState.error)
                    return nextState;

                nextState.error = fn(nextState.result, nextState, prevState);
                return nextState;
            });
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

                    state.result = arr.enforce(state.result);
                    return __appendParserResults(state, parser, state.result, pushResult);
                });

            return this.map(state => {
                if(state.error)
                    return error;

                const nextState = parser.parse(state);
                if(nextState.error)
                    return nextState;

                const nextResult = nextState.result;
                nextState.result = arr.enforce(state.result);
                pushResult(nextState.result, nextResult);

                return nextState;
            });
        }
        
        fork(parserMapArr) {
            return this.map(state => {
                if(state.error)
                    return state;
            
                for (let [parser, map] of parserMapArr)
                {
                    const nextState = parser.parse(state);
                    if(!nextState.error)
                        return map(nextState, state);
                }

                return updateParserError(state, PARSER_ID.CHOICE);
            });
        }
    }
 
    const PARSER_ID = {};
    const PROPERTIES = {};
    const ERROR_KIND = {
        EOF: 1 << 16 - 1
    };


    const format = lib.dbg.format;

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
        const results = [];
        return __appendParserResults(state, parsers, results, pushResult);
    });

    const skip = parser => new Parser(state => {
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

    const choice = (parsers, order) => {
        if(order !== undefined)
            return new Parser(state => {
                if(state.error)
                    return state;
                
                for(let i = 0; i < order.length; i++)
                {
                    const parser = parsers[order.at(i)];
                    const nextState = parser.parse(state);
                    if(!nextState.error)
                        return nextState;
                }
        
                return updateParserError(state, PARSER_ID.CHOICE);
            });
        else
            return new Parser(state => {
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
    };

    const category = cat => new Parser(state => {
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
        const shared = state.shared;
        const index = state.index;
        if(index >= shared.input.length)
            return updateParserError(state, PARSER_ID.SINGLE_CATEGORY + ERROR_KIND.EOF);
        
        if(!(shared.input[index] in cat))
            return updateParserError(state, PARSER_ID.SINSINGLE_CATEGORYGLE);
        
        return updateParserResult(state, token, index + 1);
    });

    const slice = s => new Parser(state => {
        const shared = state.shared;
        const index = state.index;
        const sliced = shared.input.slice(index, index + s.length);
        if(sliced === s)
            return updateParserResult(state, s, index + s.length);
        
        return updateParserError(state, PARSER_ID.SLICE);
    });

    const regex = (reg, max_offset = undefined) => new Parser(state => {
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
        const states = new Array(parsers.length);
        for(let i = 0; i < parsers.length; i++)
            states[i] = parsers[i].parse(state);

        return updateParserResult(nextState, results);
    });
    
    const furthest = parsers => new Parser(state => {
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
        mutableUpdateError,
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