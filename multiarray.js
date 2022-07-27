function importMultiarray(ARRAY_ = Array, IS_ARRAY_ = Array.isArray)
{
    let ARRAY = ARRAY_;
    let IS_ARRAY = IS_ARRAY_;

    const resize = (arr, size) => 
    {
        if(!IS_ARRAY(arr))
            return new Array(size);
        
        arr.length = size;
        return arr;
    }; 

    function nocheckAssign(to, from)
    {        
        for(let i = 0; i < from.length; i++)
        {
            const elem = from[i];
            if(IS_ARRAY(elem))
                nocheckAssign(to[i], elem);
            else
                to[i] = elem;
        }

        return to;
    }

    function assign(to, from)
    {        
        to = resize(to, from.length);
        for(let i = 0; i < from.length; i++)
        {
            const elem = from[i];
            if(IS_ARRAY(elem))
                to[i] = assign(to[i], elem);
            else
                to[i] = elem;
        }

        return to;
    }

    const copy = (array) =>
    {
        const result = new Array(array.length);
        for(let i = 0; i < array.length; i++)
        {
            const elem = array[i];
            if(IS_ARRAY(elem))
                result[i] = copy(elem);
            else
                result[i] = elem;
        }

        return result;
    };

    const Array2D = (n, m) =>
    {
        const result = new ARRAY(n);
        for(let i = 0; i < n; i++)
            result[i] = new ARRAY(m);

        return result;
    };
    
    const ArrayND = (dims) =>
    {
        const dim = dims[0];
        if(dims.length === 0)
            return [];

        if(dims.length == 1)
            return new ARRAY(dim);

        const result = new ARRAY(dim);
        for(let i = 0; i < dim; i++)
            result[i] = ArrayND(dims.slice(1));

        return result;
    };

    const transform = (array, transf, depth = 0) => 
    {
        for(let i = 0; i < array.length; i++)
        {
            if(IS_ARRAY(array[i]))
                transform(array[i], transf, depth + 1);
            else
                array[i] = transf(array[i], i, depth);
        }

        return array;
    };
    
    const map = (array, transf) => transform(copy(array), transf);

    const transform2Inplace = (left, right, to, transf, depth = 0) => 
    {
        if(IS_ARRAY(left))
        {
            if(!IS_ARRAY(to))
                return to;

            if(IS_ARRAY(right))
                return transformRLArrayBail(left, right, to, transf, depth);
            else
                return transformRStaticBail(left, right, to, transf, depth);
        }
        else
        {
            if(IS_ARRAY(right))
            {
                if(!IS_ARRAY(to))
                    return to;
                return transformLStaticBail(left, right, to, transf, depth);
            }
            else
                return transf(left, right, 0, depth);
        }
    };
    
    const transform2Bail = (left, right, to, transf, depth = 0) => 
    {
        if(IS_ARRAY(left))
        {
            if(IS_ARRAY(right))
            {
                const len = Math.min(left.length, right.length);
                to = resize(to, len);
                return transformRLArrayBail(left, right, to, transf, depth, len);
            }
            else
            {
                to = resize(to, left.length);
                return transformRStatic(left, right, to, transf, depth);
            }
        }
        else
        {
            if(IS_ARRAY(right))
            {
                to = resize(to, right.length);
                return transformLStatic(left, right, to, transf, depth);
            }
            else
                return transf(left, right, 0, depth);
        }
    };
    
    const transformRLArrayBail = (left, right, to, transf, depth = 0, len = Math.min(left.length, right.length)) => 
    {
        for(let i = 0; i < len; i++)
            to[i] = transform2Bail(left[i], right[i], to[i], transf, depth + 1);

        return to;
    };
    const transformRStaticBail = (arr, num, to, transf, depth = 0) => 
    {
        for(let i = 0; i < arr.length; i++)
        {
            if(IS_ARRAY(arr[i]))
                transformRStaticBail(arr[i], num, to[i], transf, depth + 1);
            else
                to[i] = transf(arr[i], num, i, depth);
        }

        return to;
    };
    const transformLStaticBail = (num, arr, to, transf, depth = 0) => 
    {
        for(let i = 0; i < arr.length; i++)
        {
            if(IS_ARRAY(arr[i]))
                transformLStaticBail(num, arr[i], to[i], transf, depth + 1);
            else
                to[i] = transf(num, arr[i], i, depth);
        }

        return to;
    };

    const transform2 = (left, right, to, transf, depth = 0) => 
    {
        if(IS_ARRAY(left))
        {
            to = resize(to, left.length);
            if(IS_ARRAY(right))
                return transformRLArray(left, right, to, transf, depth);
            else
                return transformRStatic(left, right, to, transf);
        }
        else
        {
            if(IS_ARRAY(right))
            {
                to = resize(to, right.length);
                return transformLStatic(left, right, to, transf);
            }
            else
                return transf(left, right, 0, depth);
        }
    };
    const transformRLArray = (left, right, to, transf, depth = 0) => 
    {
        if(left.length > right.length)
        {
            to.length = left.length;
            for(let i = 0; i < right.length; i++)
                to[i] = transform2(left[i], right[i], to[i], transf, depth + 1);
            
            for(let i = right.length; i < left.length; i++)
            {
                const elem = left[i];
                if(IS_ARRAY(elem))
                {
                    to[i] = resize(to[i], elem.length);
                    transformRStatic(elem, undefined, to[i], transf, depth + 1);
                }
                else
                    to[i] = transf(elem, undefined, i, depth);
            }
        }
        else
        {
            to.length = right.length;
            for(let i = 0; i < left.length; i++)
                to[i] = transform2(left[i], right[i], to[i], transf, depth + 1);
            
            for(let i = left.length; i < right.length; i++)
            {
                const elem = right[i];
                if(IS_ARRAY(elem))
                {
                    to[i] = resize(to[i], elem.length);
                    transformLStatic(undefined, elem, to[i], transf, depth + 1);
                }
                else
                    to[i] = transf(undefined, elem, i, depth);
            }
        }

        return to;
    };
    const transformRStatic = (arr, num, to, transf, depth = 0) => 
    {
        for(let i = 0; i < arr.length; i++)
        {
            const elem = arr[i];
            if(IS_ARRAY(elem))
            {   
                to[i] = resize(to[i], elem.length);
                to[i] = transformRStatic(elem, num, to[i], transf, depth + 1);
            }
            else
                to[i] = transf(elem, num, i, depth);
        }

        return to;
    };
    const transformLStatic = (num, arr, to, transf, depth = 0) => 
    {
        for(let i = 0; i < arr.length; i++)
        {
            const elem = arr[i];
            if(IS_ARRAY(elem))
            {   
                to[i] = resize(to[i], elem.length);
                to[i] = transformLStatic(num, elem, to[i], transf, depth + 1);
            }
            else
                to[i] = transf(num, elem, i, depth);
        }

        return to;
    };


    {
        let arr1 = [1, 2, 3, 4];
        let arr2 = [1, 2, [3, 3]];
        let arr3 = [1, 2];

        console.log(transform2(arr1, arr2, [], (l, r) => ((l|0) + (r|0))));
        console.log(transform2(arr1, arr2, [0,0,[0,1],1], (l, r) => ((l|0) + (r|0))));
        console.log(transform2(arr2, arr3, [], (l, r) => ((l|0) + (r|0))));

        console.log(transform2Inplace(arr1, arr2, [0,0,0,0], (l, r) => l + r));
        console.log(transform2Inplace(arr1, arr2, [1,2,[3,3]], (l, r) => l + r));
        
        console.log(transform2Bail(arr1, arr2, [0,0,0], (l, r) => l + r));
        console.log(transform2Bail(arr1, arr2, [1,2,0], (l, r) => l + r));
    }
    
    //MAP
    const map2 = (left, right, transf, depth = 0) => 
    {
        if(IS_ARRAY(left))
        {
            if(IS_ARRAY(right))
                return mapRLArray(left, right, transf, depth);
            else
                return mapRStatic(left, right, transf);
        }
        else
        {
            if(IS_ARRAY(right))
                return mapLStatic(left, right, transf);
            else
                return transf(left, right, 0, depth);
        }
    };
    
    const map2Bail = (left, right, transf, depth = 0) => 
    {
        if(IS_ARRAY(left))
        {
            if(IS_ARRAY(right))
                return mapRLArrayBail(left, right, transf, depth);
            else
                return mapRStatic(left, right, transf);
        }
        else
        {
            if(IS_ARRAY(right))
                return mapLStatic(left, right, transf);
            else
                return transf(left, right, 0, depth);
        }
    };

    const mapRLArray = (left, right, transf, depth = 0) => 
    {
        if(left.length > right.length)
        {
            const result = new Array(left.length);
            for(let i = 0; i < right.length; i++)
                result[i] = map2(left[i], right[i], transf, depth + 1);
            
            for(let i = right.length; i < left.length; i++)
                if(IS_ARRAY(left[i]))
                    result[i] = mapRStatic(left[i], undefined, transf, depth + 1);
                else
                    result[i] = transf(left[i], num, i, depth);


            return result;
        }
        else
        {
            const result = new Array(left.length);
            for(let i = 0; i < left.length; i++)
                result[i] = map2(left[i], right[i], transf, depth + 1);
            
            for(let i = left.length; i < right.length; i++)
                if(IS_ARRAY(left[i]))
                    result[i] = mapLStatic(undefined, right[i], transf, depth + 1);
                else
                    result[i] = transf(undefined, right[i], i, depth);

            return result;
        }
    };

    const mapRLArrayBail = (left, right, transf, depth = 0) => 
    {
        const len = Math.min(left.length, right.length);
        const result = new Array(len);
        for(let i = 0; i < len; i++)
            result[i] = map2Bail(left[i], right[i], transf, depth + 1);

        return result;
    };

    const mapRStatic = (arr, num, transf, depth = 0) => 
    {
        const result = new Array(arr.length);
        for(let i = 0; i < arr.length; i++)
        {
            if(IS_ARRAY(arr[i]))
                result[i] = mapRStatic(arr[i], num, transf, depth + 1);
            else
                result[i] = transf(arr[i], num, i, depth);
        }

        return result;
    };

    const mapLStatic = (num, arr, transf, depth = 0) => 
    {
        const result = new Array(arr.length);
        for(let i = 0; i < arr.length; i++)
        {
            if(IS_ARRAY(arr[i]))
                result[i] = mapRStatic(num, arr[i], transf, depth + 1);
            else
                result[i] = transf(num, arr[i], i, depth);
        }

        return result;
    }; 

    //Impl
    const addAssing = (left, right) => transform2Bail(left, right, left, (l, r) => l + r);
    const subAssing = (left, right) => transform2Bail(left, right, left, (l, r) => l - r);
    const mulAssing = (left, right) => transform2Bail(left, right, left, (l, r) => l * r);
    const divAssing = (left, right) => transform2Bail(left, right, left, (l, r) => l / r);
    const modAssing = (left, right) => transform2Bail(left, right, left, (l, r) => l % r);
    const powAssing = (left, right) => transform2Bail(left, right, left, (l, r) => Math.pow(l,r));

    const add = (left, right) => map2Bail(left, right, (l, r) => l + r);
    const sub = (left, right) => map2Bail(left, right, (l, r) => l - r);
    const mul = (left, right) => map2Bail(left, right, (l, r) => l * r);
    const div = (left, right) => map2Bail(left, right, (l, r) => l / r);
    const mod = (left, right) => map2Bail(left, right, (l, r) => l % r);
    const pow = (left, right) => map2Bail(left, right, (l, r) => Math.pow(l,r));

    console.log(add([1, 1, 1], [2, 3, 4]));
    console.log(pow([2, 2, 2], [2, 3, 4]));
    console.log(add([1, 1, [4, 5]], [2, 3, 1]));

    return {
        resize,
        nocheckAssign,
        assign,
        copy,
        Array2D,
        ArrayND,
        transform,
        map,
        transform2Inplace,
        transform2Bail,
        transform2,
        map2,
        map2Bail,

        addAssing,
        subAssing,
        mulAssing,
        divAssing,
        modAssing,
        powAssing,

        add,
        sub,
        mul,
        div,
        mod,
        pow,
    };
}