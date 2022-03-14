
    const test0 = ` 3 `;
    const test0_5 = `{ }`;
    const test1 = ` [ 1, 2, 3] `;
    const test2 = ` [1, [2, 3], 3] `;
    const test3 = ` [(1), [2, (3)], 3] `;
    const test4 = `{ [(1), [2, (3)], 3] }`;
    const test5 = `{ 
        [(1), [2, (3)], 3];
        abc
    }`;
    const test5_5 = `a;a;`;
    const test6 = `{a;a;}`;
    const test7 = `{ 
        [(1), [2, (3)], 3];
        abc;
        {{a}};
        [(x)];
        ([01]);
    }`;
    const test9 = `a + a`;
    const test10 = `a + -a`;
    const test11 = `a + (a * b) * 7`;
    const test12 = `7a`;
    const test13 = `a + 2(a * b)7`;
    const test14 = `[a] + 5[b];`;
    const test15 = `[a] + 5[b, (3 + 2), 3];`;
    const test15_1 = `[a]`;
    const test15_2 = `A := []`;
    const test16 = `
        A := [1, 2, 3, 4*9];
    `;
    const test17 = `
    {
        A := [1, 2, 3, 4*9];
        B := [[1, 2], [3, 4]];

        C := A + 2B^-1;
        C
    }`;
    const test18 = `[[a b]]`;
    const test18_5 = `[[a]]`;
    const test19 = `[[a b, 1 2]]`;
    const test20 = `[[a*b]]`;
    const test21 = `[[a*b a+ b]]`;
    const test22 = `
    [[
        a*b b 8c,
        1 2^-1 3,
        3 4 5+-1
    ]]`;

    const test22_5 = ` A := [a]`;
    const test23 = 
    `{
        A := [[
            1       2       3,
            1/2     3/2     4/2,
            5*3     4^1/2   33
        ]];
        B := [[
            1a 1b  1c,
            2a 3b  8c,
            a2 3b2 2c2
        ]];

        C := A + 2B^-1;
        C
    }`;
    
    const test24 =
    `{
        A := [[
            1       2       3,
            1/2     3/2     4/2,
            5*3     4^1/2   33,
        ]];
        B := [[
            1a 1b  1c,
            2a 3b  8c,
            a2 3b2 2c2,
        ]];

        C := A + 2B^-1;
        C;
    }`;

    const test25 =
    `{
        A := [[
            1       2       3,
            1/2     3/2     4/2,
            5*3     4^1/2   33,
        ]];

        x = [a, 3 + 3] + [3, 4];
        
        {
            A := b;
            b = 7;
            b == 8;
            [] = []
            {} += {}
        }
        
        B := [[
            1a 1b  1c,
            2a 3b  8c,
            a2 3b2 2c2,
        ]];

        C := A + 2(3+4)B^-1;
        C;

        x := 5;
        y = x >= 5 ? 6 : 7;
        y <<= 3
    }`;

    const test26 = `1 * (3 + 4) + 4`;
    const test27 = `1 * (3 + 4) + 4; 4 + 4`;
    const test28 = `A := (8 + 4); A`;
    const test29 = `A := [2+3, 4/2,]; A`;
    const test30 = `A := [[
        2+3 4/2,
        9/2 4/3,
    ]]; A`;
    const test31 = `A := [2+3, 4/2,]; A = 5; A`;
    const test32 = `A := 5; A = (A + 3); 2A`;
    const test33 = `A := 5; A += 3; A *= 2`;
    const test34 = `A := [[1 2, 3 4]]; A *= 2`;
    
    const test35 = `
        A := [[
            1 2, 
            3 4
        ]];

        B := [[
            1 0, 
            0 1
        ]]; 
        
        A *= 2;
        A - B;
        5^2`;

    
    const test36 = `
        A := [[
            0 1 1, 
            1 2 2,
            1 3 4,
        ]];
        A^(0-1)
    `;