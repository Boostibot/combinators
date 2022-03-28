function import_main(lib)
{ 
    const NAME = 'main';
    if(areImported(lib, 'imported_base') == false ||
       importedOk(lib) == false)
        return importError(lib, NAME);

    const query = lib.query;
    const selector = lib.selector;
    const parsers = import_parsers(lib);

    function parse()
    {
        const input = query.single(selector.data_id('input'));
        const output = query.single(selector.data_id('output'));
        const checkbox = query.single(selector.data_id('show_parse'));

        // try 
        {
            const parsed = parsers.parse(input.value);
            if(parsed.error)
                throw new Error(parsed.singular.errorInfo);
            
            if(checkbox.checked)
            {
                console.log(parsed);
                output.textContent = parsers.formatToken(parsed.result);
            }
            else
            {
                const evaluated = parsers.evaluate(parsed.result);
                const sringified = parsers.formatValue(evaluated);
                output.textContent = sringified;
            }
        }
        // catch(error)
        {
            // output.textContent = 'ERROR: ' + error.message;
        }
    }

    function add_events()
    {
        query.all(selector.data_id('calculate'), document, button => {
            button.addEventListener('click', parse);
        });
    }

    add_events();
    lib.meta.addProperty(lib, NAME);
    return importOk(lib, NAME);
}