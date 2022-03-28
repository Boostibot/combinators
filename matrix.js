

function importMatrix(ARRAY_ = Array, COPY_ARRAY_ = row => row.slice())
{
    let ARRAY = ARRAY_;
    let COPY_ARRAY = COPY_ARRAY_;
    const ERROR = {
        SINGULAR: 1,
        DIMENSIONS: 2,
    };

    const State = (err = 0) => ({error: err});

    const assign = (to, from) =>
    {
        for(let i = 0; i < from.lenght; i++)
            result[i] = COPY_ARRAY(from[i]);

        return to;
    };

    const copy = (matrix) =>
    {
        const result = new ARRAY(matrix.length);
        for(let i = 0; i < matrix.length; i++)
            result[i] = COPY_ARRAY(matrix[i]);

        return result;
    };
    
    const dims = (matrix) => [matrix.length, matrix[0].length];  
    const height = (matrix) => matrix.length;  
    const width = (matrix) => matrix[0].length;  

    const row = (matrix, i) => matrix[i];
    const col = (matrix, j) => 
    {
        const result = new ARRAY(matrix.length);
        for(let i = 0; i < matrix.length; i++)
            result[i] = matrix[i][j];

        return result;
    };

    const Matrix = (n, m) =>
    {
        const result = new ARRAY(n);
        for(let i = 0; i < n; i++)
            result[i] = ARRAY(m).fill(0);

        return result;
    };

    const fromRows = (rows) => copy(rows);
    const fromCols = (cols) =>
    {
        //width is height because colMajor -> rowMajor
        const rowCount = width(cols);
        const colCount = height(cols);

        const result = Array2D(rowCount, colCount);

        for(let i = 0; i < rowCount; i++)
        {
            for(let j = 0; j < colCount; j++)
                result[i][j] = cols[j][i];
        }

        return result;
    };

    const generate = (n, m, generator) =>
    {
        const result = new ARRAY(n);
        for(let i = 0; i < n; i++)
        {
            const row = new ARRAY(m);
            for(let j = 0; j < m; j++)
                row[j] = generator(n, m);

            result[i] = row;
        }

        return result;
    };

    const identity = (size) =>
    {
        let identity = new ARRAY(size);
        for(let i = 0; i < size; i++)
        {
            const row = ARRAY(size).fill(0);
            row[i] = 1;
            identity[i] = row;
        }

        return identity;
    };

    const transform = (matrix, fn) =>
    {
        const width = matrix[0].length;
        for(let i = 0; i < matrix.length; i++)
        {
            const row = matrix[i];
            for(let j = 0; j < width; j++)
                row[j] = fn(row[j], i, j);
        }

        return matrix;
    };

    const transform2 = (matrix1, matrix2, output, fn) =>
    {
        const width = matrix1[0].length;
        for(let i = 0; i < matrix1.length; i++)
        {
            const row1 = matrix1[i];
            const row2 = matrix2[i];
            const outRow = output[i];
            for(let j = 0; j < width; j++)
                outRow[j] = fn(row1[j], row2[j],  i, j);
        }

        return matrix;
    };

    const Array2D = (n, m) =>
    {
        const result = new ARRAY(n);
        for(let i = 0; i < n; i++)
            result[i] = new ARRAY(m);

        return result;
    };


    const addMatrixAssign = (left, right, scalar = 1) => 
    {
        const width = left[0].length;
        for(let i = 0; i < left.length; i++)
        {
            const lRow = left[i];
            const rRow = right[i];
            for(let j = 0; j < width; j++)
                lRow[j] += rRow[j] * scalar;
        }
        
        return left;
    };
    
    const subMatrixAssign = (left, right, scalar = -1) => addMatrixAssign(left, right, scalar);

    const mulNumAssign = (matrix, val) => {
        for(const row of matrix)
        {
            for(let j = 0; j < row.length; j++)
                row[j] *= val;
        }

        return matrix;
    };

    const divNumAssign = (matrix, val) => {
        for(const row of matrix)
        {
            for(let j = 0; j < row.length; j++)
                row[j] /= val;
        }

        return matrix;
    };

    const mulMatrix = (rows1, rows2) => 
    {
        // if(rows1[0].length !== rows2.length)
            // throw new Error(`Operator * cannot be applied on matrices of size ${rows1.length}x${rows1[0].length} * ${rows2.length}x${rows2[0].length}`);

        const resRows = rows1.length;
        const resCols = rows2[0].length;
        const sumOver = rows2.length;
        
        const result = Array2D(resRows, resCols);

        for(let i = 0; i < resRows; i++)
            for(let j = 0; j < resCols; j++)
            {
                let sum = 0;
                for(let k = 0; k < sumOver; k++)
                    sum += rows1[i][k] *  rows2[k][j];

                result[i][j] = sum;
            }

        return result;
    };

    const transposeInplace = (matrix) => 
    {
        const colCount = width(cols);
        const rowCount = height(cols);

        for(let i = 0; i < colCount; i++)
        {
            for(let j = i; j < rowCount; j++)
                matrix[i][j] = matrix[j][i];
        }

        return matrix;
    };

    const transpose = (matrix) => fromCols(matrix);

    const inverse = (matrix, state = {error: 0}) =>
    {
        const width = matrix[0].length;
        const copied = copy(matrix);
        const result = identity(width);

        const toWidth = width - 1;
        for(let i = 0; i < toWidth; i++)
        {
            const nonZeroRow = findNonZero(copied, i, i);
            if(nonZeroRow === -1)
            {
                state.error = ERROR.SINGULAR;
                return result;
            }

            swapRows(copied, nonZeroRow, i);
            swapRows(result, nonZeroRow, i);
            normRow(copied, result, i, i);
            addRowsFrom(copied, result, i, i);
        }
        
        if(copied[toWidth][toWidth] === 0)
        {
            state.error = ERROR.SINGULAR;
            return result;
        }
        normRow(copied, result, toWidth, toWidth);

        for(let i = width; i-- > 1; )
            addRowsTo(copied, result, i, i);

        return result;
    };

    const findNonZero = (matrix, coli, fromRowi) =>
    {
        const size = matrix.length;
        for(let i = fromRowi; i < size; i++)
        {
            if(matrix[i][coli] != 0)
                return i;
        }

        return -1;
    };

    const setRow = (matrix, row, rowi) =>
    {
        matrix[rowi] = row;
        return matrix;
    };
    
    const setCol = (matrix, col, coli) =>
    {
        for(let i = 0; i < col.size; i++)
            result[i][col] = col[i];

        return matrix;
    };

    const swapRows = (matrix, row1i, row2i) =>
    {
        const temp1 = matrix[row1i];
        matrix[row1i] = matrix[row2i];
        matrix[row2i] = temp1;
        return matrix;
    };
    
    const swapCols = (matrix, col1i, col2i) =>
    {
        for(let i = 0; i < matrix.length; i++)
        {
            const row = matrix[i];
            const temp1 = row[col1i];
            row[col1i] = row[col2i];
            row[col2i] = temp1;
        }
        
        return matrix;
    };

    const addRows = (matrix, scalar, row1i, row2i) =>
    {
        const size = matrix.length;
        const row1 = matrix[row1i];
        const row2 = matrix[row2i];
        for(let i = 0; i < size; i++)
            row2[i] += scalar * row1[i];
    };

    const addRowsTo = (matrix, identity, toRowi, coli) =>
    {
        for(let i = 0; i < toRowi; i++)
        {
            const scalar = -matrix[i][coli];
            addRows(matrix, scalar, toRowi, i);
            addRows(identity, scalar, toRowi, i);
        }
    };

    const addRowsFrom = (matrix, identity, fromRowi, coli) =>
    {
        const size = matrix.length;
        for(let i = fromRowi + 1; i < size; i++)
        {
            const scalar = -matrix[i][coli];
            addRows(matrix, scalar, fromRowi, i);
            addRows(identity, scalar, fromRowi, i);
        }
    };

    const normRow = (matrix, identity, rowi, coli) =>
    {
        const val = 1/matrix[rowi][coli];
        const size = matrix.length;

        const row1 = matrix[rowi];
        const row2 = identity[rowi];

        for(let i = 0; i < size; i++)
        {
            row1[i] *= val;
            row2[i] *= val;
        }
    };

    const map = (matrix, fn) => transform(copy(matrix), fn);
    const map2 = (left, right, fn) => transform2(left, right, Array2D(height(left), width(left)), fn);

    const addMatrix = (left, right, scalar = 1) => addMatrixAssign(copy(left), right, scalar);
    const subMatrix = (left, right, scalar = -1) => subMatrixAssign(copy(left), right, scalar);
    const mulNum = (matrix, value) => mulNumAssign(copy(matrix), value);
    const divNum = (matrix, value) => divNumAssign(copy(matrix), value);

    const pow = (matrix, power, state = {error: 0}) =>
    {
        if(power === 0)
            return identity(matrix.length);

        if(power < 0)
        {
            const inv = inverse(matrix, state);
            let result = inv;
            power = -power;
            
            for(let i = 1; i < power; i++)
                result = mulMatrix(result, inv);
                
            return result;
        }

        let result = matrix;
        for(let i = 1; i < power; i++)
            result = mulMatrix(result, matrix);

        return result;
    };

    const safePow = (matrix, power, state = {error: 0}) =>
    {
        if(power === 0)
            return identity(matrix.length);

        if(width(matrix) !== height(matrix))
        {
            state.error = ERROR.DIMENSIONS;
            return matrix;
        }

        if(power < 0)
        {
            const inv = inverse(matrix, state);
            let result = inv;
            power = -power;
            
            for(let i = 1; i < power; i++)
                result = mulMatrix(result, inv);

            return result;
        }

        let result = matrix;
        for(let i = 1; i < power; i++)
            result = mulMatrix(result, matrix);

        return result;
    };

    return {
        ERROR, 
        State,

        assign,
        copy,
        dims,
        height,
        width,
        row,
        col,
        Matrix,

        fromRows,
        fromCols,
        
        generate,
        identity,
        transform,
        transform2,
        Array2D,

        setRow,
        setCol,
        swapRows,
        swapCols,

        addMatrixAssign,
        subMatrixAssign,
        mulNumAssign,
        divNumAssign,
        
        mulMatrix,
        transpose,
        transposeInplace,
        inverse,
        pow,

        map,
        map2,
        addMatrix,
        subMatrix,
        mulNum,
        divNum,

        safe: {
            pow: safePow,
        }
    };
}