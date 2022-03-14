function gauss(matrix)
{
    if(matrix.length == 0)
        return matrix;

    const height = matrix.length;
    const width = matrix[0].length;

    if(height != width)
        throw new Error("Error: Matrix singular");

    let identity = createIdentity(width);

    for(let i = 0; i < width; i++)
    {
        const nonZeroRow = findNonZero(matrix, i, i);
        swapRows(matrix, nonZeroRow, i);
        substractRows(matrix, identity, i, i);
    }

    for(let i = width; i-- > 0; )
    {
        const nonZeroRow = findReverseNonZero(matrix, i, i);
        swapRows(matrix, nonZeroRow, i);
        substractReverseRows(matrix, identity, i, i);
    }

    return identity;
}

function createIdentity(size)
{
    let identity = [];
    for(let i = 0; i < size; i++)
    {
        let row = new Array(size).fill(0);
        row[i] = 1;
        identity.push(row);
    }

    return identity;
}

function findNonZero(matrix, coli, fromRowi)
{
    const size = matrix.length;
    for(let i = fromRowi; i < size; i++)
    {
        if(matrix[i][coli] != 0)
            return i;
    }

    throw new Error("Error: Matrix singular");
}

function swapRows(matrix, row1i, row2i)
{
    const temp = matrix[row1i];
    matrix[row1i] = matrix[row2i];
    matrix[row2i] = temp;
}

function addRows(matrix, scalar, row1i, row2i)
{
    const size = matrix.length;
    for(let i = 0; i < size; i++)
        matrix[row2i][i] += scalar * matrix[row1i][i];
}

function substractRows(matrix, identity, coli, fromRowi)
{
    const size = matrix.length;
    const baseVal = matrix[fromRowi][coli];

    for(let i = fromRowi + 1; i < size; i++)
    {
        let ratio = - matrix[i][coli] / baseVal;

        addRows(matrix, ratio, fromRowi, i);
        addRows(identity, ratio, fromRowi, i);
    }
}

function findReverseNonZero(matrix, coli, fromRowi)
{
    for(let i = fromRowi; i >= 0; i--)
    {
        if(matrix[i][coli] != 0)
            return i;
    }

    throw new Error("Error: Matrix singular");
}

function substractReverseRows(matrix, identity, coli, fromRowi)
{
    const baseVal = matrix[fromRowi][coli];

    for(let i = fromRowi - 1; i >= 0; i--)
    {
        let ratio = - matrix[i][coli] / baseVal;

        addRows(matrix, ratio, fromRowi, i);
        addRows(identity, ratio, fromRowi, i);
    }
}