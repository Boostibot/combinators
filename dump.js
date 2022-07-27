
    //@TOLIB
    
    const DECL = {
        OP: "op",
        FN: 'function',
        ID: 'id',
        NUM: "num",
        EXPR: 'expr',
        ARR: 'array',
        MTRX: 'matrix',
        PARENS: 'parens',
        SCOPE: 'scope',
        LINE: 'line',
        ERR: 'error',
        SPACE: 'space',
        RBRACKET: 'roundB',
        SBRACKET: 'squareB',
        CBRACKET: 'curlyB',
        SEMICOL: 'semicol',
    };


    const isOneOf = (val, ofArr) => {
        if(ofArr.indexOf(val.val) == -1)
            return 1;
        else
            return 0;
    };

    const Identity = x => x;

    const binaryOp = (CAT, left, right, transf = Identity) => classify("expr", c.sequence([
        left,
        terminal("op").judge(res => isOneOf(res, CAT)),
        right,
    ]).judge(res => {
        //Special adjecency rule for convenience
        //5 + 3 => + (5, 3)
        //5+ 3 => + (5, 3)
        //5+3 => + (5, 3)
        //5 +3 => 5; +3 //This is handy when dealing with matrices
        if(areAdjecent(res[0], res[1]))
            return 0;
        if(areAdjecent(res[1], res[2]))
            return 1;
        return 0;
    }).mapResult(res => formExprContents(res[1], [res[0], res[2]], transf)));
    
    const unaryPreOp = (CAT, right, transf = Identity) => classify("expr", c.sequence([
        terminal("op").judge(res => isOneOf(res, CAT)),
        right,
    ]).mapResult(res => formExprContents(res[0], [res[1]], transf)));

    const unaryPostOp = (CAT, left, transf = Identity) => classify("expr", c.sequence([
        left,
        terminal("op").judge(res => isOneOf(res, CAT)),
    ]).mapResult(res => formExprContents(res[1], [res[0]], transf)));
    
    const operatorImpli = name("operatorImpli", c.lazy(() => c.choice([
        //implicit multiply
        classify("expr", c.sequence([
            higherOp(operatorImpli),
            higherOp(operatorImpli),
        ]).mapResult(leftRight => {
            const implicit = Token("op", "*", leftRight[0].ie, leftRight[0].ie);
            return formExprContents(implicit, leftRight);
        }))
    ])));

    const operatorAccess = name("operatorAccess", c.lazy(() => c.choice([
        //function
        classify("expr", c.sequence([
            terminal("op", ".").discard(),
            terminal("id"), //temp - make expr lookup
            // fromOp(operatorAccess),
            argsParser,
        ]).mapResult(res => formExprContents(res[0], res[1].val))),

        //subscript
        classify("expr", c.sequence([
            higherOp(operatorAccess),
            arrayParser,
        ]).mapResult(res => formExprContents(res[0], res[1].val, _ => "$$[]"))),
        
        //property
        classify("expr", c.sequence([
            terminal("id"), //temp
            terminal("op", ".").discard(),
            terminal("id"),
        ]).mapResult(res => formExprContents(res[1], [res[0]], prop => "$$." + prop))),
    ])));

    const operatorUnary = name("operatorUnary", c.lazy(() => c.choice([
        unaryPreOp(OPERATORS.PRE, fromOp(operatorUnary), val => val + '$$'),
        unaryPostOp(OPERATORS.POST, higherOp(operatorUnary), val => '$$' + val),
    ])));

    const operatorPow = name("operatorPow", c.lazy(() => 
        binaryOp(OPERATORS.POW, higherOp(operatorPow), fromOp(operatorPow))));

    const operatorMul = name("operatorMul", c.lazy(() => 
        binaryOp(OPERATORS.MUL, higherOp(operatorMul), fromOp(operatorMul))));

    const operatorAdd = name("operatorAdd", c.lazy(() => 
        binaryOp(OPERATORS.ADD, higherOp(operatorAdd), fromOp(operatorAdd))));
    
    const operatorShift = name("operatorShift", c.lazy(() => 
        binaryOp(OPERATORS.SHIFT, higherOp(operatorShift), fromOp(operatorShift))));

    const operatorComp = name("operatorComp", c.lazy(() => 
        binaryOp(OPERATORS.COMP, higherOp(operatorComp), fromOp(operatorComp))));
    
    const operatorEqual = name("operatorEqual", c.lazy(() => 
        binaryOp(OPERATORS.EQUAL, higherOp(operatorEqual), fromOp(operatorEqual))));

    const operatorBAnd = name("operatorBAnd", c.lazy(() => 
        binaryOp(OPERATORS.BAND, higherOp(operatorBAnd), fromOp(operatorBAnd))));
    
    const operatorBXOr = name("operatorBXOr", c.lazy(() => 
        binaryOp(OPERATORS.BXOR, higherOp(operatorBXOr), fromOp(operatorBXOr))));
    
    const operatorBOr = name("operatorBOr", c.lazy(() => 
        binaryOp(OPERATORS.BOR, higherOp(operatorBOr), fromOp(operatorBOr))));
    
    const operatorAnd = name("operatorAnd", c.lazy(() => 
        binaryOp(OPERATORS.AND, higherOp(operatorAnd), fromOp(operatorAnd))));
    
    const operatorOr = name("operatorOr", c.lazy(() => 
        binaryOp(OPERATORS.OR, higherOp(operatorOr), fromOp(operatorOr))));

    const operatorTernary = name("operatorTernary", c.lazy(() => 
        c.fail()));

    const operatorSlice = name("operatorSlice", c.lazy(() => 
        binaryOp(OPERATORS.SLICE, higherOp(operatorSlice), fromOp(operatorSlice))));

    const operatorAssignment = name("operatorAssignment", c.lazy(() => 
        binaryOp(OPERATORS.ASGN, higherOp(operatorAssignment), fromOp(operatorAssignment))));
    
    const OPERATOR_PARSERS = [
        rawValue,
        operatorImpli,
        operatorAccess,
        operatorUnary,
        operatorMul,
        operatorAdd,
        operatorShift,
        operatorComp,
        operatorEqual,
        operatorBAnd,
        operatorBXOr,
        operatorBOr,
        operatorAnd,
        operatorOr,
        operatorTernary,
        operatorSlice,
        operatorAssignment,
    ];

    const exprParserCall = (order = undefined) => name("operatorPrecedece", c.lazy(() => c.choice(OPERATOR_PARSERS, order)));
    const fromOp = (from) => {
        const fromI = OPERATOR_PARSERS.indexOf(from);
        assert(fromI != -1);
        return exprParserCall(seq.descending(fromI, fromI + 1));
    };
    const higherOp = (from) => {
        const fromI = OPERATOR_PARSERS.indexOf(from);
        assert(fromI != -1);
        return exprParserCall(seq.descending(fromI - 1, fromI));
    };
    const exprParserNew = exprParserCall(seq.descending(OPERATOR_PARSERS.length - 1, OPERATOR_PARSERS.length));
